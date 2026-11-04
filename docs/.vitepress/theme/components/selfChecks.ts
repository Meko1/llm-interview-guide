export type LessonKind = 'transformer' | 'attention' | 'kv' | 'rag' | 'agent' | 'lora' | 'dpo'

export interface SelfCheck {
  level: 'L1' | 'L2' | 'L3'
  focus: string
  question: string
  answer: string
  evidence: string[]
  pitfall: string
  href: string
  reference: string
}

export const selfChecks: Record<LessonKind, SelfCheck[]> = {
  transformer: [
    { level: 'L1', focus: '数据流', question: '从 token ID 到下一 token，哪些组件负责什么？', answer: 'Embedding 把 ID 映射为向量；Attention 聚合可见位置的信息；FFN 逐位置变换特征。经过模型后续层与输出头得到词表 logits，再由解码策略选择下一 token。图解省略了残差与归一化等路径。', evidence: ['区分 token ID、向量、logits 与概率。', '解释 Attention 的跨位置交互与 FFN 的逐位置变换。'], pitfall: '不要把 logits 当作已经归一化的概率，也不要把教学图中的一个 block 当作完整模型。', href: '/basics/transformer#阅读目标-从组件名走向数据流', reference: '阅读目标：从组件名走向数据流' },
    { level: 'L2', focus: '排障', question: '训练 loss 很低，部署生成却很差，先查什么？', answer: '先核查 target shift、因果 mask、数据泄漏和训练/推理模板是否一致，再用可复现样例定位变化发生在哪个环节。低训练 loss 不能单独证明生成流程正确。', evidence: ['列出至少两个训练与部署之间的契约边界。', '提出固定输入、逐项对照的检查，而不只是更换模型。'], pitfall: '不要从低训练 loss 直接推导模型能力好，也不要在排除流程问题前归因于模型规模。', href: '/basics/transformer#失败案例-训练看似正常-生成却不正常', reference: '失败案例：训练看似正常，生成却不正常' },
    { level: 'L3', focus: '成本', question: '序列长度翻倍，单层参数和注意力计算会怎样变化？', answer: '固定 batch 与隐藏维度、采用密集 MHA 和两层线性 FFN 时，权重参数量不随序列长度改变；投影与 FFN 的主要算术量约翻倍，注意力核心的两次矩阵乘约变为四倍。实际耗时还受算子、带宽与调度影响。', evidence: ['明确固定 batch、隐藏维度与层结构。', '区分参数量、线性长度项、平方长度项与端到端耗时。'], pitfall: '不要把某一项的四倍算术量写成完整服务耗时必然四倍。', href: '/basics/transformer#工程走查-同一层里有两类不同的成本', reference: '工程走查：同一层里有两类不同的成本' }
  ],
  attention: [
    { level: 'L1', focus: '可见性', question: '为什么因果 Attention 中，未来 token 的权重应为零？', answer: '自回归预测只能使用当前位置及之前的可见信息。因果 mask 在 softmax 前屏蔽未来位置，使它们不参与权重归一化；padding mask 处理的是无效填充位置，职责不同。', evidence: ['说明 mask 应作用于 softmax 前的分数。', '区分因果约束与 padding 的有效位置约束。'], pitfall: '不能只在 softmax 后把未来项清零却不重新处理归一化，也不能将 padding mask 当作因果 mask。', href: '/basics/attention#工程失败-mask-错误比公式背错更难发现', reference: '工程失败：mask 错误比公式背错更难发现' },
    { level: 'L2', focus: '选型', question: 'FlashAttention 与 GQA 是在解决同一个预算问题吗？', answer: 'FlashAttention 主要改变注意力的执行与 IO 组织，避免物化完整中间矩阵；GQA 通过共享 KV 头改变模型结构与标准 KV 载荷。两者应按瓶颈分别评估，不能互相替代指标。', evidence: ['分别说明执行/IO 优化与 KV 头结构优化。', '对照训练中间量与推理 KV Cache 两类预算。'], pitfall: '不要把 FlashAttention 说成把密集注意力算术复杂度普遍变为线性，也不要承诺 GQA 在所有任务上无质量代价。', href: '/basics/attention#方案选择-不把所有优化混为一谈', reference: '方案选择，不把所有优化混为一谈' },
    { level: 'L3', focus: '数值', question: '为什么点积分数除以 sqrt(d_k)，而不是凭经验选一个常数？', answer: '在各维零均值、单位方差且近似独立的教学假设下，Q 与 K 点积的方差随 d_k 增长。除以 sqrt(d_k) 使缩放后方差约为常数量级，缓解过大的分数使 softmax 饱和的问题。真实激活不一定满足这些假设。', evidence: ['给出方差随维度增长的假设与数量级。', '说明缩放针对分数尺度与 softmax，而不是改变可见性。'], pitfall: '这是假设下的解释，不是所有真实模型中方差恰好为一的保证。', href: '/basics/transformer#为什么除以-sqrt-d-k-方差而不是记忆题', reference: 'Transformer：为什么除以 sqrt(d_k)' }
  ],
  kv: [
    { level: 'L1', focus: '复用', question: '为什么未来解码通常复用历史 K/V，而不是历史 Q？', answer: '历史位置的 Query 输出已经计算过。新位置的 Query 需要与历史 Key 计算分数，再聚合历史 Value；标准增量解码因此保留可供未来位置复用的 K/V，不需要为了这个用途持续保留历史 Q。', evidence: ['描述新 Q 与历史 K/V 的数据依赖。', '指出历史 Q 的输出已经完成。'], pitfall: '不要说 Q 物理上不能缓存；这是标准解码中的用途与收益选择。', href: '/inference/kv-cache#追问链-从公式到上线判断', reference: '追问链：从公式到上线判断' },
    { level: 'L2', focus: '容量', question: '同样 2048 个位置，8 与 32 个 KV 头的原始载荷差多少？', answer: '按图解的 batch=1、32 层、head_dim=128、K/V 各 2 字节，公式为 2 × 层数 × 位置数 × KV 头数 × head_dim × 字节数。8 头为 0.25 GiB，32 头为 1 GiB；只改变 KV 头数时，载荷相差四倍。', evidence: ['列出 K/V 两份、层数、位置数、KV 头数与元素字节数。', '用 GiB 换算，并区分原始载荷与完整进程显存。'], pitfall: '这些是构造配置，不含权重、工作区、分页与共享；不能直接作为生产并发上限。', href: '/inference/kv-cache#容量决策-先列假设-再做乘法', reference: '容量决策：先列假设，再做乘法' },
    { level: 'L3', focus: '边界', question: '为什么 MLA 不能直接套标准的 2 × KV heads × head_dim 预算？', answer: '标准公式假设缓存的是每个 KV 头的 K 与 V。MLA 通常缓存共享压缩 latent 和解耦的位置部分，缓存表示不同；应先检查模型配置与引擎实际保留的表示，再按各部分尺寸和精度计数。', evidence: ['指出标准公式所假设的缓存布局。', '明确应计入位置部分，并核对具体引擎表示。'], pitfall: '不能只计算 latent，就宣称那是任何实现的完整 KV 占用。', href: '/inference/kv-cache#追问链-从公式到上线判断', reference: '追问链：MLA 缓存预算的边界' }
  ],
  rag: [
    { level: 'L1', focus: '证据', question: '旧政策更相关，但新版已经生效，应该引用哪份证据？', answer: '先确认问题日期、对象和权限，再按有效期判断政策适用性。构造案例发生在新版生效之后，应保留新版 300 元及其来源，不把旧版 500 元与新版金额平均。', evidence: ['区分语义相关与时间/对象上的适用性。', '保留证据来源、版本与有效期。'], pitfall: '相似度排名第一不是适用性证明，存在引用也不自动证明结论受到支持。', href: '/rag/rag-basics#rag-context', reference: '上下文组织与引用' },
    { level: 'L2', focus: '排障', question: '召回了很多文档，答案还是错，为什么不先增加 top-k？', answer: '把失败拆为召回、排序、上下文和生成：检查必需证据是否进入候选、是否被筛选或截断、冲突与权限是否处理、回答是否被证据支持。增加候选也可能带来更多噪声与冲突，应先定位缺失的环节。', evidence: ['提供分段检查，而不是只看最终答案。', '指出候选数、上下文预算与证据支持之间的区别。'], pitfall: '不要把召回数量多当作证据完整，也不要未经分段验证就增加 top-k。', href: '/rag/rag-basics#rag-failures', reference: '常见失败模式与排查' },
    { level: 'L3', focus: '评测', question: '一个问题需要两段证据，只找到一段，Recall 与 Hit 分别是多少？', answer: '在该构造问题上，Recall 为找回的必需证据数除以全部必需证据数，即 1/2；至少命中一段的 Hit 为 1。宏平均 Recall 与问题级 Hit Rate 对多个问题分别平均，不能将这两类指标混写。', evidence: ['明确 Recall 的证据分母与 Hit 的布尔条件。', '无答案问题单独评价拒答，不套用不存在的证据分母。'], pitfall: '不能用更高 Hit Rate 证明每个多证据问题都获得了完整证据。', href: '/rag/rag-basics#rag-baseline', reference: 'RAG 评估：先定义分母' }
  ],
  agent: [
    { level: 'L1', focus: '权限', question: '模型输出了合法工具 JSON，为什么还不能立即执行？', answer: '结构合法仅通过第一层。执行器还要验证参数范围与资源存在、用户授权和当前业务条件；可信身份由会话注入，模型的提议不能替代这些检查。', evidence: ['说清模型提议与执行器校验的职责。', '区分 schema、参数、授权与业务条件。'], pitfall: '订单 ID 合法不代表可退款；只读工具也可能读取敏感资料。', href: '/agent/agent-basics#agent-tools', reference: '工具契约：结构正确还不够' },
    { level: 'L2', focus: '恢复', question: '写操作响应超时，怎样避免创建第二张工单？', answer: '超时表示客户端结果未知，不证明外部操作未成功。沿用绑定同一逻辑动作的 operation_id 查询业务记录；服务端明确支持幂等时，才按契约用相同键与参数重试。缺少查询或幂等保证时暂停并核对。', evidence: ['区分明确未执行、成功与结果未知。', '保留稳定操作 ID，并说明恢复依赖服务端契约。'], pitfall: '不能换一个新的操作 ID 重试，也不能以本地内存标记保证跨进程去重。', href: '/agent/agent-basics#agent-recovery', reference: '可靠性：写操作超时如何恢复？' },
    { level: 'L3', focus: '一致性', question: '保存了 checkpoint，为什么仍不能声称 exactly-once？', answer: '外部副作用已提交、但本地 checkpoint 尚未持久化的窗口内发生崩溃，恢复后仍可能重放同一步骤。需要外部操作账本、业务幂等或事务/对账设计跨越这个边界，本地执行状态本身不足以证明一次性。', evidence: ['画出外部提交与本地持久化之间的崩溃窗口。', '说明操作记录与去重应如何跨进程存续。'], pitfall: '不要把可恢复执行等同副作用只发生一次，也不要声称取消必然撤销已发生的动作。', href: '/agent/agent-basics#agent-recovery', reference: '可靠性：checkpoint 与副作用窗口' }
  ],
  lora: [
    { level: 'L1', focus: '机制', question: '冻结 W 后，为什么仍需要基座前向？', answer: 'LoRA 的输出仍包含 Wx，再加低秩增量。冻结只是 W 不参与参数更新；训练较早层适配器仍可能需要梯度通过后续冻结层传播，不能把冻结理解为整个基座被跳过。', evidence: ['写出 Wx + sB(Ax) 中的两条分支。', '区分参数更新与前向/梯度传播。'], pitfall: '可训练参数少不代表整个训练过程变成同参数量的小模型。', href: '/finetuning/lora#一、为什么需要-lora', reference: '为什么需要 LoRA？' },
    { level: 'L2', focus: '预算', question: 'rank 翻倍，哪些预算翻倍，哪些不一定？', answer: '固定目标层、输入输出维度和存储精度时，A/B 参数量 r(d_in+d_out) 与仅适配器权重的存储量翻倍。冻结基座权重不变；激活、工作区和完整训练显存不能从该比例直接推导。', evidence: ['明确目标层、维度、精度固定的条件。', '区分适配器账本与整模训练预算。'], pitfall: 'alpha 改变缩放而非参数数目，rank 增长也不自动保证效果更好。', href: '/finetuning/lora#可复算-参数量、存储与线性合并', reference: '可复算：参数量、存储与线性合并' },
    { level: 'L3', focus: '梯度', question: 'B 初始化为零时，第一步 A/B 的梯度有何区别？', answer: '在普通线性 LoRA 的参数化下，∂L/∂A = s Bᵀ g xᵀ，因此 B 为零使这一步 A 的梯度为零；∂L/∂B = s g(Ax)ᵀ 通常仍非零。B 更新后 A 才能获得该路径的梯度。', evidence: ['给出两个梯度式，并指出 B 出现在哪一个式子中。', '说明 A 随机、B 为零与两者同时为零的区别。'], pitfall: '“B 通常有梯度”不是每个输入与损失下均非零的保证；初始化变体需另行核对。', href: '/finetuning/lora#_2-2-初始化与缩放', reference: '初始化与缩放' }
  ],
  dpo: [
    { level: 'L1', focus: '标签', question: 'chosen 是偏好标签，为什么不代表正确答案？', answer: '偏好比较依赖标注者与 rubric，可能偏好更长、更迎合或看似专业的回答。事实性、引用支持与安全边界仍需独立验证，较低偏好损失不能替代这些检查。', evidence: ['区分偏好目标与事实正确性目标。', '给出至少一个偏好与质量偏离的风险。'], pitfall: '不要把 chosen/rejected 标签写成正确/错误的绝对分类。', href: '/finetuning/rlhf#一、为什么需要对齐', reference: '为什么需要对齐？' },
    { level: 'L2', focus: '数据', question: '为什么两条回答必须共享上下文与判断条件？', answer: '偏好对比较的是相同 prompt 下的候选回答。若日期、权限、证据或问题发生变化，偏好差可能来自条件不同而非回答质量；评判引用时还必须提供原材料。', evidence: ['核对 prompt、证据、对象、权限与适用日期。', '说明模板、截断和回答有效 token 范围也影响训练输入。'], pitfall: '不能将不同问题或不同知识版本的回答任意拼成一个偏好对。', href: '/finetuning/rlhf#阶段-2-训练奖励模型-reward-model-rm', reference: '偏好比较的上下文与证据条件' },
    { level: 'L3', focus: '复算', question: '将 Δ 设为零，为什么损失与 beta 无关？', answer: 'DPO 单对损失是 −log(sigmoid(beta × Δ))。Δ=0 时 logit 为零，sigmoid(0)=1/2，损失为 log(2)。此结果只说明该偏好对的相对校正差值为零，不证明策略在所有回答上都等于参考。', evidence: ['复算 logit、sigmoid 与最终损失。', '区分单对相对差为零与完整分布相等。'], pitfall: '这里调节 beta 仅展示固定构造概率下的代数，不代表 beta 对训练与最终质量没有影响。', href: '/finetuning/rlhf#可复算-一个偏好对的-dpo-损失', reference: '可复算：一个偏好对的 DPO 损失' }
  ]
}
