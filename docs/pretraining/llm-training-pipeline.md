---
title: 大模型训练全流程（从 0 到 1）
description: >-
  「讲一下从零训练一个大模型的完整流程」是综合面试的经典开放题——它考的不是某个点，而是你脑子里有没有一张端到端的地图。本文把大模型从数据到上线的全流程串起来，每个阶段标注本站对应的深入章节，帮你建立全局认知后再逐点深挖。
level: L3
roles:
  - 算法研究
  - Infra
classification: inferred
---
# 大模型训练全流程（从 0 到 1）

> 「讲一下从零训练一个大模型的完整流程」是综合面试的经典开放题——它考的不是某个点，而是你脑子里有没有一张**端到端的地图**。本文把大模型从数据到上线的全流程串起来，每个阶段标注本站对应的深入章节，帮你建立全局认知后再逐点深挖。

## 面试先背这张流程图

```
① 数据工程 → ② 预训练(Base) → ③ 中期训练/退火 → ④ 有监督微调(SFT)
     → ⑤ 偏好对齐(RLHF/DPO/GRPO) → ⑥ 评估 → ⑦ 压缩量化 → ⑧ 推理部署 → ⑨ 上线运营
```

这张图是交付顺序，不是能力的严格分工：预训练、SFT 和奖励优化都可能改变知识与行为；评估贯穿全程，压缩和偏好优化也不一定是每个项目的必选步骤。

先决定“从零训练、继续预训练还是直接部署已有模型”。把许可可用数据、训练算力/截止时间、质量门槛与长期推理需求放在同一决策表中，预算推导见 [训练预算](/pretraining/compute-budget)。不能因为流程完整就默认每步都做。

## 一、数据工程（地基）

数据质量决定模型上限。核心工作（见 [数据工程与合成数据](/pretraining/data-engineering)）：

- **采集与配比**：网页、书籍、代码、论文、多语言……不同来源按比例混合，配比直接影响能力分布。
- **清洗**：去除低质、有害、重复、隐私内容。
- **去重**：MinHash / SimHash 近似去重，去重对质量提升显著。
- **去污染**：冻结评测集后审计题干、答案、解释和同源变体；未命中不等于无污染，详见 [污染审计](/pretraining/contamination-audit) 与 [评测基准深入](/evaluation/benchmarks)。
- **Tokenization**：训练/选择分词器（见 [Tokenizer 与分词](/basics/tokenizer)）。

合成数据可补任务覆盖，但强模型生成不保证正确；保留生成与验证轨迹，并检查教师/提示是否接触评测集。

## 二、预训练（Base Model）

用海量语料做**自监督**的下一 token 预测，学到世界知识与语言能力（见 [预训练目标与数据](/pretraining/pretrain)）：

- **目标**：Causal LM（decoder-only 主流），最小化交叉熵。
- **规模决策**：按**缩放定律**在「参数量 × 数据量 × 算力」间做最优分配（Chinchilla，见 [缩放定律与涌现能力](/pretraining/scaling-law)）。
- **工程**：分布式并行（DP/TP/PP/ZeRO，见 [分布式训练与显存优化](/pretraining/distributed-training)）+ 集群网络（见 [AI 训练集群与网络通信](/pretraining/ai-infra-networking)）+ 混合精度 + 稳定性保障（见 [训练深入](/advanced/training-internals)）。
- **产物**：Base 模型以续写目标训练，可能具备上下文指令能力，但不能默认满足稳定指令遵循和产品安全约束。

是否从头预训练取决于目标、许可、数据与预算。训练 FLOPs 不是租卡报价；还需有效算力、调参、数据处理、失败恢复与服务成本，不在缺配置时给出美元范围。

## 三、中期训练与退火（Mid-training / Annealing）

预训练后期的进阶技巧（越来越标准化）：

- **学习率退火**：训练末期在高质量数据上降低学习率精调。
- **长上下文扩展**：在长序列数据上继续训练 + 位置编码外推（见 [长上下文专题](/basics/long-context)）。
- **能力增强**：在代码、数学、多语言等特定数据上加训。

## 四、有监督微调（SFT）

把 Base 变成会遵循指令的 Assistant（见 [微调范式（SFT / PEFT）](/finetuning/finetuning)）：

- **数据**：指令-回答对；先检查质量、任务覆盖与基座能力，再用扩量曲线决定规模，不用固定条数比较承诺效果。
- **方法**：全量微调 or PEFT（LoRA/QLoRA，见 [LoRA / QLoRA 详解](/finetuning/lora)）。
- **作用**：改变指令行为、格式与技能，也可能学习事实；时效性、可追溯知识通常值得比较 RAG，但不是“SFT 不能学新知识”，见 [RAG vs 长上下文 vs 微调](/rag/rag-vs-long-context)。
- **工具链**：LLaMA-Factory / TRL / Unsloth（见 [微调训练工具链实战](/finetuning/training-frameworks)）。

## 五、偏好对齐（Alignment）

让输出对齐人类偏好、更有用更安全、并提升推理能力（见 [RLHF / DPO 对齐](/finetuning/rlhf)、[偏好优化方法全景](/finetuning/preference-optimization)）：

- **RLHF（PPO）**：训奖励模型 + 强化学习优化，经典但复杂、不稳定。
- **DPO**：常用形式直接从偏好对与参考模型计算损失，无需单独训练标量奖励模型；仍有数据质量、参考策略和训练稳定性约束。
- **GRPO / 可验证奖励**：GRPO 是策略优化方法，可验证奖励是反馈设计，二者不是同义词，也不必都是人类偏好对齐。DeepSeek-R1 是具体应用路线，见 [推理模型与慢思考](/advanced/reasoning-models)、[强化学习基础](/advanced/rl-basics)。

