---
title: 国产算力与大模型国产化适配
description: 以版本支持矩阵、算子扫描、精度回归与 SLO 压测构建国产算力迁移验收，不把启动成功当作完成。
level: L2
roles:
  - Infra
  - 后端转型
classification: inferred
---
# 国产算力与大模型国产化适配

> 本文面向迁移交付：先确认合同与采购边界，再验证算子、数值和 SLO，不用“国产第一”“改 device 就行”替代 POC。原有实践入口 [llm-action](https://github.com/liguodongiot/llm-action) 保留；GPU 通用知识见 [GPU 与硬件基础](/inference/gpu-hardware)，服务选择见 [推理框架对比](/inference/serving-frameworks)。

## 面试先背这几句话

- 国产化是项目约束，不是所有政企项目的同一要求；采购、许可与政策需由项目方按当前文件核验。
- 软件栈是硬件、驱动/固件、计算库、框架插件和推理服务的版本组合，不是单个 `torch_npu` 包。
- 能运行、数值可接受、质量达标、性能达标、故障可恢复是五个不同验收层。
- “兼容”需分别说明 API、算子语义、二进制、模型特性和性能，不能由接口相似推出无缝迁移。

## 一、为什么会有「国产化适配」这个岗位方向

项目可能基于供应链、采购或私有化环境要求选择特定硬件。具体出口、采购与许可规则有时效性，本页不作合法可购或一律禁售判断；由采购/合规提供适用日期、地区、SKU 与文件。工程任务是在这组确定约束下交付可验证服务。

## 二、国产 AI 芯片格局

此表用于识别待核软件路线，不作市场排名，也不作为型号支持清单：

| 路线 | 需要向供应方核对 |
| --- | --- |
| 昇腾 Atlas/Ascend | 设备 SKU、CANN、torch_npu、MindIE 或 vLLM-Ascend 支持矩阵 |
| 寒武纪 MLU | Neuware/推理引擎版本、算子覆盖与模型支持 |
| 海光 DCU | 工具链、框架构建、HIP/库兼容范围，不默认原 ROCm wheel 可用 |
| 摩尔线程 MUSA | 代码转译范围、运行库和 kernel 重写/替换工作量 |
| 昆仑芯、燧原、天数智芯 | 各自软件栈、目标模型、服务 API 与并行支持证据 |

“能否替代某张 GPU”必须限定模型 revision、精度、并发、长度和目标 SLO。单模型 demo 或厂商训练案例不能证明自己的服务容量、故障率和全特性覆盖。

## 三、昇腾软件栈全景 ★

| 层级 | NVIDIA 侧概念 | 昇腾侧概念 | 边界 |
| --- | --- | --- | --- |
| 硬件 | GPU | Ascend NPU / Atlas 产品 | 产品/整机名与芯片 SKU 不混用 |
| 驱动/固件 | Driver | Driver + Firmware | 和 OS、卡型、CANN 联合验证 |
| 计算库 | CUDA、cuBLAS/cuDNN | CANN / ACL / 算子库 | 是职责映射，不是 API/二进制等价 |
| 通信 | NCCL | HCCL | 原语、拓扑、dtype 与并行组合需实测 |
| 框架适配 | PyTorch CUDA backend | torch_npu | 扩展 PyTorch 到 NPU，需配套版本 |
| 训练框架 | Megatron/DeepSpeed | MindSpeed/MindFormers 等 | checkpoint、优化器与特性不是自动兼容 |
| 推理服务 | vLLM/TensorRT-LLM | MindIE/vLLM-Ascend 等 | 模型、量化、KV、speculation 与 API 支持逐项确认 |
| 性能诊断 | Nsight/nvidia-smi | msprof/npu-smi 等 | 版本与采样方法随环境核验 |

[Ascend PyTorch 官方仓库](https://github.com/Ascend/pytorch)说明 torch_npu 的适配职责；[vLLM-Ascend 官方 README](https://github.com/vllm-project/vllm-ascend)明确列出硬件与软件要求，并要求与 vLLM 匹配版本。默认分支持续变化，不能把抓取到的版本当所有项目通用配方，安装前固定 tag/commit 与镜像 digest。

## 四、模型迁移实战：真实工作量在哪

以 Qwen 类模型迁移为例，下面是验证流程，不是特定 72B/卡型的已跑通结果。

### 4.1 顺利的部分

对支持的纯 PyTorch 运算，适配层可提供 NPU 执行路径。下例只是设备迁移片段，需先安装兼容环境且已有 `model`，不是完整运行脚本：

```python
import torch
import torch_npu

device = torch.device("npu:0")
model = model.to(device)
```

加载成功不证明 attention、采样、量化或多卡服务支持。CUDA 专用扩展需寻找受支持的替代 kernel、改写或回退，不能保证一律自动转换，也不必每种情形都从零重写。

### 4.2 三座大山（面试重点）★

1. **算子与特性**：扫描 eager/融合/custom kernel、dtype、shape、KV 类型、MoE 和并行通信。列出支持、替代、回退、未支持；CPU 回退可能在“能跑”状态下严重拖慢服务。
2. **精度对齐**：固定模型/tokenizer、输入、mask、采样策略与 seed；先比较 logits、逐层输出的绝对/相对误差和 top-k，再检查真实任务质量。首个偏差层只是定位点，不一定是根因；前序累积误差、布局或融合顺序也要回查。
3. **性能**：用 trace 分开看 prefill、decode、通信、排队与 CPU/数据路径。多卡权重分片之外还需 KV、workspace 和通信缓冲，不能仅凭参数量或标称显存指定 2/4 卡。

### 4.3 训练迁移额外注意

核对 checkpoint 格式、专家/参数 ID、优化器分片、调度器、RNG 与数据游标。恢复 worker 不等于恢复训练状态；变更 world size 后核对有效 batch、数据重复/跳过和 token 计数。BF16/FP16/FP8 支持、loss scaling、累积精度及分布式归约需用本环境验证，不按另一后端的名称推断行为。

## 五、其他路线：兼容 CUDA 生态

先为“兼容”指定层次：源码转译、框架 API、库 ABI、模型支持或性能。自动转译可能不覆盖内联汇编、专有库与特定内存/同步语义；POC 应包含最难的自定义 kernel 和实际并行形状，而非仅跑普通矩阵乘。路线决策依据迁移成本、支持承诺、运行稳定性和目标服务成本，不给“短期一定选兼容、长期一定选昇腾”的通用处方。

## 六、怎么把国产化写进简历/项目经验

证据格式比空白性能倍率更有价值：写清原/目标 SKU、模型与软件 revision、精度、输入/输出长度、负载分布、TTFT/逐 token 延迟阈值、达标 goodput、质量差异和复测次数。没有实际记录就标实验方案，不填示例数字。

质量差异注明绝对百分点还是相对百分比，并报告样本数/置信区间；“最大相对误差低”不能替代任务质量，“平均延迟低”不能替代 P95/P99 SLO。可交付同负载 GPU/NPU 对照、算子问题最小复现、灰度与回滚方案。

## 高频追问

1. **CANN 与 CUDA 的关系？** 职责可类比，API/二进制不同；核具体算子和版本。
2. **PyTorch 迁移要改多少？** 由特性扫描与代表性 POC 决定；标准运算路径和 CUDA 扩展分开估工。
3. **选 MindIE 还是 vLLM-Ascend？** 先过模型、量化、KV、通信和接口门禁，再按同质量同 SLO 压测，不指定普遍首选。
4. **精度不一致怎么排查？** 固定基线→逐层/logits 对齐→定位输入/布局/精度/融合差异→独立任务回归。
5. **NPU 与 H100 差距多大？** 不回答无配置倍率；给目标模型、长度、精度和达标容量的实测。
6. **兼容路线风险是什么？** 兼容边界、库依赖和升级支持不明确；需要固定版本与回滚验证。
7. **最大交付风险是什么？** 只做能启动的 demo，却没有真实任务质量、负载和恢复证据。

正式验收联动 [推理压测](/inference/inference-benchmark) 与 [SLO goodput](/inference/slo-goodput)。本页未运行国产硬件 benchmark，也不确认任何当前采购价格或法规适用性。
