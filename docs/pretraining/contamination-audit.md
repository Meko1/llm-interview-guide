---
title: 数据污染审计：重叠、泄漏与黑盒检验的证据边界
description: 区分文本重叠、训练泄漏和分数影响，构造可复查的 n-gram 候选账本，并解释黑盒顺序检验的假设、p 值和局限。
level: L2
roles:
  - 算法研究
  - 应用开发
  - 后端转型
classification: inferred
---
# 数据污染审计：重叠、泄漏与黑盒检验的证据边界

> **要交付的能力**：面对“检测到重复”或“模型分数很高”，能说明证据支持到哪一层，而不是直接宣判模型背题或完全没有污染。
>
> L1 读三层证据与失败类型；L2 跑通候选检测账本；L3 检查黑盒统计检验、假设与多重比较。前置：[数据工程](/pretraining/data-engineering)、[评测基准](/evaluation/benchmarks)。

## 1. 三个命题，不能互相替代

| 命题 | 需要什么证据 | 单凭什么还不够 |
| --- | --- | --- |
| 存在文本重叠 | 原始文本、匹配范围、规范化与检测规则 | 短公共短语不一定是题目泄漏 |
| 评测内容进入模型训练或调优流程 | 实际使用的数据快照、血缘或有条件的统计证据 | 网上存在同一文本不等于它被训练使用 |
| 泄漏影响了评测成绩或泛化判断 | 可比较对照、任务分析与不确定性 | 高分或改写后掉分都可能有其他原因 |

论文中的黑盒污染检验提供了一条特定的证据路径：在可交换数据和模型/测试集独立等零假设条件下，比较原始样本顺序与打乱顺序的似然。[1] 它不是不需要假设的“背题检测器”。

也不要把污染简化成“真实能力不变”。训练数据重叠可能伴随学习、记忆和分布适配；关键问题是**这个评测是否仍能作为独立泛化证据**，以及观测成绩对目标任务意味着什么。

## 2. 审计范围包括训练，也包括评测过程本身

- **预训练泄漏**：测试题、答案或同源文档进入训练语料。
- **SFT / 偏好 / 合成数据泄漏**：生成器或标注流程把公开测试题带入后续调优。
- **开发集过拟合**：反复根据测试成绩挑 Prompt、模型或超参数，再把该测试当独立结果。
- **运行时取答案**：评测允许检索或工具，意外检索到答案页、题解或测试输出。
- **跨集近重复**：同一问题的改写、翻译、模板变体或同源记录跨训练/验证/测试集。

这些风险的处理不同。若 benchmark 本来允许检索，检索到相关原始事实不一定违规；要先写清评测是否允许答案库、联网、工具和人工介入。运行时信息访问也不能直接归因为预训练污染。

## 3. 可见语料：先找候选，再做人工归因

| 方法 | 能发现什么 | 可能漏掉或误伤什么 |
| --- | --- | --- |
| 精确文本 / 哈希 | 完全重复与确定规范化后的重复 | 改写、翻译；规范化可能丢失语义 |
| n-gram / 最长公共片段 | 局部复制和模板相似 | 公共短语误报；语义改写漏报 |
| MinHash 等近重复筛选 | 大规模集合相似候选 | 参数、长度和分词影响召回与精度 |
| 向量相似候选 | 语义邻近问题或答案 | 主题相关不等于泄漏，需回看原文 |
| 来源与时间血缘 | 同源版本、题库镜像、实际使用链路 | 缺失记录时不能证明未使用 |

问题、参考答案、选项、解释和来源文档分别检测。只看题干可能漏掉答案暴露；一个常见短答案出现在语料里也不能直接证明题目泄漏。审计应同时保留原文和匹配依据，不用规范化文本覆盖原始快照。

**去重不等于去污染**：训练语料内部去重解决冗余，训练集与冻结评测集的交叉审计解决独立性风险。两者可共享工具，但目标不同。

## 4. 可运行：保存 n-gram 命中的候选位置

下面使用简化英文分词和三词片段，构造“明确重复”“公共题型短语”“语义改写”三种候选。**n=3 是教学参数，不是推荐生产阈值；示例不是泄漏判决器。**

