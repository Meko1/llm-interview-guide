# 模型架构谱系与选型

> 面试里问“Transformer 有哪些架构”时，不要只报出 BERT、GPT、T5 三个名字。更完整的回答是：先按**信息可见性和训练目标**划分 Encoder-only、Decoder-only、Encoder-Decoder；再解释它们分别擅长表示、生成和条件生成；最后落到今天为什么通用 LLM 几乎都选择 Decoder-only，以及何时不应该盲从这一选择。

## 一、先建立一张架构地图

语言模型的输入是 token 序列，输出可能是一个类别、一个向量、被填空的片段，或一段新的 token 序列。架构选择的本质，是决定每个位置在计算时能看见哪些 token，以及训练时让它预测什么。

| 家族 | 代表 | 可见性 | 常见目标 | 最擅长的任务 | 主要代价 |
| --- | --- | --- | --- | --- | --- |
| Encoder-only | BERT、RoBERTa | 双向，看完整输入 | MLM、对比学习 | 分类、检索、重排、表示学习 | 不能自然自回归长生成 |
| Decoder-only | GPT、Llama、Qwen | 因果，只看左侧 | Next Token Prediction | 对话、代码、通用生成、工具调用 | 长上下文注意力和 KV Cache 成本高 |
| Encoder-Decoder | T5、BART | 编码器双向，解码器因果 | Seq2Seq、去噪 | 翻译、摘要、受控转换 | 两套堆栈，通用规模化生态较弱 |
| Prefix/Infilling | GLM、FIM 代码模型 | 前缀或洞填可见 | Span corruption、FIM | 编辑、补全、中间插入 | 训练和服务模板更复杂 |
| 混合/状态空间 | Jamba、Mamba 混合 | 视模块而定 | 自回归或混合目标 | 超长序列、低内存 | 工具链和经验尚不如 Transformer 成熟 |

这里的“能看见”不是产品权限，而是 attention mask。它决定了位置 `t` 的 hidden state 是否依赖未来位置。因果 mask 把未来分数置为极小值，因此 softmax 后未来位置的权重为零；双向 mask 则允许 token 同时读左右文。

```text
Encoder:  x1 <-> x2 <-> x3 <-> x4
Decoder:  x1 ->  x2 ->  x3 ->  x4
Seq2Seq:  source 全互看  =>  target 从左到右生成，并 cross-attend source
```

## 二、Encoder-only：为什么它仍然没有过时

Encoder-only 模型的目标不是“接着写”，而是得到对整段输入足够有信息量的表示。BERT 的经典训练法是 Masked Language Modeling：把部分 token 替换为特殊标记，再利用左右文还原它。因为预测位置能看见两侧，模型很适合判断一句话整体表达了什么。

### 2.1 表示、池化与向量检索

给定 token hidden states `H = [h_1, ..., h_n]`，下游需要把变长序列压成固定维度向量。常见做法包括：

- 取 `[CLS]` 位置：训练目标显式让该位置汇聚全局信息时可用。
- Mean pooling：对有效 token 求均值；必须排除 padding，否则短文本会被零向量稀释。
- Last-token pooling：更常见于 decoder 型 embedding 模型，但受模板影响。
- 多向量表示：一个文档保留多个 token 向量，查询时做 late interaction，以更高成本换取细粒度匹配。

检索并不等价于“把 BERT 最后一层平均一下”。用于语义检索的 embedding 模型通常还要经过对比学习：让 query 与正样本文档相近、与难负样本远离。若只把分类模型拿来余弦相似度排序，向量空间往往不具备可用的语义几何结构。

### 2.2 面试追问：为什么 BERT 不适合直接聊天

标准 BERT 在预训练时习惯于看到被遮住位置两边的信息；生成第 `t` 个 token 时却没有未来 token 可看，这出现训练和推理的信息不对称。理论上可以迭代填空生成，但每次更新多个 mask 的过程难以像自回归解码那样稳定、流式且高效。因此“BERT 能不能生成”应回答为：可以设计生成式变体，但标准 BERT 的目标与服务路径都不是为开放式逐 token 生成准备的。

## 三、Decoder-only：通用 LLM 的默认答案

Decoder-only 使用联合概率的链式分解：

