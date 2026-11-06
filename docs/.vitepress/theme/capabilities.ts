export type CapabilityId = 'foundations' | 'retrieval' | 'actions' | 'evaluation' | 'serving' | 'adaptation' | 'experiments' | 'contribution'
export type Declaration = 'needs' | 'explain' | 'evidence'
export type GoalId = 'student' | 'backend' | 'application' | 'research' | 'infra' | 'frontier'
export type FoundationId = 'new' | 'api' | 'production'

export interface Capability {
  id: CapabilityId
  title: string
  level: string
  intent: string
  prerequisites: CapabilityId[]
  scenario: string
  checks: string[]
  practice: string
  evidence: string[]
  boundary: string
  readings: { title: string; href: string }[]
}

export const capabilities: Capability[] = [
  { id: 'foundations', title: '模型机制', level: 'L0 → L1', intent: '解释一次生成，先把输入、可见性与输出讲清楚。', prerequisites: [], scenario: '同一句输入，部署结果与训练时不同。你能画出 token 到 logits 的数据流，并指出模板、mask 与位置索引应怎样核查吗？', checks: ['区分 token、向量、logits 和概率。', '分开说明 Attention、FFN 与解码策略。'], practice: '画一张 decoder 数据流图，用固定输入记录 token、mask 与输出形状；标出图中省略的组件。', evidence: ['数据流图与各步张量形状。', '一个固定输入的检查记录，注明配置与假设。', '一个反例：为什么低训练 loss 不代表部署流程正确。'], boundary: '能背组件名或调用 API，不等于能解释模型机制。', readings: [{ title: 'Transformer：交互图解与分层自测', href: '/basics/transformer' }, { title: 'Attention：形状、mask 与数值', href: '/basics/attention' }, { title: '刚入门：前置知识与最小实践', href: '/beginner/getting-started' }] },
  { id: 'retrieval', title: '证据检索', level: 'L1 → L2', intent: '让回答有依据，并定位证据在哪一步丢失。', prerequisites: ['foundations'], scenario: '系统召回了旧版政策，相关性很高，但新版已生效。你会查哪些条件，如何区分检索、上下文与生成错误？', checks: ['检查日期、对象、权限、版本与引用支持。', '区分 Recall、Hit 与最终回答质量。'], practice: '构造一个包含时效冲突、缺证据和跨段问题的小样例集，保存候选、上下文和引用，比较简单检索基线。', evidence: ['问题集与知识快照，注明样例是构造还是实际。', '候选 → 上下文 → 主张支持的分段 trace。', '至少一个失败样例及只改一个变量的对照。'], boundary: '召回数量多、相似度高或有引用，不自动证明回答正确。', readings: [{ title: 'RAG：流程、失败分析与自测', href: '/rag/rag-basics' }, { title: 'RAG 评测：先定义分母', href: '/rag/rag-basics#rag-baseline' }, { title: '长上下文：位置与证据验证', href: '/rag/long-context-validation' }] },
  { id: 'actions', title: '受控行动', level: 'L1 → L2', intent: '区分模型提议与业务执行，让副作用可核查。', prerequisites: ['foundations'], scenario: '创建工单请求超时，但业务端可能已成功。你怎样避免第二次写入，谁负责确认权限与执行结果？', checks: ['区分 schema、参数、授权与业务条件。', '区分成功、明确未执行与结果未知。'], practice: '实现或模拟一个有停止条件的工具流程，注入“写入成功但响应超时”，按稳定操作身份查询或按契约恢复。', evidence: ['工具契约与状态转移图。', '超时恢复的操作记录及业务结果。', '去重保证由谁提供、哪些情况下必须人工核对。'], boundary: '工具 JSON 合法或 checkpoint 存在，不等于业务授权或 exactly-once。', readings: [{ title: 'Agent：控制循环与工具边界', href: '/agent/agent-basics' }, { title: '写操作超时的恢复条件', href: '/agent/agent-basics#agent-recovery' }, { title: '重复试验：成功与可靠的差别', href: '/agent/repeated-trial-evaluation' }] },
  { id: 'evaluation', title: '质量验证', level: 'L1 → L2', intent: '固定基线与条件，解释优化收益和代价。', prerequisites: ['foundations'], scenario: '修改 Prompt 后整体评分更高，但同时换了模型与问题集。你能说明哪个改动有效吗？该如何设计对照？', checks: ['固定问题、证据、模型与评判条件。', '分场景报告失败、质量、延迟与成本，不只看均分。'], practice: '为一个小任务建立冻结样例集、基线与单变量对照；保留失败案例，声明构造样例不能外推生产表现。', evidence: ['版本明确的样例集与评判口径。', '基线/对照表，包含失败与成本记录。', '结论、局限和下一项可能推翻结论的检查。'], boundary: '模型自评、点击量或更漂亮的总结不能替代独立验证。', readings: [{ title: '模型评估与幻觉治理', href: '/evaluation/evaluation' }, { title: 'RAG：分段评测与标注口径', href: '/rag/rag-basics#rag-baseline' }, { title: '校准裁判：覆盖率与人工参照', href: '/evaluation/judge-calibration' }] },
  { id: 'serving', title: '推理预算', level: 'L2 → L3', intent: '分清原始载荷与运行时预算，再测延迟和容量。', prerequisites: ['foundations', 'evaluation'], scenario: 'KV 公式计算后还剩显存，但长输入请求仍 OOM。你还需要核查哪些账本，怎样设置可比较的负载？', checks: ['列清层数、位置、KV 头、维度、精度与单位。', '区分权重、缓存、工作区、调度和真实请求分布。'], practice: '复算一组明确配置的 KV 载荷，再设计固定长度和并发分布的测试；没有硬件实测时明确只交付预算与测试方案。', evidence: ['可复算账本，区分 GB/GiB 与实际假设。', '负载设计、采样方式与瓶颈假设。', '有条件时给实测记录；无条件时标为未实测，不编造吞吐。'], boundary: '原始 KV 数字不是生产并发上限，也不能由公式承诺端到端性能。', readings: [{ title: 'KV Cache：容量与交互复算', href: '/inference/kv-cache' }, { title: '推理服务与部署框架', href: '/inference/serving-frameworks' }, { title: 'SLO 账本：从请求到 goodput', href: '/inference/slo-goodput' }, { title: '投机采样：分布保证与成本', href: '/inference/speculative-sampling-proof' }] },
  { id: 'adaptation', title: '微调与对齐', level: 'L2 → L3', intent: '把训练目标、参数预算与评测条件联系起来。', prerequisites: ['foundations', 'evaluation'], scenario: 'LoRA 适配器很小，DPO loss 也下降了。为什么仍不能说明显存够用、事实性提高或上线安全？', checks: ['分清适配器权重、训练状态与激活。', '分清偏好目标和任务质量，并核查数据条件。'], practice: '复算一个单层 LoRA 账本与一个 DPO 偏好对；制定 held-out 对照，注明代码仅验证代数或是否实际训练。', evidence: ['rank、目标层、缩放和精度明确的账本。', '偏好数据的上下文、模板与有效 token 范围。', '损失变化与独立质量验证分开的结果或实验方案。'], boundary: '参数少不等于总显存小，低偏好损失不等于事实正确。', readings: [{ title: 'LoRA：预算、初始化与自测', href: '/finetuning/lora' }, { title: 'RLHF/DPO：目标、偏好与自测', href: '/finetuning/rlhf' }] },
  { id: 'experiments', title: '对照实验', level: 'L3', intent: '把机制理解变成可复核的实验，而非复述结论。', prerequisites: ['foundations', 'evaluation'], scenario: '论文报告效果提升，同时增加了训练数据与推理预算。你怎样拆分贡献，哪个对照最可能改变结论？', checks: ['记录数据、模型、预算、实现与评审条件。', '区分消融、复现结果与工程外推。'], practice: '选择一个具体机制，写出基线、单变量消融与复现步骤；资源不足时先交付实验方案与代数检查，注明未运行部分。', evidence: ['假设、变量与强基线说明。', '配置、环境、数据版本和运行/未运行状态。', '失败、不确定性与不能由实验支持的结论。'], boundary: '跑通代码或复刻一张图，不自动证明论文贡献被独立复现。', readings: [{ title: '算法与研究路线', href: '/paths/research' }, { title: '训练机制与实验边界', href: '/advanced/training-internals' }, { title: '数据污染：审计与证据边界', href: '/pretraining/contamination-audit' }, { title: '训练预算：条件性最优', href: '/pretraining/compute-budget' }] },
  { id: 'contribution', title: '贡献判断', level: 'L4', intent: '区分新增能力、额外预算和仍未解决的问题。', prerequisites: ['experiments'], scenario: '新方法宣称更强，但使用更多 token、工具和评审预算。你能在相同条件下明确它的增量与代价吗？', checks: ['区分算法、数据、系统实现与训练配方贡献。', '核查公平基线、适用范围与可证伪的下一实验。'], practice: '写一张一手论文卡：问题、增量、证据、代价、边界和下一步；给出一个最可能推翻核心主张的实验。', evidence: ['一手来源及阅读版本，避免只引用二手摘要。', '预算可比较的基线与贡献拆分。', '开放问题和明确的反证实验设计。'], boundary: 'L4 是阅读与判断目标，不是新发布日期、就业等级或站内认证。', readings: [{ title: '前沿阅读与贡献判断', href: '/paths/frontier' }, { title: '一手资料：问题、证据与边界', href: '/advanced/primary-source-reading' }] }
]