~~~python
import re
import unicodedata

query = "Which access level is required to approve a payment"
reference = "approval requires a finance administrator"
corpus = {
    "copied_pair": query + " Answer: " + reference,
    "shared_template": "Which access level is required to view a dashboard?",
    "paraphrase": "Only an admin from the finance team may authorize the transfer.",
}


def tokenize(text):
    normalized = unicodedata.normalize("NFKC", text).casefold()
    return re.findall(r"[a-z0-9]+", normalized)


def windows(tokens, width):
    if width < 1:
        raise ValueError("Width must be positive")
    return [(index, tuple(tokens[index:index + width]))
            for index in range(len(tokens) - width + 1)]


def overlap_locations(target, document, width):
    target_fragments = {fragment for index, fragment in windows(tokenize(target), width)}
    return [(index, " ".join(fragment))
            for index, fragment in windows(tokenize(document), width)
            if fragment in target_fragments]


rows = []
for document_id, document in corpus.items():
    question_hits = overlap_locations(query, document, 3)
    answer_hits = overlap_locations(reference, document, 3)
    row = {"document_id": document_id, "question_hits": question_hits,
           "answer_hits": answer_hits, "needs_review": bool(question_hits or answer_hits)}
    rows.append(row)
    print(row)

assert rows[0]["question_hits"] and rows[0]["answer_hits"]
assert rows[1]["question_hits"] and not rows[1]["answer_hits"]
assert not rows[2]["question_hits"] and not rows[2]["answer_hits"]
assert overlap_locations("a b", "a b", 3) == []
~~~

应看到：复制样例同时命中问题与答案；公共模板只命中题干片段；语义改写没有三词重叠。**没有命中不代表没有语义泄漏，有命中不代表实际训练使用。** 这里的 index 是规范化后 token 索引，不是原文字节或字符偏移。

真实工具还需要：语言合适的分词、原文偏移映射、长度与公共片段过滤、候选检索索引、快照 ID、来源、实际使用记录以及人工结论。示例分词只处理英文与数字，不能原样用于中文、代码或多语种审计。

## 5. 黑盒检验：需要的是条件与似然，不只是聊天接口

Oren 等的方法利用**样本顺序可交换**这一性质：在零假设下，测试集原始顺序不应系统性地比随机顺序更受模型偏好。[1] 作者仓库提供分片比较检验的实现与实验数据入口。[2]

执行前要检查：

1. **可交换性**：样本是否可任意打乱？按章节、时间、难度或对话顺序排列的序列可能天然不满足。
2. **模型与测试独立性假设**：零假设、数据抽样与固定模型之间的关系是否满足论文条件？
3. **似然查询能力**：能否对指定文本计算模型对数概率？仅返回生成文本的 API 不足够，生成 token 的 logprobs 也不一定支持对任意输入序列评分。
4. **序列化与长度控制**：拼接格式、截断、上下文、分片和分词一致，否则顺序效应可能来自实现。
5. **检测能力与适用范围**：检验没有显著结果，可能是泄漏弱、样本少、只见过改写或模型不记顺序，不能推断没有污染。

若题库原本按相关主题排序，顺序偏好可能来自自然文本结构。不能跳过假设检查，直接把“原顺序似然更高”当作事实判决。

### L3：可运行的置换 p 值分辨率演示

下面只演示常见 Monte Carlo 排名计数，**不是作者分片检验的复现，也没有调用模型计算似然**。分数全部人为构造；较大分数表示原顺序更受偏好。

~~~python
def monte_carlo_upper_tail(original_score, shuffled_scores):
    if not shuffled_scores:
        raise ValueError("At least one permutation is required")
    extreme = sum(score >= original_score for score in shuffled_scores)
    return (1 + extreme) / (1 + len(shuffled_scores))


print("nine_permutations", monte_carlo_upper_tail(-5, [-10] * 9))
print("ninety_nine_permutations", monte_carlo_upper_tail(-5, [-10] * 99))
print("all_tied", monte_carlo_upper_tail(-5, [-5] * 9))
assert monte_carlo_upper_tail(-5, [-10] * 9) == 0.1
assert monte_carlo_upper_tail(-5, [-10] * 99) == 0.01
assert monte_carlo_upper_tail(-5, [-5] * 9) == 1.0
~~~