$$p(x_1,\ldots,x_n)=\prod_{t=1}^{n}p(x_t\mid x_{<t})$$

训练时，整段序列可以并行计算所有位置的 loss；推理时必须按 token 串行采样。这个看似简单的目标拥有极强的统一性：自然语言、代码、JSON、工具调用、图片编码后的离散 token 都可以被写成一个序列。模型只需要继续预测下一个 token，就能把不同任务统一到一个接口。

### 3.1 为什么它能同时做问答、翻译和代码

关键不在于模型“内置了任务开关”，而在于上下文把任务定义写出来。例如：

```text
<system>你是翻译器</system>
<user>把 "good morning" 翻成中文</user>
<assistant>
```

训练数据中大量的文本模式和指令样本，让模型学会把前缀当作条件。in-context learning 便是这种条件化能力的表现：少量示例不更新参数，却通过当前上下文改变下一 token 分布。它不是严格意义上的梯度学习，也不保证可靠；在生产场景仍要用约束、检索、评估和权限控制来补足。

### 3.2 Causal mask 与 KV Cache 的连锁影响

因果生成带来两件工程事实：

1. Prefill 阶段对 prompt 的所有 token 计算 K/V；该阶段可利用矩阵并行，通常关注 TTFT（time to first token）。
2. Decode 阶段每生成一个 token，都要读取历史 K/V 并追加一组新的 K/V；该阶段受内存带宽和批处理策略限制，通常关注每 token 延迟与吞吐。

所以“长 prompt 为什么贵”不能只回答 token 多。长 prompt 会让 prefill 算力增加、attention 矩阵扩大、每层 KV Cache 占用更多显存，也会拖慢后续每一步 decode。详情可串到 [长上下文专题](/basics/long-context) 与 [Attention 与变体](/basics/attention)。

### 3.3 Base 模型、Instruct 模型与 Reasoning 模型

- Base model：主要按自然文本分布续写，适合继续预训练或研究底座能力。
- Instruct/chat model：经 SFT 与偏好对齐，更会遵循消息角色、输出格式和拒绝策略。
- Reasoning model：通常在训练和推理阶段投入更多中间计算、验证或搜索，外在表现不应被简化为“提示词里加一句一步一步想”。

三者的权重、chat template、停止词与采样配置都可能不同。把 base checkpoint 直接套 chat API，或把不同系列的 tokenizer/template 互换，都是常见线上事故来源。

## 四、Encoder-Decoder：条件生成仍然很有价值

Encoder-Decoder 将源序列和目标序列分开处理。Encoder 双向编码源文本；Decoder 自回归生成目标 token，并通过 cross-attention 读取 encoder states。

$$\text{CrossAttention}(Q_{target},K_{source},V_{source})$$

这很符合翻译、摘要、改写等任务的结构：输入是一段完整 source，输出是另一段条件于 source 的序列。相较将 source 与 target 全拼到 decoder-only prompt 中，它的归纳偏置更明确；但需要分别维护 encoder、decoder 与 cross-attention，预训练、服务、社区工具链和超大规模自回归数据复用上不如 decoder-only 统一。

### 4.1 BART、T5 与去噪目标

- BART 会对输入施加删除、打乱、文本填空等噪声，再恢复原文。
- T5 将任务统一写成“text-to-text”，使用 span corruption：把连续片段替换为 sentinel token，目标端按顺序还原缺失片段。

这类目标让模型天然擅长改写和补全。面试中若被问“为什么 T5 不是纯生成模型”，要指出它当然会生成，但生成是以 encoder 对完整输入的表示为条件，而不是只靠前缀自回归地建模一个统一序列。

## 五、代码补全和洞填：FIM 的必要性

普通左到右模型适合在文件末尾续写，却不天然适合在已有前后文之间插入实现。Fill-in-the-Middle（FIM）把原序列切成 prefix、middle、suffix，并重排成可自回归预测的样式：

```text
<fim_prefix> 前缀 <fim_suffix> 后缀 <fim_middle> 中间代码
```

训练过 FIM 的代码模型可以利用函数签名之后的调用方式、测试断言或 closing brace 等右侧信息生成中间部分。它不是 IDE 体验的小花招，而是改变训练样本组织方式来匹配编辑任务分布。面试追问可补充：生产系统还要限制可编辑范围、解析语法树、运行测试、展示 diff，并把“生成了文本”升级为“可验证的变更”。