export const goals: { id: GoalId; title: string; level: string; focus: string; route: CapabilityId[]; href: string }[] = [
  { id: 'student', title: '在校生 / 初次入门', level: 'L0 → L1', focus: '先讲清机制，再留下一个小应用的证据。', route: ['foundations', 'retrieval', 'evaluation'], href: '/paths/student' },
  { id: 'backend', title: '后端工程师转型', level: 'L1 → L2', focus: '把服务经验接到检索、受控工具与质量门禁。', route: ['foundations', 'retrieval', 'actions', 'evaluation', 'serving'], href: '/paths/backend' },
  { id: 'application', title: 'AI 应用开发', level: 'L1 → L2', focus: '从证据与行动进入失败分析和验证。', route: ['foundations', 'retrieval', 'actions', 'evaluation'], href: '/paths/application' },
  { id: 'research', title: '算法与研究', level: 'L1 → L3', focus: '先固定验证口径，再理解适配目标与实验设计。', route: ['foundations', 'evaluation', 'adaptation', 'experiments'], href: '/paths/research' },
  { id: 'infra', title: '推理与 Infra', level: 'L2 → L3', focus: '资源账本、可比较负载与瓶颈对照。', route: ['foundations', 'evaluation', 'serving', 'experiments'], href: '/paths/infra' },
  { id: 'frontier', title: '前沿贡献判断', level: 'L3 → L4', focus: '从对照能力进入贡献、预算和开放问题判断。', route: ['foundations', 'evaluation', 'experiments', 'contribution'], href: '/paths/frontier' }
]