该教学计数采用“原结果 + 随机置换”的加一形式，并将并列分数纳入上尾，避免用有限置换报 p=0。9 次置换时最小值是 0.1，99 次时是 0.01。其统计解释依赖有效的置换设计，代码不能为不满足可交换性的语料提供保证。

**p=0.01 不是“模型有 99% 概率污染”**。它衡量零假设与检验设计下的尾部事件，不是污染的后验概率。若同时检验很多数据集或反复试参数再只报最小值，还要处理多重比较与选择偏差；例如 10 项预先指定检验采用 Bonferroni 时，0.05 的总体水平对应每项 0.005，而不是每项仍用 0.05。

## 6. 用什么报告，才能不把不确定性藏起来

| 报告字段 | 要写清什么 |
| --- | --- |
| 审计对象 | 模型/语料/数据集/评测运行的版本与快照 |
| 可见范围 | 哪些训练阶段和数据源能查看，哪些未知 |
| 检测规则 | 规范化、分词、n、相似阈值、长度过滤与检索范围 |
| 候选账本 | 原文位置、匹配片段、问题/答案/解释分别命中 |
| 人工归因 | 模板相似、同源、确切复制、语义近似或无法判断 |
| 统计检验 | 零假设、可交换性、评分实现、置换/分片、种子、检验数量 |
| 实际处理 | 隔离或剔除规则、处理量、重跑条件与保留的未知风险 |

清理后的数据也可能缺乏代表性。不要为了“零命中”删掉大量合法同领域样本却不报告变化；评测题若反复用于开发，即使语料不重叠，也不应再宣称它完全独立。

## 7. 私有集、新题与改写：更有用，但不是免疫

- **私有集**：减少公开暴露风险，但需要权限、版本和开发/测试隔离，不能一边用于调参一边作为最终证据。
- **新构造题**：可降低某些直接复制风险，但底层模板、源文档和答案可能仍在训练分布中。
- **改写/翻译对照**：帮助诊断敏感性；掉分也可能来自难度、歧义、格式、语言能力或评分变化，不能唯一归因为背题。
- **训练截止日期**：可以限定部分时间风险，不是数据血缘证明，尤其不能自动覆盖后训练、检索和工具访问。

如果能控制训练，可预先设计泄漏剂量、基线模型和清洁测试的对照；如果只有封闭模型 API，就诚实报告可见范围、间接证据与未知条件，而不是制造确定性。

## 8. 面试追问与实践产出

- **n-gram 没匹配，是不是已经去污染？** 只能说明在给定快照与规则下未命中；改写、翻译、不可见数据仍可能漏检。
- **知道一道题答案，就证明背过测试集吗？** 不能；还可能是学习到的事实、推理或运行时检索。
- **黑盒可以保证识别所有污染吗？** 不能；检验保证和检测能力都需要特定条件，未显著不等于不存在。
- **怎样说清一项审计的价值？** 交付范围、匹配账本、归因、处理与独立验证，而不是一句“完全干净”。

**最小交付**：冻结评测快照、交叉候选账本、原文归因与未知范围、清理规则、重跑记录。统计检验未执行时标为实验设计，构造演示不得写成模型污染结论。

## 一手来源与证据范围

资料核对日期：2026-11-04；核对论文关于可交换性、原始/随机顺序比较与检验局限的可检索段落，以及作者仓库说明。未运行真实模型污染检验。

1. [Oren 等：Proving Test Set Contamination in Black Box Language Models](https://arxiv.org/abs/2310.17623)：支撑特定零假设与条件下的顺序检验思路，不证明无条件识别所有污染。
2. [tatsu-lab 作者实现](https://github.com/tatsu-lab/test_set_contamination)：提供分片比较检验和实验入口；默认分支会变，正式复现需固定提交并核查入口文件。README 的入口说明与示例命令文件名存在不一致，不能直接把示例当作已跑通命令；先核对仓库文件与参数，再记录实际运行版本。

本页 n-gram 账本与置换计数为教学整理，不是原论文实验。继续阅读：[一手资料阅读地图](/advanced/primary-source-reading)。
