# 大模型训练全流程（从 0 到 1）

> 「讲一下从零训练一个大模型的完整流程」是综合面试的经典开放题——它考的不是某个点，而是你脑子里有没有一张**端到端的地图**。本文把大模型从数据到上线的全流程串起来，每个阶段标注本站对应的深入章节，帮你建立全局认知后再逐点深挖。

## 面试先背这张流程图

```
① 数据工程 → ② 预训练(Base) → ③ 中期训练/退火 → ④ 有监督微调(SFT)
     → ⑤ 偏好对齐(RLHF/DPO/GRPO) → ⑥ 评估 → ⑦ 压缩量化 → ⑧ 推理部署 → ⑨ 上线运营
```

一句话概括每一环：**数据决定上限，预训练学知识，SFT 学格式，对齐调价值观与能力，评估指方向，压缩降成本，部署保性能，运营做飞轮。**

## 一、数据工程（地基）

数据质量决定模型上限。核心工作（见 [数据工程与合成数据](/pretraining/data-engineering)）：

- **采集与配比**：网页、书籍、代码、论文、多语言……不同来源按比例混合，配比直接影响能力分布。
- **清洗**：去除低质、有害、重复、隐私内容。
- **去重**：MinHash / SimHash 近似去重，去重对质量提升显著。
- **去污染**：剔除测试集内容，避免评测虚高（数据污染，见 [评测基准深入](/evaluation/benchmarks)）。
- **Tokenization**：训练/选择分词器（见 [Tokenizer 与分词](/basics/tokenizer)）。

现代趋势：**合成数据**占比越来越高，用强模型生成高质量训练数据。

## 二、预训练（Base Model）

用海量语料做**自监督**的下一 token 预测，学到世界知识与语言能力（见 [预训练目标与数据](/pretraining/pretrain)）：

- **目标**：Causal LM（decoder-only 主流），最小化交叉熵。
- **规模决策**：按**缩放定律**在「参数量 × 数据量 × 算力」间做最优分配（Chinchilla，见 [缩放定律与涌现能力](/pretraining/scaling-law)）。
- **工程**：分布式并行（DP/TP/PP/ZeRO，见 [分布式训练与显存优化](/pretraining/distributed-training)）+ 集群网络（见 [AI 训练集群与网络通信](/pretraining/ai-infra-networking)）+ 混合精度 + 稳定性保障（见 [训练深入](/advanced/training-internals)）。
- **产物**：Base 模型——知识丰富但不会「听话」，只会续写。

这一步最贵（百万美元~千万美元级），多数团队不做，直接用开源 Base（Qwen/Llama）继续。

## 三、中期训练与退火（Mid-training / Annealing）

预训练后期的进阶技巧（越来越标准化）：

- **学习率退火**：训练末期在高质量数据上降低学习率精调。
- **长上下文扩展**：在长序列数据上继续训练 + 位置编码外推（见 [长上下文专题](/basics/long-context)）。
- **能力增强**：在代码、数学、多语言等特定数据上加训。

## 四、有监督微调（SFT）

把 Base 变成会遵循指令的 Assistant（见 [微调范式（SFT / PEFT）](/finetuning/finetuning)）：

- **数据**：指令-回答对，**质量远比数量重要**（数千条高质量 > 数十万条低质）。
- **方法**：全量微调 or PEFT（LoRA/QLoRA，见 [LoRA / QLoRA 详解](/finetuning/lora)）。
- **作用**：学会回答格式、任务范式，激活预训练已有的知识；**不适合注入大量新事实**（那是 RAG 的活，见 [RAG vs 长上下文 vs 微调](/rag/rag-vs-long-context)）。
- **工具链**：LLaMA-Factory / TRL / Unsloth（见 [微调训练工具链实战](/finetuning/training-frameworks)）。

## 五、偏好对齐（Alignment）

让输出对齐人类偏好、更有用更安全、并提升推理能力（见 [RLHF / DPO 对齐](/finetuning/rlhf)、[偏好优化方法全景](/finetuning/preference-optimization)）：

- **RLHF（PPO）**：训奖励模型 + 强化学习优化，经典但复杂、不稳定。
- **DPO**：直接从偏好对优化，无需奖励模型，简单稳定，做聊天模型主流。
- **GRPO / 可验证奖励**：DeepSeek-R1 路线，用于**推理模型**（数学/代码有明确对错），是当前热点（见 [推理模型与慢思考](/advanced/reasoning-models)、[强化学习基础](/advanced/rl-basics)）。

## 六、评估（贯穿全程）

没有评估就没有方向（见 [模型评估与幻觉](/evaluation/evaluation)、[评测基准深入](/evaluation/benchmarks)）：

- **自动基准**：MMLU/CMMLU/C-Eval（知识）、GSM8K/MATH（数学）、HumanEval（代码）。
- **人类评估 / Arena**：主观质量、对战 Elo。
- **注意数据污染与刷榜**：榜单高≠真实能力好。
- Agent/RAG 有专门评估（见 [Agent 评估与可靠性工程](/agent/agent-evaluation)、[RAG 评估](/rag/rag-evaluation)）。

## 七、压缩与量化（降成本）

上线前把模型压小压快（见 [量化实战深入](/inference/quantization)、[知识蒸馏与模型压缩](/inference/model-compression)）：

- **量化**：W4A16（省显存）/ W8A8（提吞吐）/ FP8。
- **蒸馏**：大模型教小模型，得到更小的部署模型。
- **剪枝**：去掉冗余权重/结构。

## 八、推理部署（保性能）

把模型变成能扛流量的服务（见 [推理优化与部署](/inference/inference-optimization)、[推理框架对比](/inference/serving-frameworks)、[推理性能压测与指标](/inference/inference-benchmark)）：

- **框架**：vLLM / SGLang / TensorRT-LLM，用连续批处理、PagedAttention 提吞吐。
- **优化**：KV Cache 管理、投机解码（见 [投机解码详解](/inference/speculative-decoding)）、Prefill/Decode 分离。
- **国产化**：昇腾 MindIE 等（见 [国产算力与国产化适配](/inference/domestic-ai-stack)）。
- **指标**：TTFT/TPOT/goodput，在 SLA 内压最大吞吐、最低成本。

## 九、上线运营（数据飞轮）

上线不是终点（见 [LLMOps 生产运营](/engineering/llmops)）：

- **监控**：质量、成本、延迟、用户反馈。
- **数据飞轮**：线上 badcase → 回灌训练/评估集 → 迭代 → 再上线。
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
3. **知识应该在哪一步注入？** 世界知识靠预训练；SFT 只激活已有知识+学格式，不宜灌新事实；时效性知识用 RAG。
4. **RLHF、DPO、GRPO 什么关系？** 都是偏好对齐：PPO 经典复杂，DPO 简单稳定做聊天，GRPO+可验证奖励做推理模型（R1 路线）。
5. **缩放定律在流程里起什么作用？** 指导预训练阶段在参数量/数据量/算力预算间做最优分配（Chinchilla 最优）。
6. **大部分团队会做哪几步？** 极少从头预训练；主流是拿开源 Base 做 SFT/LoRA + 对齐 + RAG/Agent + 部署运营。
7. **评估为什么要贯穿全程？** 每个阶段都要用评估指方向、防退化；且要警惕数据污染与刷榜导致的虚高。
