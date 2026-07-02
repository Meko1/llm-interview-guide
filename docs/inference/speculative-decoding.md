# 投机解码（Speculative Decoding）

## 为什么需要投机解码

大模型推理的 decode 阶段是逐 token 自回归，受限于显存带宽（Memory-bound），GPU 算力利用率极低。在长输出或流式场景中，decode 阶段占端到端时间的 **70%–90%**。

投机解码的核心动机：**以更快、成本更低的小模型先行草拟 K 个候选 token，再由大模型一次性验证并批量接纳**，从而将多次 decode 压缩为一次验证前向传播。

## 核心原理

### 草拟-验证机制（Draft-Verify）

```
┌─────────────────────────────────────────────┐
│  阶段一：Draft（草拟）                        │
│  小模型自回归生成 K 个候选 token              │
│  t₁, t₂, t₃, ..., tₖ                       │
├─────────────────────────────────────────────┤
│  阶段二：Verify（验证）                       │
│  大模型一次前向传播并行验证 K 个候选          │
│  逐位比较是否与大模型分布一致                 │
│  找到第一个分歧点 → 丢弃后续 → 回退          │
└─────────────────────────────────────────────┘
```

验证策略保证了数学等价性：投机解码的输出分布与直接使用大模型解码完全一致（无损加速）。

### 接受率与加速收益

- **接受率 α**：小模型生成的 token 被大模型接受的概率
- 加速比 ≈ `1 / (1 - α)` × 开销修正
- 当 `α × K > 1 + ρK`（其中 ρ 为草稿模型相对于目标模型的计算比）时，投机解码带来正收益
- 确定性解码（低温/贪心）场景下 α 更高，加速效果更明显

## 主流算法家族

### 1. 独立草稿模型（Independent Drafting）

使用与目标模型同系列的小模型作为草稿模型。

| 方法 | 思路 | 加速比 |
|------|------|--------|
| DistillSpec | 从目标模型蒸馏出草稿模型 | 2-3× |
| SSD | 从目标模型中自动识别子网络 | 2-2.5× |
| REST | 基于检索的非参数草稿（datastore） | 1.5-2× |

**关键约束**：草稿模型必须与目标模型共享完全相同的词表（vocabulary）。

### 2. Medusa（多头并行预测）

在目标模型主干上附加 K 个 Medusa 头，**并行预测**未来第 1、2、...K 位置的 token：

```
目标模型主干 ──┬── Medusa Head 1 → 预测 t+1
               ├── Medusa Head 2 → 预测 t+2
               ├── Medusa Head 3 → 预测 t+3
               └── ... → 预测 t+K
```

- **Tree Attention**：笛卡尔积形式的候选树，单次前向传播并行验证
- **Medusa-1**：主干冻结，加速 ≥2.2×
- **Medusa-2**：联合微调，加速 2.3–3.6×

### 3. EAGLE 系列（特征层投机）

EAGLE 将投机解码前移至特征层，使用目标模型自身的隐藏特征作为草稿模型输入：

- 草稿模型与目标模型共享 embedding 层与 LM Head
- 仅新增一个轻量级 Auto-regression Head
- EAGLE-2：引入动态草案树（Dynamic Draft Tree），用置信度分数动态剪枝
- **EAGLE-3**（2025 NeurIPS）：加速比约 4.0×（13B），比 EAGLE-1 快 1.4×

### 4. PLD（Prompt Lookup Decoding / N-Gram）

对于输入输出高度重叠的任务（RAG 摘要、翻译等），直接从 prompt 中查找 N-gram 匹配作为候选：

- **零成本**：无需额外模型，即插即用
- 适用场景：RAG 中引用原文、文档摘要、代码补全
- 2026 首选的零开销方案

### 5. AdaSPEC（选择性 token 蒸馏，2026）

- 使用 DistillSpec 框架蒸馏，但引入选择性 token 过滤
- 让草稿模型专注于"容易学习"的 token，避免在困难 token 上浪费容量
- 在所有任务和模型配置下均优于 DistillSpec

## 工程实践要点

### 框架支持

| 框架 | 投机解码支持 | 备注 |
|------|-------------|------|
| vLLM | EAGLE / Medusa / Draft Model | 生产级，推荐 |
| SGLang | EAGLE-3 | 高性能，2026 首选 |
| TensorRT-LLM | Draft Model | NVIDIA 生态 |
| llama.cpp | Speculative Sampling | 端侧部署 |

### 调优建议

1. **选择合适的 K 值**：通常 K=3~5，太大会增加验证开销
2. **监控接受率**：记录 Draft/Verify 各阶段计时、接受率
3. **场景适配**：
   - 确定性输出（代码、JSON）→ α 高，收益大
   - 创意写作（高温度）→ α 低，收益有限
4. **重点监控尾延迟（P95/P99）**，排查收益失常的瓶颈

### 局限性

- **分布偏移（OOD）**：输入属于领域外知识时，小模型预测能力下降，接受率骤降
- **长上下文**：上下文极长时小模型准确度下降
- **高温采样**：温度和 top_p 增大会降低 α
- **额外显存**：需要同时加载草稿模型（或额外头）

## 经典论文

| 论文 | 作者/机构 | 会议 |
|------|-----------|------|
| Fast Inference from Transformers via Speculative Decoding | Leviathan et al., Google | ICML 2023 Oral |
| Accelerating LLM Decoding with Speculative Sampling | Chen et al., DeepMind | 2023 |
| SpecInfer: Tree-based Speculative Inference | Miao et al. | ASPLOS 2024 |
| Medusa: Simple LLM Inference Acceleration | Cai et al. | ICML 2024 |
| EAGLE-3: Scaling up Inference Acceleration | Li et al. | NeurIPS 2025 |

## 高频面试追问

1. **投机解码为什么能做到无损加速？验证阶段的数学保证是什么？**
   - 通过严格的概率校验（rejection sampling），保证输出分布与直接使用大模型解码完全一致

2. **接受率 α 受哪些因素影响？如何提升？**
   - 草稿模型质量、温度设置、领域匹配度；可通过蒸馏/微调提升草稿模型与目标模型的分布对齐

3. **Medusa 和 EAGLE 的核心区别？**
   - Medusa 在 token 层面并行预测，EAGLE 在特征层面自回归预测；EAGLE 加速比更高但需要额外训练

4. **什么时候投机解码反而会变慢？**
   - 当 α 极低（高温+OOD）、草稿模型计算开销过大、或 batch 已经很大（compute-bound）时

5. **生产环境中如何选择投机解码方案？**
   - 有 GPU 余量 → EAGLE-3 + SGLang
   - 高重复度任务（RAG）→ PLD（N-gram）
   - 需要零修改 → REST（检索式）