## 六、混合注意力与状态空间模型：理解而非神化

Transformer 的全注意力对长度为 `n` 的序列会构造或等价处理 `n x n` 交互，长序列时显存与带宽压力显著。状态空间模型（SSM）用递推状态压缩历史信息，理论上可线性扫描；线性注意力、滑动窗口、稀疏注意力则从不同路径降低长序列代价。

混合架构常在部分层使用全局 attention 以保留精确检索能力，在其他层使用 SSM 或局部模块节省成本。评价它们时应看具体 workload：

- 是否需要精确复制远处的字符串、代码符号或引用？全局注意力通常更稳。
- 是不是长传感器流、日志流或固定模式序列？递推模块的线性特性可能更有利。
- 推理是否依赖既有 Transformer 生态、KV Cache、量化和并行实现？迁移成本必须计入。

因此“SSM 会不会取代 Transformer”的好答案是：它解决的是序列效率与归纳偏置的一部分问题，混合架构很可能长期存在；选择应由数据、长度、精度和服务栈共同决定，而不是由单一复杂度公式决定。

## 七、架构选型的决策表

| 业务目标 | 优先模型形态 | 关键验证 | 常见误区 |
| --- | --- | --- | --- |
| 文档相似度、召回、分类 | Encoder embedding/reranker | Recall@K、nDCG、难负例 | 只测余弦分数，不测检索任务 |
| 开放问答、代码助手、工具调用 | Decoder-only instruct | 格式遵循、工具成功率、成本 | 只看榜单，不测真实 prompt |
| 翻译、摘要、字段转换 | Seq2Seq 或受控 decoder | 忠实度、覆盖率、延迟 | 把流畅度误当事实正确 |
| IDE 中间补全 | FIM 代码模型 | 编译、测试、编辑接受率 | 只测文件末尾续写 |
| 超长日志/序列 | 长上下文或混合架构 | 长度分桶、needle、成本 | 用短 benchmark 推断长文本能力 |

## 八、面试高频问答

### Q1：Encoder 和 Decoder 的核心差别是什么？

**答法：**核心是 attention 的可见性与训练目标。Encoder 通常双向读取完整输入，学习适合判别和表示的 contextual embedding；Decoder 用 causal mask，只看历史 token，优化下一个 token 概率，天然支持自回归生成。两者不是“一个编码、一个解码”这么浅，而是信息流不同导致能力和服务方式不同。

### Q2：为什么现在几乎都是 Decoder-only？

**答法：**它把多模态、语言、代码和工具调用统一成序列续写，数据规模容易扩大，训练目标简单且可并行，推理接口也统一。不是说它在每个子任务都最优；检索 embedding、rerank、低延迟分类仍常用 encoder，条件转换任务也可能采用 seq2seq。

### Q3：Decoder-only 训练可并行，为什么生成不能并行？

**答法：**训练时真实后续 token 已知，可以 teacher forcing 一次计算每个位置的 loss；生成时第 `t+1` 个 token 依赖刚刚采样出的第 `t` 个 token，后者未知，所以必须逐步进行。speculative decoding 只能通过草稿模型和验证模型减少等待，不能消除这一因果依赖。

### Q4：如何把架构知识讲成项目亮点？

**答法：**说明决策、证据和边界。例如：“检索层使用双塔 embedding 保障召回，Top-50 后用 cross-encoder reranker 增强精排；回答层采用 instruct decoder，要求引用 chunk id。我们按查询长度分桶观察 prefill 成本，并在事实问答上降低温度。”这比“我们用了 Transformer 和向量库”更可验证。

## 九、复习清单

- 能在白板上画出三类架构的信息流与 mask。
- 能写出 decoder 的概率链式分解，并解释训练/推理不对称。
- 能说明为什么 embedding、reranker、生成模型不必是同一种架构。
- 能从 FIM 解释代码 Agent 为什么需要 diff、编译和测试闭环。
- 能在“更长上下文、更低延迟、更强精确检索”之间讲清取舍。

下一篇建议阅读 [从数据到回答：LLM 全链路](/basics/llm-lifecycle-dataflow)，把架构放回训练、对齐、推理和应用系统中理解。
