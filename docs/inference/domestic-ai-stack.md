# 国产算力与大模型国产化适配

> 「模型能不能跑在昇腾上？」正在成为国内大模型岗位的差异化考点——政企、金融、运营商的私有化项目几乎都要求国产化。本文参考 [llm-action](https://github.com/liguodongiot/llm-action) 的国产化适配系列实战经验，讲清**为什么要国产化、国产 AI 芯片格局、昇腾软件栈（CANN/MindIE/torch_npu）、模型迁移的真实工作量与坑**。GPU 通用知识见 [GPU 与硬件基础](/inference/gpu-hardware)，推理框架见 [推理框架对比](/inference/serving-frameworks)。

## 面试先背这几句话

- 国产化的驱动力是**美国对华高端 AI 芯片出口管制**（A100/H100 及后续均受限）+ 政企侧的信创合规要求。
- 国产芯片第一名是**华为昇腾（Ascend）**，生态最完整：Atlas 硬件 + CANN（对标 CUDA）+ MindIE（对标 TensorRT-LLM/vLLM）+ torch_npu（PyTorch 适配层）。
- 迁移的核心工作不是「换卡」，而是**算子覆盖、精度对齐、性能调优**三座大山。
- PyTorch 模型迁移昇腾的主流路径：`torch_npu` 插件——大部分代码只需把 `cuda` 换成 `npu`，但自定义 CUDA 算子必须重写。
- 推理部署答题模板：**英伟达用 vLLM/TensorRT-LLM，昇腾用 MindIE（或 vLLM-Ascend）**。

## 一、为什么会有「国产化适配」这个岗位方向

三重驱动：

1. **出口管制**：2022 年起美国限制 A100/H100 对华销售，后续 A800/H800「特供版」也被禁，最先进算力无法合法获得。
2. **信创与安全合规**：党政、金融、运营商、能源等行业的私有化大模型项目普遍带「国产算力」硬性指标。
3. **供应链安全**：大厂（字节/阿里/百度/讯飞等）都在自研或大规模采购国产芯片对冲风险。

带来的岗位需求：**大模型国产化适配工程师 / 昇腾推理优化工程师**——把开源模型（Qwen/DeepSeek/GLM）在国产卡上跑起来、跑得准、跑得快。

## 二、国产 AI 芯片格局

| 厂商 | 产品 | 生态/特点 |
| --- | --- | --- |
| **华为昇腾** | Atlas 300I/800I（推理）、Atlas 800T / 910B/910C（训练） | **生态最完整**，事实上的国产第一选择；讯飞星火、盘古全栈昇腾训练 |
| 寒武纪 | 思元（MLU）370/590 | 上市公司；MagicMind 推理引擎，Neuware 软件栈 |
| 海光 | DCU（深算系列） | **兼容 ROCm/类 CUDA 生态**，迁移成本相对低；x86 CPU+DCU 组合打信创市场 |
| 摩尔线程 | MTT S 系列 | GPU 路线（图形+计算），MUSA 软件栈，宣传「CUDA 兼容」 |
| 昆仑芯 | 昆仑 R/P 系列 | 百度系，文心部分负载在自家芯片上运行 |
| 燧原科技 | 邃思/云燧 | 腾讯投资，训练+推理卡 |
| 天数智芯 | 天垓/智铠 | 通用 GPU 路线 |

**面试判断题**：「国产卡能替代 H100 吗？」——分场景答：**推理侧**（尤其 7B~72B 级别）昇腾 910B 已可承接生产流量；**训练侧**千卡级集群可行（盘古、星火为证）但软件栈成熟度、故障率、生态工具链与英伟达仍有差距；**最前沿超大规模训练**仍是英伟达占优。

## 三、昇腾软件栈全景 ★

昇腾是国产化面试的重点，软件栈要能对着英伟达逐层映射：

| 层级 | 英伟达 | 昇腾 | 说明 |
| --- | --- | --- | --- |
| 硬件 | GPU（H100） | NPU（Ascend 910B） | 昇腾是 DaVinci 架构 NPU，非 GPU |
| 驱动/固件 | Driver | Driver + Firmware | |
| 计算库/编程 | **CUDA + cuDNN/cuBLAS** | **CANN**（含 ACL、算子库、HCCL） | CANN = Compute Architecture for Neural Networks |
| 集合通信 | NCCL | **HCCL** | 分布式训练的 AllReduce 等 |
| 框架适配 | PyTorch 原生 | **torch_npu**（Ascend Extension for PyTorch） | `device="npu"` |
| 自家框架 | — | MindSpore | 华为自研框架，盘古用它 |
| 训练加速 | Megatron-LM/DeepSpeed | **MindSpeed**（Megatron 适配版）、MindFormers | 大模型分布式训练套件 |
| 推理引擎 | TensorRT-LLM / vLLM | **MindIE**（含 MindIE-LLM/Service）、vLLM-Ascend | MindIE 提供类 OpenAI 服务化接口 |
| 性能工具 | Nsight / nvidia-smi | msprof / npu-smi | 调优与监控 |

> 记忆锚点：**CANN 对标 CUDA，HCCL 对标 NCCL，torch_npu 让 PyTorch 认识 NPU，MindIE 对标 TensorRT-LLM+Triton 的组合**。

## 四、模型迁移实战：真实工作量在哪

以「把 Qwen-72B 迁到昇腾 910B 推理」为例（llm-action 系列实战的典型路径）：

### 4.1 顺利的部分

```python
# 大部分 PyTorch 代码的迁移就是：
import torch, torch_npu           # 引入昇腾插件
device = "npu:0"                   # 原来是 "cuda:0"
model = model.to(device)
```

- HuggingFace Transformers 主流模型结构（Llama/Qwen 系）官方已适配。
- MindIE 对热门开源模型提供**开箱即用**的推理与服务化（OpenAI 兼容 API）。

### 4.2 三座大山（面试重点）★

1. **算子覆盖**：
   - 模型里用了 CANN 没有的算子 → 要么等官方支持，要么用 Ascend C 自己写算子，要么改模型代码绕开。
   - 自定义 CUDA kernel（如某些 FlashAttention 变体、自研采样算子）**必须重写**，没有自动转换。
2. **精度对齐**：
   - 同一模型 NPU 与 GPU 输出可能有差异，来源：算子实现差异、融合策略不同、FP16/BF16 行为差异。
   - 标准做法：**逐层 dump 对比**（精度对齐工具），锁定首个偏差层；用 golden 数据集对比最终生成质量。
3. **性能调优**：
   - 直接迁过去往往性能不达标：需要用 msprof 找瓶颈、开算子融合、调 batch/并行策略、用好 HCCL 拓扑。
   - 910B 单卡显存 64GB，72B 模型推理常用 **2/4 卡张量并行**，切分策略要重新调。

### 4.3 训练迁移额外注意

- Megatron-LM 换 **MindSpeed / MindFormers**；DeepSpeed ZeRO 有适配版但特性覆盖需逐项确认。
- 数据格式（如 MindRecord）、断点续训、混合精度 loss scale 行为都要验证。
- 大集群稳定性：故障节点自动隔离与续训能力是生产关键（对比英伟达生态成熟度仍有 gap）。

## 五、其他路线：兼容 CUDA 生态

- **海光 DCU**：走 ROCm 兼容路线，HIP 代码几乎无缝，PyTorch-ROCm 即可跑——迁移成本最低，是很多信创项目的务实选择。
- **摩尔线程 MUSA**：提供 CUDA 代码转译工具（musify）。
- **共同权衡**：兼容路线迁移快，但性能上限与新特性跟进受制于人；自建生态路线（昇腾）前期痛苦、长期可控。

这本质是个**架构决策题**：短期交付选兼容路线，长期战略投入选昇腾生态——面试这么答能体现工程判断力。

## 六、怎么把国产化写进简历/项目经验

有说服力的量化表述模板：

- 「将 Qwen2.5-72B 从 A800 迁移至 Atlas 800I（910B×4），通过 MindIE 服务化部署，**首 token 延迟 xx ms、吞吐 xx token/s，达到 GPU 基线的 xx%**」。
- 「用精度对齐工具定位 RMSNorm 融合算子 FP16 溢出问题，**修复后 C-Eval 评分与 GPU 版本差异 <0.5%**」。
- 「压测对比 MindIE vs vLLM-Ascend 在不同并发下的 P95 延迟，形成选型报告」。

关键是体现**迁移方法论**（算子→精度→性能）而非「跑通了」。

## 高频追问

1. **CANN 和 CUDA 是什么关系？** 对标关系：都是「驱动之上、框架之下」的异构计算架构层，含编程接口、算子库、通信库（HCCL 对标 NCCL）；但 API 不兼容，CUDA 代码不能直接跑。
2. **PyTorch 模型迁昇腾要改多少代码？** 标准结构基本只改 device（torch_npu 插件），但自定义 CUDA 算子必须用 Ascend C 重写；工作量大头在精度对齐与性能调优。
3. **昇腾上用什么做 LLM 推理服务？** 首选 MindIE（模型加速库+服务化，OpenAI 兼容接口）；社区路线有 vLLM-Ascend；训练用 MindSpeed/MindFormers。
4. **精度不一致怎么排查？** 固定随机性→逐层 dump 对比找首个偏差层→区分算子 bug/融合策略/数值精度问题→用业务评测集验证端到端质量。
5. **910B 和 H100 差距多大？** 单卡算力与显存带宽有代差，互联（HCCS vs NVLink）和软件生态也有差距；但推理场景可用多卡并行+价格优势弥补，国内推理生产已规模化落地。
6. **为什么不都走 CUDA 兼容路线？** 兼容路线（海光/摩尔线程）迁移快但受制于 CUDA 生态演进与法律风险；昇腾自建生态长期可控，国家与华为持续重投入，政企项目普遍指定。
7. **国产化项目的最大风险是什么？** 算子/特性覆盖不全导致的进度不可控；应对：立项前做**算子扫描与可行性 POC**，确认目标模型在目标软件栈版本的支持清单。
