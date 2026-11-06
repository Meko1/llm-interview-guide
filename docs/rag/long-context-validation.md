---
title: 长上下文验证：位置、干扰与真实任务证据
description: 用固定证据的位置对照、版本冲突、无答案负例和任务切片验证长上下文能力，区分窗口支持、检索成功与业务正确。
level: L2
roles:
  - 应用开发
  - 后端转型
  - 算法研究
  - Infra
classification: inferred
---
# 长上下文验证：位置、干扰与真实任务证据

> **要交付的能力**：解释模型“能接收很多 token”与“能可靠利用其中证据”的区别，设计不被单一大海捞针分数误导的实验。
>
> L1 读三层能力和失败类型；L2 构造位置对照与负例；L3 再核对抽样、任务权重和上下文预算。前置：[长上下文机制](/basics/long-context)、[RAG / 长上下文选型](/rag/rag-vs-long-context)。

## 1. 窗口、有效利用、产品可用是三层问题

| 层次 | 需要检查什么 | 不足以证明什么 |
| --- | --- | --- |
| 能接收 | 请求未被拒绝、实际输入未被截断、输出仍有空间 | 不能证明模型访问了全部信息 |
| 能利用 | 在指定任务、长度、位置与干扰条件下回答正确 | 不能证明任何业务任务都能完成 |
| 产品可用 | 证据有效、权限正确、失败可处理、成本与延迟达标 | 不能仅靠窗口或榜单分数判定 |

Lost in the Middle 在多文档问答和键值检索实验中发现，相关信息的位置会影响论文所测模型的表现；一些条件下中间位置明显弱于首尾。[1] 这是**实验提示的风险**，不是所有模型和所有任务都必然遵循的定律。

RULER 将简单针检索扩展为可配置长度与复杂度的合成任务，并加入多跳与聚合等类别。[2] 一个模型能找出唯一字符串，不等于能比较跨段证据、追踪多步关系或正确总结整份文档。官方仓库提供任务构造与实验入口，但默认分支和结果表可能更新，不把其中历史模型排名当作当前选型建议。[3]

## 2. 先写正确性契约，再选择任务

以“按有效日期回答审批政策”为例，至少检查四种结果：

1. **答案正确**：数值、对象与时间范围满足问题要求。
2. **证据支持**：引用的文档确实支持主张，而不是引用到主题相似的旧版本。
3. **无答案处理**：只有过期证据时，明确说明当前证据不足，而非默认沿用旧结论。
4. **约束合规**：不能输出无权限字段，也不能被文档中的指令改变系统规则。

建议分别记录答案、引用、有效日期和拒绝判断；不要用“答案字符串出现了”代替整个业务契约。对结构化任务可以写确定性验证器，开放式总结则需要人工参照或经校准的裁判，并抽查主张与证据的对应关系。

## 3. 设计矩阵：每次只改变可解释的条件

| 变量 | 对照办法 | 常见误导 |
| --- | --- | --- |
| 输入长度 | 固定核心证据，逐步加入同分布干扰文档 | 长度变了，任务和证据难度也一起变了 |
| 证据位置 | 同一文档集合，把证据置于前、中、后 | 不恢复文档身份，或实际 token 位置并未改变 |
| 干扰类型 | 分开测无关、主题相似、过期版本、恶意指令 | 只用重复无意义文本，任务过于容易 |
| 证据数量 | 单证据、多证据联合、多跳与聚合 | 单针检索分数外推为全文理解能力 |
| 答案存在 | 加入缺证据和冲突未解负例 | 全部问题都有答案，无法识别编造 |
| 问题位置 | 固定或单独对照问题在前/后 | 顺便改变问题位置，无法归因 |

按**最终模型模板的 token 序列**记录证据范围，而不只写“第 50% 个文档”。文档长短不等时，文档序号与 token 百分位可能差很多。

跨模型比较也要报告两种口径的差别：同一原文会因 tokenizer 不同而有不同 token 长度；严格相同 token 预算则可能放入不同原文。不存在一个无需解释、天然公平的长度口径。

## 4. 可运行：位置对照与过期证据负例

下面生成 24 条**构造样例**：两份基础问题，在 12/48/96 个文档条件下各有前、中、后位置对照，以及只留下过期政策的无答案负例。不调用模型，不把文档数当 token 数，不声称复现 RULER。

~~~python
import random
from collections import Counter


def make_case(document_count, position, seed):
    if document_count < 3 or position not in ("front", "middle", "end", "missing"):
        raise ValueError("Invalid document count or position")
    generator = random.Random(seed)
    current_owner = f"reviewer-{generator.getrandbits(32):08x}"
    old = {"id": "policy-old", "text":
           "审批政策：有效期 2024-01-01 至 2024-12-31；复核人 reviewer-old。"}
    current = {"id": "policy-current", "text":
               f"审批政策：有效期 2026-01-01 至 2026-12-31；复核人 {current_owner}。"}
    filler_count = document_count - (1 if position == "missing" else 2)
    others = [old] + [
        {"id": f"note-{index}", "text": f"设备维护记录 {index}；不包含审批复核人规则。"}
        for index in range(filler_count)
    ]
    generator.shuffle(others)
    if position != "missing":
        insert_at = {"front": 0, "middle": document_count // 2,
                     "end": document_count - 1}[position]
        others.insert(insert_at, current)
    expected = ({"status": "supported", "owner": current_owner,
                 "source": "policy-current"} if position != "missing"
                else {"status": "insufficient_evidence", "owner": None, "source": None})
    return {
        "task_group": f"policy-{seed}",
        "condition": f"{document_count}-{position}",
        "documents": others,
        "question": "截至 2026-06-01，审批政策的复核人是谁？请给出支持文档 ID。",
        "expected": expected,
    }