## 六、评估（贯穿全程）

没有评估就没有方向（见 [模型评估与幻觉](/evaluation/evaluation)、[评测基准深入](/evaluation/benchmarks)）：

- **自动基准**：MMLU/CMMLU/C-Eval（知识）、GSM8K/MATH（数学）、HumanEval（代码）。
- **人类评估 / Arena**：主观质量、对战 Elo。
- **注意数据污染与刷榜**：榜单高≠真实能力好。
- Agent/RAG 有专门评估（见 [Agent 评估与可靠性工程](/agent/agent-evaluation)、[RAG 评估](/rag/rag-evaluation)）。

## 七、压缩与量化（降成本）

上线前把模型压小压快（见 [量化实战深入](/inference/quantization)、[知识蒸馏与模型压缩](/inference/model-compression)）：

- **量化**：W4A16 / W8A8 / FP8；省内存和提速需分别验收，实际收益依赖硬件 kernel、batch 与误差门禁。
- **蒸馏**：大模型教小模型，得到更小的部署模型。
- **剪枝**：去掉冗余权重/结构。

## 八、推理部署（保性能）

把模型变成能扛流量的服务（见 [推理优化与部署](/inference/inference-optimization)、[推理框架对比](/inference/serving-frameworks)、[推理性能压测与指标](/inference/inference-benchmark)）：

- **框架**：vLLM / SGLang / TensorRT-LLM，用连续批处理、PagedAttention 提吞吐。
- **优化**：KV Cache 管理、投机解码（见 [投机解码详解](/inference/speculative-decoding)）、Prefill/Decode 分离。
- **国产化**：昇腾 MindIE 等（见 [国产算力与国产化适配](/inference/domestic-ai-stack)）。
- **指标**：分别制定 TTFT、逐 token 延迟和完成时限 SLO；goodput 只计达标请求，SLA 是服务约定，不是吞吐指标。

## 九、上线运营（数据飞轮）

上线不是终点（见 [LLMOps 生产运营](/engineering/llmops)）：

- **监控**：质量、成本、延迟、用户反馈。
- **数据闭环**：线上 badcase 经权限、脱敏与归因后进入训练或开发集；最终测试集独立冻结，不能将同一 badcase 同时训练又作为泛化成绩。
- **持续对齐**：安全、合规、护栏（见 [大模型安全与对齐](/advanced/safety)、[AI 安全合规与治理](/advanced/governance)）。

## 十、不同角色的「参与深度」

面试时按岗位说清你在哪一环最深：

| 岗位 | 主战场 |
| --- | --- |
| 预训练/算法 | ①②③ + ⑤（RL 方向） |
| 微调/对齐 | ④⑤⑥ |
| 推理/工程 | ⑦⑧ + 性能 |
| 应用/RAG-Agent | ⑧⑨ + 上层应用（不训模型，用好模型） |
| 数据工程 | ① + 合成数据 + 评估集 |

> 大多数工程师（尤其后端转型）主战场在 **⑧⑨ + 应用层**：用开源 Base + SFT/LoRA + RAG/Agent 落地，而非从头预训练。想清楚自己的定位，比样样都背更重要。

## 高频追问

1. **完整讲一下从 0 训练大模型的流程？** 数据工程→预训练→中期训练→SFT→偏好对齐→评估→压缩→部署→运营；一句话点出每环作用。
2. **预训练、SFT、对齐分别学到什么？** 预训练学知识与语言能力，SFT 学指令遵循与格式，对齐调价值观/安全并提升有用性与推理。
3. **知识应该在哪一步注入？** 比较继续预训练、SFT、检索的更新成本、引用要求与遗忘风险；不是每种能力只有唯一训练阶段。
4. **RLHF、DPO、GRPO 什么关系？** 区分偏好反馈、目标函数与策略优化器，GRPO 可以使用可验证奖励而非人类偏好。
5. **缩放定律在流程里起什么作用？** 指导预训练阶段在参数量/数据量/算力预算间做最优分配（Chinchilla 最优）。
6. **大部分团队会做哪几步？** 极少从头预训练；主流是拿开源 Base 做 SFT/LoRA + 对齐 + RAG/Agent + 部署运营。
7. **评估为什么要贯穿全程？** 每个阶段都要用评估指方向、防退化；且要警惕数据污染与刷榜导致的虚高。

## 每阶段必须留下的交接物

| 阶段 | 进入下一阶段之前的证据 |
| --- | --- |
| 数据/预训练 | 数据与 tokenizer 快照、处理 token、独立 loss/任务切片、稳定性与预算 |
| 训练恢复 | 模型/优化器/调度器/RNG/游标一致提交；恢复后曲线与重复/跳过数据检查 |
| 后训练 | 提示/采样/奖励配置、训练与评测隔离、行为改善及安全/通用能力回归 |
| 量化/部署 | 精度质量对照、实际硬件版本、prefill/decode 延迟、负载与 SLO goodput |
| 运营 | 灰度/回滚条件、失败样本归因、隐私权限与测试集冻结规则 |

流程机制例可对照 [DeepSeek-V3 技术报告](https://arxiv.org/html/2412.19437v2)：它同时描述预训练、后训练与推理工程，具体配方不是通用流程标准。恢复启动器边界见 [PyTorch v2.5.1 官方 run.py](https://github.com/pytorch/pytorch/blob/v2.5.1/torch/distributed/run.py)：worker 重启后仍需应用加载 checkpoint。