export const foundations: { id: FoundationId; title: string; note: string }[] = [
  { id: 'new', title: '刚开始理解模型', note: '先从模型机制开始。Python 等前置仍需核查，实践耗时另计。' },
  { id: 'api', title: '能调用 API / 搭建 Demo', note: '把能运行与能解释分开；用情境自查确认已有证据，不自动跳过原理。' },
  { id: 'production', title: '有服务或训练工程经验', note: '工程经验可复用，但不替你证明模型、证据或训练目标已掌握。' }
]

export const declarationOptions: { id: Declaration; title: string }[] = [
  { id: 'needs', title: '需要补齐 / 尚未自查' },
  { id: 'explain', title: '能解释，还缺实践证据' },
  { id: 'evidence', title: '能解释，并可展示证据' }
]

export function getCapability(id: CapabilityId): Capability {
  return capabilities.find(capability => capability.id === id)!
}

export function initialDeclarations(): Record<CapabilityId, Declaration> {
  return Object.fromEntries(capabilities.map(capability => [capability.id, 'needs'])) as Record<CapabilityId, Declaration>
}

export function prerequisiteOrder(id: CapabilityId): CapabilityId[] {
  const ordered: CapabilityId[] = []
  const visit = (target: CapabilityId) => {
    for (const prerequisite of getCapability(target).prerequisites) {
      if (ordered.includes(prerequisite)) continue
      visit(prerequisite)
      ordered.push(prerequisite)
    }
  }
  visit(id)
  return [...new Set(ordered)]
}

export function recommendCapability(goalId: GoalId, declarations: Record<CapabilityId, Declaration>): CapabilityId | undefined {
  const goal = goals.find(goal => goal.id === goalId)!
  for (const id of goal.route) {
    const pending = [...prerequisiteOrder(id), id].find(candidate => declarations[candidate] !== 'evidence')
    if (pending) return pending
  }
  return undefined
}

export function parseMapContext(search: string): { goal: GoalId; foundation: FoundationId } {
  const query = new URLSearchParams(search)
  const goal = goals.find(goal => goal.id === query.get('role'))?.id || 'application'
  const foundation = foundations.find(foundation => foundation.id === query.get('foundation'))?.id || 'api'
  return { goal, foundation }
}
