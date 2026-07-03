# AI 训练集群与网络通信

> 千卡万卡训练大模型，**瓶颈往往不在算力，而在通信与稳定性**。本文参考 [llm-action](https://github.com/liguodongiot/llm-action) 的 AI 基础设施与网络通信章节，讲清 GPU 集群互联（NVLink/NVSwitch/IB/RoCE）、集合通信（NCCL/HCCL 的 AllReduce/AllGather）、计算与通信重叠、以及超大规模训练的稳定性与故障恢复。并行策略本身见 [分布式训练与显存优化](/pretraining/distributed-training)，国产栈见 [国产算力与国产化适配](/inference/domestic-ai-stack)。

## 面试先背这几句话

- 大模型训练的通信分两层：**机内**（GPU 间用 NVLink/NVSwitch）和**机间**（节点间用 InfiniBand 或 RoCE 组「参数面」网络）。
- 集合通信原语核心是 **AllReduce**（梯度同步），NCCL 用 **Ring / Tree / NVLS** 算法实现；国产对应 **HCCL**。
- 不同并行策略吃不同通信：**DP→AllReduce 梯度、TP→AllReduce/AllGather 激活（通信量最大，必须锁在机内 NVLink）、PP→点对点小通信但有气泡、EP→AllToAll**。
- 大集群性能杀手：**通信没和计算重叠、慢节点拖累（straggler）、故障中断重训**。MFU（模型算力利用率）能到 40-50% 就算不错。
- 万卡训练几乎每天都会坏卡，**故障恢复能力（checkpoint + 自动重启 + 弹性训练）是工程核心竞争力**。

## 一、为什么通信是大模型训练的命门

一次训练迭代 = 计算（前向+反向）+ 通信（同步梯度/激活/参数）。模型越大、卡越多，通信占比越高：

- 数据并行下，每步都要对**全部梯度**做一次 AllReduce，参数量越大传输越多。
- 张量并行把单层算子切到多卡，每一层前向/反向都要通信**激活值**，通信极其频繁。
- 如果通信不能和计算重叠，GPU 就在「等数据」——算力被浪费。

衡量效率的关键指标是 **MFU（Model FLOPs Utilization，模型算力利用率）**：实际达到的有效算力 / 硬件峰值算力。训练大模型 MFU 常在 30%-50%，剩下的大多被通信、气泡、显存搬运吃掉。

## 二、集群互联架构（机内 vs 机间）★

### 2.1 机内：GPU 之间

| 互联 | 说明 |
| --- | --- |
| **PCIe** | 通用总线，带宽最低（几十 GB/s），跨 CPU 的 GPU 走它会很慢 |
| **NVLink** | 英伟达 GPU 间高速直连，H100 单卡 NVLink 总带宽约 900 GB/s（远超 PCIe） |
| **NVSwitch** | 把一台机内 8 张卡全互联，任意两卡都能跑满 NVLink 带宽 |

> 关键结论：**张量并行（TP）通信量最大，必须限制在单机 8 卡内**，靠 NVLink/NVSwitch 承载；跨机做 TP 会被慢速网络拖垮。

### 2.2 机间：节点之间（参数面网络）

训练集群通常有两张网：**业务面**（管理/存储）和**参数面/计算面**（专供梯度同步的高速无损网络）。参数面主流两条路线：

| 方案 | 说明 |
| --- | --- |
| **InfiniBand（IB）** | 英伟达（Mellanox）主导，原生 RDMA、低延迟、无损，大厂训练集群首选；配 400G NDR |
| **RoCE（RDMA over Converged Ethernet）** | 在以太网上跑 RDMA，成本更低、复用以太生态，但要精细调 PFC/ECN 做无损；国内大规模用 |

两者都靠 **RDMA（远程直接内存访问）**：网卡直接读写远端显存，**绕过 CPU 和内核**，这是低延迟高带宽的关键。配合 **GPUDirect RDMA**，数据在 GPU 显存与网卡间直传，不经过主机内存。

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
- **Ring AllReduce**：环形传递，带宽最优（与节点数无关），但延迟随节点数增加；最经典。
- **Tree AllReduce**：树形规约，延迟低，适合小数据/大规模。
- **NVLS（NVLink SHARP）**：用交换机做在网计算（in-network reduction），进一步加速。

一个恒等式：**AllReduce = ReduceScatter + AllGather**。ZeRO 正是利用这一点把通信拆开、按需聚合参数来省显存。

## 四、各并行策略的通信特征

| 并行方式 | 主要通信原语 | 通信量/频率 | 部署约束 |
| --- | --- | --- | --- |
| 数据并行 DP | AllReduce（梯度） | 每步一次，量 = 参数量 | 可跨机 |
| 张量并行 TP | AllReduce/AllGather（激活） | 每层多次，量最大 | **必须机内 NVLink** |
| 流水线并行 PP | P2P（激活/梯度） | 点对点，量小，但有**气泡** | 可跨机 |
| 序列并行 SP | AllGather/ReduceScatter | 配合 TP 省激活显存 | 随 TP |
| 专家并行 EP | AllToAll（token 路由） | 与激活 token 数相关 | MoE 专用 |
| ZeRO / FSDP | ReduceScatter + AllGather | 用通信换显存 | 可跨机 |

**3D 并行**就是 DP×TP×PP 组合。工程经验：**TP 放机内、PP 跨机分段、DP 在最外层**，让通信量最大的 TP 走最快的链路。

## 五、通信与计算重叠（Overlap）

让 GPU「边算边传」，是把 MFU 从 30% 拉到 50% 的关键手段：

- **反向传播中重叠梯度通信**：某层梯度一算完就立即启动 AllReduce，不等整个反向结束（PyTorch DDP 的 bucket + hook 机制）。
- **ZeRO/FSDP 的参数预取**：在计算第 N 层时，异步 AllGather 第 N+1 层的参数。
- **流水线并行填气泡**：用 1F1B（one-forward-one-backward）调度、interleaved 调度减小气泡占比。
- **TP 通信与计算融合**：如把 AllGather 拆分与 matmul 分块交错（overlap）。

面试表达：**理想情况下通信时间被计算时间「藏起来」，实际瓶颈是无法重叠的那部分关键路径通信**。

## 六、超大规模训练的稳定性与故障恢复 ★

万卡集群里，「训练能不能不断」比「单步多快」更重要：

- **故障是常态**：GPU 掉卡、ECC 错误、网络抖动、慢节点（straggler）几乎每天发生。一次中断若要从头重训，成本是灾难性的。
- **Checkpoint 策略**：定期保存模型+优化器状态；用**异步/分层 checkpoint**（先存到本地/内存再后台落盘）减少停顿；权衡频率（太频繁拖慢训练，太稀疏丢进度多）。
- **弹性训练（Elastic Training）**：节点故障后自动剔除、重组通信组、从最近 checkpoint 续训，而非整体崩溃（如 TorchElastic）。
- **慢节点检测**：监控每个 rank 的 step 时间，AllReduce 会被最慢的节点拖住（木桶效应），要能定位并隔离慢卡。
- **静默错误（SDC）**：个别卡算错但不报错，会污染梯度，需要数值监控（loss spike 检测，见 [训练深入](/advanced/training-internals)）。

> 大厂（Meta 训 Llama、字节等）的技术报告里，大量篇幅在讲故障率、恢复时间、有效训练时长占比——这才是工业界大模型训练的真实难点。

## 七、存储与数据供给

- 训练数据 TB~PB 级，需要**高吞吐并行文件系统**（如 Lustre、GPFS）或对象存储 + 本地缓存。
- **数据加载不能成为瓶颈**：多进程 DataLoader、预取、打包（packing）、边训边流式读取。
- Checkpoint 的读写也吃存储带宽，大模型单个 checkpoint 可达数百 GB。

## 高频追问

1. **大模型训练为什么通信是瓶颈？怎么衡量效率？** 卡多模型大时梯度/激活同步开销巨大；用 MFU（模型算力利用率）衡量，大模型常 30-50%。
2. **NVLink 和 InfiniBand 分别解决什么？** NVLink/NVSwitch 是机内 GPU 高速互联（承载 TP）；IB/RoCE 是机间参数面网络（承载跨机 DP/PP），都靠 RDMA 低延迟。
3. **AllReduce 是什么？和 ZeRO 什么关系？** 所有节点梯度求和再广播，是 DP 梯度同步核心；AllReduce = ReduceScatter + AllGather，ZeRO 拆开二者按需聚合省显存。
4. **为什么张量并行必须放在单机内？** TP 每层都要通信激活，通信量最大，跨机的低带宽网络扛不住，必须靠机内 NVLink。
5. **3D 并行怎么排布？** 通信量最大的 TP 放机内 NVLink，PP 跨机分段，DP 在最外层；本质是按通信量匹配链路带宽。
6. **通信和计算怎么重叠？** 反向边算边同步梯度（bucket+hook）、参数预取、流水线 1F1B 填气泡；把通信藏进计算时间里。
7. **MoE 训练的通信有什么特殊？** 专家并行用 AllToAll 做 token 路由，通信模式和量都和稠密模型不同，容易成为瓶颈。
8. **万卡训练最大的工程挑战是什么？** 不是单步速度而是稳定性：坏卡/慢节点/静默错误频发，靠 checkpoint+弹性训练+故障隔离保证有效训练时长。
