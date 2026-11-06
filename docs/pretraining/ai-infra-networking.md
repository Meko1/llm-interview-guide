---
title: AI 训练集群与网络通信
description: >-
  千卡万卡训练大模型，瓶颈往往不在算力，而在通信与稳定性。本文参考 llm-action 的 AI 基础设施与网络通信章节，讲清 GPU
  集群互联（NVLink/NVSwitch/IB/RoCE）、集合通信（NCCL/HCCL 的
  AllReduce/AllGather）、计算与通信重叠、以及超大规模
level: L3
roles:
  - 算法研究
  - Infra
classification: inferred
---
# AI 训练集群与网络通信

> 千卡万卡训练大模型，**瓶颈往往不在算力，而在通信与稳定性**。本文参考 [llm-action](https://github.com/liguodongiot/llm-action) 的 AI 基础设施与网络通信章节，讲清 GPU 集群互联（NVLink/NVSwitch/IB/RoCE）、集合通信（NCCL/HCCL 的 AllReduce/AllGather）、计算与通信重叠、以及超大规模训练的稳定性与故障恢复。并行策略本身见 [分布式训练与显存优化](/pretraining/distributed-training)，国产栈见 [国产算力与国产化适配](/inference/domestic-ai-stack)。

## 面试先背这几句话

- 大模型训练的通信分两层：**机内**（GPU 间用 NVLink/NVSwitch）和**机间**（节点间用 InfiniBand 或 RoCE 组「参数面」网络）。
- 集合通信原语核心是 **AllReduce**（梯度同步），NCCL 用 **Ring / Tree / NVLS** 算法实现；国产对应 **HCCL**。
- 不同并行策略吃不同通信：**DP 同步梯度、TP 同步层内激活、PP 传递阶段边界张量、EP 交换路由 token**；不能脱离张量形状判断谁的通信量最大。
- 看未被计算隐藏的通信、慢 rank 与恢复停顿；MFU 必须注明 FLOPs 计数和硬件精度口径，不能用固定百分比代表所有集群。
- 故障频率需要本集群日志支持；自动重启不等于恢复完整训练状态。

## 一、为什么通信是大模型训练的命门

一次训练迭代 = 计算（前向+反向）+ 通信（同步梯度/激活/参数）。模型越大、卡越多，通信占比越高：

- 数据并行下，每步都要对**全部梯度**做一次 AllReduce，参数量越大传输越多。
- 张量并行把单层算子切到多卡，每一层前向/反向都要通信**激活值**，通信极其频繁。
- 如果通信不能和计算重叠，GPU 就在「等数据」——算力被浪费。

衡量效率的指标之一是 **MFU（Model FLOPs Utilization，模型算力利用率）**：按模型 FLOPs 口径计算的有效算力 / 同精度硬件峰值算力。重计算一般不计入模型有效 FLOPs；MFU 低也可能来自小矩阵、数据等待或低效 kernel，不能直接归因于网络。

## 二、集群互联架构（机内 vs 机间）★

### 2.1 机内：GPU 之间

| 互联 | 说明 |
| --- | --- |
| **PCIe** | 有效带宽取决于代际、lane、NUMA 路径和并发流量 |
| **NVLink** | 区分单向/双向、每链路/每 GPU 聚合带宽，不能当成单流实测值 |
| **NVSwitch** | 交换式 GPU 互联；吞吐仍受端口、路由、算法与竞争影响 |

> 布局原则是优先把高频 TP 通信放在高速互联域，而不是“必须单机 8 卡”。域大小由实际拓扑决定；跨机 TP 是否可用，需用目标张量大小和并行度测量。

### 2.2 机间：节点之间（参数面网络）

训练集群通常有两张网：**业务面**（管理/存储）和**参数面/计算面**（专供梯度同步的高速无损网络）。参数面主流两条路线：

| 方案 | 说明 |
| --- | --- |
| **InfiniBand（IB）** | 支持 RDMA；比较端口速率、拓扑超售、交换机与运维成本，不把线速当应用吞吐 |
| **RoCE（RDMA over Converged Ethernet）** | 基于以太网的 RDMA；拥塞控制与 PFC/ECN 依赖 NIC/交换机方案，成本优势不是必然 |

**RDMA（远程直接内存访问）**允许 NIC 在已注册内存间传输，减少 CPU 数据搬运；连接建立、内存注册和控制路径仍涉及软件。直接访问 GPU 显存还需要 **GPUDirect RDMA** 等支持及满足拓扑/驱动约束，否则可能经主机内存中转。

**网络拓扑**：大集群用 **Fat-Tree / Spine-Leaf** 无阻塞拓扑，或专为 AI 优化的 **Rail-optimized** 拓扑（让每张卡走独立轨道，减少冲突）。拓扑好坏直接影响 AllReduce 效率。

## 三、集合通信（Collective Communication）★

分布式训练靠一组标准通信原语，由 **NCCL**（英伟达）/ **HCCL**（昇腾）/ Gloo 实现：

| 原语 | 作用 | 典型用途 |
| --- | --- | --- |
| **AllReduce** | 所有节点的数据求和后广播回所有节点 | **DP 梯度同步（最核心）** |
| **AllGather** | 收集所有节点的分片拼成完整数据 | ZeRO 参数聚合、TP |
| **ReduceScatter** | 求和后按分片散给各节点 | ZeRO、AllReduce 的一半 |
| **Broadcast** | 一个节点数据发给所有节点 | 初始化参数分发 |
| **AllToAll** | 每个节点向每个节点各发一份 | **MoE 专家并行的 token 路由** |
| **P2P（Send/Recv）** | 点对点 | **流水线并行传激活** |

**AllReduce 的实现算法**（面试加分）：
- **Ring AllReduce**：在均匀链路、大消息模型下带宽效率较好；每 rank 传输量趋近两倍消息大小，通信轮数仍随 rank 数增加。
- **Tree AllReduce**：树形规约，延迟低，适合小数据/大规模。
- **NVLS（NVLink SHARP）**：用交换机做在网计算（in-network reduction），进一步加速。

一个恒等式：**AllReduce = ReduceScatter + AllGather**。ZeRO 正是利用这一点把通信拆开、按需聚合参数来省显存。

## 四、各并行策略的通信特征

| 并行方式 | 主要通信原语 | 通信量/频率 | 部署约束 |
| --- | --- | --- | --- |
| 数据并行 DP | AllReduce（梯度） | 每个同步更新处理梯度 bucket；字节数取决于精度 | 可跨机；累积时可延迟同步 |
| 张量并行 TP | AllReduce/AllGather（激活） | 每层多次；与 batch、序列、隐藏维度相关 | 优先高速互联域，不限固定卡数 |
| 流水线并行 PP | P2P（激活/梯度） | 点对点，量小，但有**气泡** | 可跨机 |
| 序列并行 SP | AllGather/ReduceScatter | 配合 TP 省激活显存 | 随 TP |
| 专家并行 EP | AllToAll（token 路由） | 与激活 token 数相关 | MoE 专用 |
| ZeRO / FSDP | ReduceScatter + AllGather | 用通信换显存 | 可跨机 |

**3D 并行**就是 DP×TP×PP 组合。工程经验：**TP 放机内、PP 跨机分段、DP 在最外层**，让通信量最大的 TP 走最快的链路。

## 五、通信与计算重叠（Overlap）

让 GPU「边算边传」能减少可重叠部分的停顿，但收益必须由 trace 验证：

- **反向传播中重叠梯度通信**：某层梯度一算完就立即启动 AllReduce，不等整个反向结束（PyTorch DDP 的 bucket + hook 机制）。
- **ZeRO/FSDP 的参数预取**：在计算第 N 层时，异步 AllGather 第 N+1 层的参数。
- **流水线并行填气泡**：用 1F1B（one-forward-one-backward）调度、interleaved 调度减小气泡占比。
- **TP 通信与计算融合**：如把 AllGather 拆分与 matmul 分块交错（overlap）。

面试表达：**理想情况下通信时间被计算时间「藏起来」，实际瓶颈是无法重叠的那部分关键路径通信**。

## 六、超大规模训练的稳定性与故障恢复 ★

万卡集群里，「训练能不能不断」比「单步多快」更重要：

- **故障是常态**：GPU 掉卡、ECC 错误、网络抖动、慢节点（straggler）几乎每天发生。一次中断若要从头重训，成本是灾难性的。
- **Checkpoint 策略**：保存模型、优化器、调度器、RNG、数据游标与全局 token 计数。异步保存只有在持久化完成且有一致性提交标记后才可作为恢复点；本机缓存不能保证节点丢失后可用。
- **弹性训练（Elastic Training）**：TorchElastic 可在成员变化时重启 worker，但应用必须实现 checkpoint 恢复。rank/world size 可能改变，分片重组、数据去重和有效 batch 重算不能交给启动器自动保证。
- **慢节点检测**：监控每个 rank 的 step 时间，AllReduce 会被最慢的节点拖住（木桶效应），要能定位并隔离慢卡。
- **静默错误（SDC）**：个别卡算错但不报错，会污染梯度，需要数值监控（loss spike 检测，见 [训练深入](/advanced/training-internals)）。

> 大厂（Meta 训 Llama、字节等）的技术报告里，大量篇幅在讲故障率、恢复时间、有效训练时长占比——这才是工业界大模型训练的真实难点。

## 七、存储与数据供给

- 训练数据 TB~PB 级，需要**高吞吐并行文件系统**（如 Lustre、GPFS）或对象存储 + 本地缓存。
- **数据加载不能成为瓶颈**：多进程 DataLoader、预取、打包（packing）、边训边流式读取。
- Checkpoint 的读写也吃存储带宽，大模型单个 checkpoint 可达数百 GB。

## 高频追问

1. **大模型训练为什么通信可能是瓶颈？怎么证明？** 对照每 rank 的计算/通信 trace、数据等待和 step 尾延迟；MFU 是结果指标，不是网络故障证据。
2. **NVLink 和 InfiniBand 分别解决什么？** NVLink/NVSwitch 是机内 GPU 高速互联（承载 TP）；IB/RoCE 是机间参数面网络（承载跨机 DP/PP），都靠 RDMA 低延迟。
3. **AllReduce 是什么？和 ZeRO 什么关系？** 所有节点梯度求和再广播，是 DP 梯度同步核心；AllReduce = ReduceScatter + AllGather，ZeRO 拆开二者按需聚合省显存。
4. **为什么通常把张量并行放在高速互联域？** TP 通信频繁，难以完全隐藏；跨机部署需按目标消息形状实测，而非一概禁止。
5. **3D 并行怎么排布？** 通信量最大的 TP 放机内 NVLink，PP 跨机分段，DP 在最外层；本质是按通信量匹配链路带宽。
6. **通信和计算怎么重叠？** 反向边算边同步梯度（bucket+hook）、参数预取、流水线 1F1B 填气泡；把通信藏进计算时间里。
7. **MoE 训练的通信有什么特殊？** 专家并行用 AllToAll 做 token 路由，通信模式和量都和稠密模型不同，容易成为瓶颈。
8. **大规模训练如何衡量稳定性？** 用故障间隔、恢复耗时、回退 token 与有效训练时长占比，不用未经测量的故障频率替代证据。

## 从通信账本到排障证据

构造例：8 个 rank 对 1 GiB 梯度做 ring AllReduce，忽略协议开销，每 rank 发送量约为 `2×(8−1)/8×1=1.75 GiB`。若实测链路有效带宽为 40 GiB/s，仅传输下界约 43.8 ms；还需加通信轮次延迟，且不能把它直接加到已重叠的计算时间上。梯度大小是字节，不是参数数目。

| 现象 | 优先收集 | 排除的误判 |
| --- | --- | --- |
| 所有 rank 通信同时增长 | 同消息大小 collective 测试、NIC 拥塞、拓扑映射 | 线速正常不代表 collective 正常 |
| 单 rank 进入 collective 晚 | 数据等待、GPU trace、CPU/NUMA、前一算子时间 | 等待者不一定是坏网卡 |
| 恢复后 loss/token 曲线跳变 | 提交标记、游标、RNG、world size、batch | 能加载权重不代表精确续训 |

原语语义依据 [NCCL 2.19.3 归档文档](https://docs.nvidia.com/deeplearning/nccl/archives/nccl_2193/user-guide/docs/usage/collectives.html)，重启边界依据 [TorchElastic Important Notices](https://docs.pytorch.org/docs/stable/elastic/run.html#important-notices)。归档语义不代表当前所有拓扑支持；上线需记录实际 NCCL、驱动和 NIC 固件版本。