cases = [make_case(count, position, seed)
         for count in (12, 48, 96)
         for seed in (11, 29)
         for position in ("front", "middle", "end", "missing")]
for case in cases:
    count = int(case["condition"].split("-")[0])
    assert len(case["documents"]) == count
    identifiers = [document["id"] for document in case["documents"]]
    assert len(identifiers) == len(set(identifiers))
    assert ("policy-current" in identifiers) == (case["expected"]["status"] == "supported")
print("cases", len(cases))
print("task_groups", len({case["task_group"] for case in cases}))
print("by_status", dict(Counter(case["expected"]["status"] for case in cases)))
assert len(cases) == 24
assert sum(case["expected"]["status"] == "insufficient_evidence" for case in cases) == 6
~~~

应得到 24 条样例、2 个基础任务组、18 条有证据样例和 6 条无当前证据样例。**24 个条件不是 24 个独立基础任务**；这段代码只验证构造口径。真实测试需要更多基础问题、更自然且多样的干扰、实际模板与 tokenizer、独立结果验证。

预期答案单独交给验证器，不放入被测模型上下文。记录实际输入 token 数与证据 token 范围，并检查 API/服务端是否截断。上面的随机身份用于减少常识猜答，但仍不能代表真实政策推理难度。

## 5. 运行和报告：留住失败，不只留下热力图

每条记录至少包含：基础任务 ID、条件、实际 token 数、证据范围、输入与输出配置、模型与模板版本、答案/引用/日期判断、停止原因、耗时和成本。

- **按长度与位置切片**，同时给样本量、有效覆盖、错误和拒绝判断。
- **把最差切片与平均值一起看**。例如三个位置正确率 0.9、0.4、0.9，平均约 0.733，不能据此承诺任意位置都达到 0.7。
- **基础任务等权的宏平均与生产权重分开**。同一问题的多个位置变体需要按任务聚类计算不确定性。
- **区分截断、服务失败、找不到证据、选错版本、答案不支持和错误引用**。不同原因需要不同改进。
- **报告实际终止条件**。输出被 max_tokens 截断，与推理答案错误不是同一失败原因，但都可能导致产品任务未完成。

“有效上下文长度”必须注明任务集、配置、统计方法与阈值。最多可以说“在本测试矩阵与条件下通过”，不能给模型贴一个脱离任务的唯一能力长度。

## 6. 怎样公平比较 RAG、长上下文与混合方案

对同一基础任务、同一有权限证据快照，比较：

| 方案 | 必须留下的独立记录 |
| --- | --- |
| 长上下文 | 实际放入哪些文档、截断、证据位置与生成结果 |
| RAG | 候选召回、重排、进入上下文的证据及生成结果 |
| RAG + 较长片段 | 哪些证据保留了跨段关系，哪些干扰被重新引入 |

分别设置质量约束与预算：最大时延、费用、输入/输出 token 或资源成本；不同方案的检索开销和模型调用都纳入账本。端到端比较之外，可以做“固定生成器、直接提供正确证据”的诊断，识别检索与证据利用的问题。

RAG 不自动保证引用与权限，长上下文也不天然无法做引用与权限过滤。方案优劣取决于实现、任务和预算；[SLO 账本](/inference/slo-goodput)帮助说明性能口径，[裁判校准](/evaluation/judge-calibration)帮助检验开放任务评分。

权限对照应在**进入模型之前**完成：为同一基础问题构造两个用户可见快照，把「另一用户能看到而本用户不能看到」的证据视为不存在。不要先把受限文档放入长上下文，再靠 Prompt 要求模型保密。缓存键与派生摘要需要包含授权范围和版本；测试 ACL 收紧后是否仍返回旧缓存或旧引用。

对 RAG 单独保存权限过滤后的候选、重排结果和实际入模片段，计算证据覆盖；再用「直接提供正确且可见的证据」条件测生成器。前者失败是证据选择问题，后者仍失败是证据利用或回答契约问题。本文构造代码不包含这些服务端 ACL 与真实检索实现，不能据其断言权限安全已验证。

## 7. 面试追问与实践交付

- **单针检索几乎满分，能处理长报告吗？** 不能直接外推，还要测聚合、多证据依赖、干扰、负例与引用支持。
- **把重要文档移到最前面就解决了吗？** 是可测试的诊断或排序策略，不是质量保证；多个重要证据也无法都在首位。
- **换 tokenizer 后长度一样吗？** 文档数、字符数和 token 数不同，应报告实际模板 token 与证据范围。
- **有没有一个统一的有效长度？** 需要任务、阈值、配置与不确定性共同限定。

**最小交付**：位置/长度/干扰矩阵、无答案负例、脱敏输入与结果账本、答案与引用验证器、失败切片以及同预算方案对照。只有构造数据时标“实验设计”，没有真实模型运行不填写模型正确率。

## 一手来源与证据范围

资料核对日期：2026-11-04；核对可检索原论文摘要、任务段落和官方仓库说明，未完成全文复现，也不采用历史榜单给当前模型排名。

1. [Liu 等：Lost in the Middle](https://arxiv.org/abs/2307.03172)：支撑位置对照与论文中多文档问答、键值检索的观察；不证明所有模型具有相同曲线。
2. [Hsieh 等：RULER](https://arxiv.org/abs/2404.06654)：支撑简单针检索不足以覆盖复杂长上下文任务的研究动机。
3. [NVIDIA / RULER 作者仓库](https://github.com/NVIDIA/RULER)：提供可配置合成任务和实验入口；正式运行需固定提交、依赖与配置。

本页政策样例、产品契约和对照矩阵为原创工程整理，不是上述论文的原始实验结果。继续阅读：[一手资料阅读地图](/advanced/primary-source-reading)。
