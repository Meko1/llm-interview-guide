# 大模型应用线上排障手册

> 本页面面向真实面试里的“线上突然出问题，你怎么排查”类追问。它和 [系统设计面试题](/interview/application-system-design) 的关系是：系统设计回答“怎么搭”，本页回答“坏了怎么定位、止血、修复和复盘”。

## 一、排障总原则

大模型应用的线上问题不要一上来就改 Prompt。更稳的排查顺序是：

1. **先止血**：回滚、降级、限流、关闭高风险工具、切旧模型。
2. **定范围**：哪些租户、应用、模型、Prompt 版本、知识库版本、工具版本受影响。
3. **看链路**：入口、权限、检索、Rerank、上下文、模型、工具、输出校验、缓存。
4. **分类型**：质量问题、延迟问题、成本问题、安全问题、工具副作用问题。
5. **拿证据**：trace、日志、指标、样本、版本差异、线上反馈。
6. **修复验证**：离线回归、影子流量、灰度、小流量监控。
7. **沉淀复盘**：bad case 入评测集，事故原因进入发布门禁。

一句话面试表达：

> 我不会先假设是模型变差，而是先用 trace 把一次请求拆开，看问题发生在召回、上下文、模型生成、工具执行、输出校验还是路由成本层。止血靠回滚和降级，根因靠版本、指标和样本对比。

## 二、症状一：RAG 答非所问

### 现象

用户问题明确，但系统回答相关主题而不是关键答案。例如问“酒店报销标准”，系统回答“差旅申请流程”。

### 优先排查路径

1. 看原始文档是否有正确答案。
2. 看解析是否丢表格、标题、附件或页码。
3. 看 chunk 是否切散关键字段。
4. 看 query rewrite 是否改偏。
5. 看向量召回、BM25 召回、Rerank 排序。
6. 看最终上下文是否包含正确证据。
7. 看生成 Prompt 是否要求引用证据回答。

### 关键指标和日志

- Recall@K、MRR、Context Precision。
- query、rewrite_query、召回文档 id、Rerank 分数。
- final_context、answer、citation、doc_version。
- 空召回率、引用命中率、用户点踩原因。

### 常见根因

- 文档解析丢表格或层级。
- chunk 太大或太小，答案和条件被切散。
- 只用向量检索，关键词和编号匹配差。
- Rerank 没有覆盖业务术语。
- Prompt 允许模型基于常识补答案。

### 修复动作

- 重做文档解析，保留表格、标题路径和元数据。
- 混合检索：向量 + BM25 + 元数据过滤。
- 对 query rewrite 加回归集，避免语义漂移。
- 加 Rerank 和上下文压缩。
- 回答必须带引用，无证据时拒答。

## 三、症状二：正确文档召回到了，但答案仍然错

### 现象

Trace 显示 Top-K 里有正确文档，但最终答案遗漏关键字段、引用错段落或编造结论。

### 优先排查路径

1. 检查正确证据在 Top-K 的位置。
2. 检查进入 final_context 的片段顺序。
3. 检查是否有噪声片段冲突。
4. 检查 Prompt 是否要求逐条引用。
5. 检查输出是否经过事实一致性校验。

### 关键指标和日志

- Top-K rank、Rerank rank、context token 占比。
- answer sentence -> citation sentence 对齐。
- faithfulness、citation support、unsupported claims。
- 长上下文位置和模型输出段落对应关系。

### 常见根因

- 正确证据排在后面，模型注意不到。
- Top-K 太大引入噪声。
- 文档版本冲突，新旧政策同时进入上下文。
- 模型参数知识覆盖检索证据。
- 输出没有强制引用字段。

### 修复动作

- 使用 Rerank、LongContextReorder、去重和冲突过滤。
- 对版本、时间、地区、部门做元数据过滤。
- 引入答案后校验：关键结论必须有 citation。
- 对高风险答案转人工复核。

## 四、症状三：权限越权或引用了不该看的文档

### 现象

用户看到其他部门、其他租户、旧角色或无权限项目的文档内容。

### 优先排查路径

1. 拉取完整 trace：query、rewrite、向量召回、BM25 召回、Rerank、final_context。
2. 检查 ACL 是否在召回前生效。
3. 检查混合检索两路是否都带权限过滤。
4. 检查缓存 key 是否包含 tenant、user、role、doc_acl、index_version。
5. 检查引用详情页是否二次鉴权。

### 关键指标和日志

- acl_decision、tenant_id、role、doc_acl、policy_version。
- permission_filter_hit、denied_doc_count。
- cache_key、cache_scope、index_version。
- 越权召回率、越权输出率、越权拦截率。

### 常见根因

- 只在生成后过滤敏感内容。
- 向量检索做了 ACL，BM25 没做。
- Rerank 或缓存复用了越权候选。
- 用户权限变更后缓存未失效。
- 引用链接可绕过答案层鉴权。

### 修复动作

- 检索前硬过滤，Rerank 前后再二次校验。
- 缓存 key 加权限 scope 和版本。
- 权限变更、文档删除、索引重建触发缓存失效。
- 补跨租户、跨部门、角色变更、删除文档评测集。

## 五、症状四：Prompt 改版后质量波动

### 现象

修了一个 bad case 后，整体采纳率下降、拒答率升高、输出变啰嗦或格式变差。

### 优先排查路径

1. 确认 prompt_version、model_version、rag_config 是否同时变化。
2. 对比新旧版本在 golden set 的表现。
3. 按场景拆分：高频、长尾、无答案、安全、结构化输出。
4. 看拒答率、误拒率、投诉率、转人工率。
5. 复查变更是否只针对局部 case 过拟合。

### 关键指标和日志

- prompt_version、diff、发布人、发布时间。
- golden set 通过率、拒答正确率、正常问题误拒率。
- 采纳率、转人工率、点踩原因。
- 结构化解析失败率。

### 常见根因

- 为单个 case 改 Prompt，导致整体退化。
- Prompt 变得过度保守。
- few-shot 样例覆盖偏。
- 模型升级后旧 Prompt 不兼容。
- 业务人员直接改线上模板。

### 修复动作

- Prompt 像代码一样版本化、评测、审批、灰度。
- 建 golden set：高频、边界、安全、历史 bad case。
- 发现退化先回滚，再拆根因。
- 对高风险 Prompt 改动启用影子流量。

## 六、症状五：结构化输出经常解析失败

### 现象

模型应输出 JSON，但线上出现字段缺失、枚举乱写、解释文本混入 JSON、字段类型正确但业务语义错误。

### 优先排查路径

1. 看 Schema 是否过复杂或字段语义不清。
2. 看模型是否支持原生结构化输出或 tool calling。
3. 看失败样本是否集中在长上下文、低质量输入或 fallback 模型。
4. 看重试策略是否无限放大成本。
5. 看后端是否做业务语义校验。

### 关键指标和日志

- parse_success_rate、schema_error_type、retry_count。
- model_version、fallback_model、output_tokens。
- 字段级准确率、关键字段缺失率。
- 入库失败率、人工修正率。

### 常见根因

- 把 JSON Mode 当成事实正确保证。
- Schema 缺少枚举和范围约束。
- Prompt 同时要求解释和 JSON。
- fallback 模型不兼容结构化输出。
- 后端直接信任模型字段。

### 修复动作

- 使用严格 Schema、枚举、必填和字段说明。
- 原生 structured output 优先，失败后有限重试。
- 关键字段带 evidence、页码、原文片段。
- 后端做业务状态、金额、权限、库存等语义校验。
- fallback 链路进入结构化输出回归集。

## 七、症状六：Agent 进入循环或成本失控

### 现象

Agent 多轮调用工具、反复搜索、无法停止，单次请求成本和耗时异常。

### 优先排查路径

1. 看 trace 中每一步 action、observation、state。
2. 统计工具调用次数、搜索轮数、重试次数、token 消耗。
3. 检查是否没有明确停止条件。
4. 检查工具返回是否让模型误判失败。
5. 检查任务拆解是否过细或 Planner 不收敛。

### 关键指标和日志

- agent_step_count、tool_call_count、search_rounds。
- tokens_per_step、cost_per_trace、max_depth_hit。
- repeated_action_rate、no_progress_steps。
- termination_reason。

### 常见根因

- 没有最大步数、最大成本、最大时间。
- observation 不结构化，模型不知道是否完成。
- 工具失败触发重复重试。
- Planner 每轮生成新子问题，没有收敛规则。
- 缺少“证据不足时停止”的策略。

### 修复动作

- 设置 max_steps、max_tokens、budget、timeout。
- 定义 no_progress 检测和重复 action 检测。
- 工具返回结构化状态：success、retryable、terminal。
- Agentic RAG 加证据覆盖和停止门禁。
- 高成本任务走异步队列和人工审核。

## 八、症状七：工具调用成功但业务结果错

### 现象

Function Calling 参数类型合法，工具也返回 success，但创建了错误工单、重复退款、改错地址或发错邮件。

### 优先排查路径

1. 区分参数合法、权限合法和业务语义正确。
2. 看 Tool Gateway 是否调用 Policy Engine。
3. 看是否有 prepare/confirm/commit。
4. 看写操作是否带 idempotency_key。
5. 看 checkpoint 恢复是否重放了副作用工具。

### 关键指标和日志

- tool_name、schema_version、policy_decision。
- operation_id、idempotency_key、approval_id。
- business_state_before/after。
- duplicate_operation_rate、rollback_count。

### 常见根因

- 把 Function Calling 当成安全执行。
- 只做类型校验，不做业务状态校验。
- 接口超时被当成失败，恢复后重复调用。
- 高风险动作没有人工确认。
- 工具 Schema 升级未回放旧 trace。

### 修复动作

- 所有写操作加幂等键和状态查询。
- 高风险动作拆成 prepare/confirm/commit。
- 业务服务做最终状态、权限、金额、库存校验。
- checkpoint 保存外部 business_id 和执行状态。
- 工具版本升级跑回放评测。

## 九、症状八：模型升级或路由切换后业务变差

### 现象

新模型榜单更高，但上线后 JSON 失败率上升、工具调用不稳定、拒答边界变化、成本变高。

### 优先排查路径

1. 看 route_reason、model_version、fallback_reason。
2. 对比旧模型和新模型在业务 golden set 上的结果。
3. 拆结构化输出、工具调用、安全拒答、长上下文、引用格式。
4. 看 output token、TTFT、TPOT 和单次成本。
5. 看是否全量切换而非灰度。

### 关键指标和日志

- model_version、route_policy、route_reason。
- json_parse_rate、tool_success_rate、refusal_rate。
- TTFT、TPOT、output_tokens、cost_per_request。
- fallback_hit_rate、business_error_rate。

### 常见根因

- 用公开榜单替代业务评测。
- 新模型 Prompt 不兼容旧模板。
- tool schema 对不同模型适配不足。
- fallback 模型能回答但不遵守业务契约。
- 高风险场景被静默降级。

### 修复动作

- 新模型必须过业务 golden set。
- Prompt 和 tool schema 做模型适配层。
- 高风险动作 fallback 后转人工或只读模式。
- 先影子流量，再小范围灰度。
- 保留一键回滚旧模型。

## 十、症状九：推理服务延迟升高或频繁 OOM

### 现象

用户反馈首字慢，高峰期超时，GPU 利用率不稳定，长上下文请求导致 OOM。

### 优先排查路径

1. 拆 TTFT、TPOT、排队时间、E2E latency。
2. 按输入长度、输出长度、租户、应用、模型分桶。
3. 看 prefill 队列、decode 队列和 KV Cache 占用。
4. 看是否在线请求和离线长任务混跑。
5. 看动态 batching、prefix cache、限流策略。

### 关键指标和日志

- TTFT、TPOT、P95/P99、goodput。
- queue_time、prefill_time、decode_time。
- GPU 利用率、显存、KV Cache 使用率、OOM。
- input_tokens、max_output_tokens、batch_size。

### 常见根因

- 只用 tokens/s 压测，没看真实长度分布。
- 离线报告长上下文挤占在线客服。
- max output 设置过大。
- KV Cache 爆显存。
- 动态 batching 参数不适合流量形态。

### 修复动作

- 长短请求分队列，必要时分 GPU 池。
- 对超长请求做准入、异步化或降级。
- 启用 prefix cache、chunked prefill、KV 量化等能力。
- 按 SLA 做限流和优先级。
- 用真实生产日志抽样压测。

## 十一、症状十：成本突然暴涨

### 现象

请求量没有明显上涨，但账单、GPU 成本或单次请求成本突然翻倍。

### 优先排查路径

1. 按 app、tenant、model、prompt_version、route_policy 分桶。
2. 拆 input token、output token、调用次数、重试、fallback。
3. 看 RAG Top-K、上下文长度、Agent step、Judge 调用。
4. 看缓存命中率是否下降。
5. 看是否切到高价模型或强模型。

### 关键指标和日志

- cost_per_request、cost_per_tenant、cost_per_model。
- input_tokens、output_tokens、retry_count、fallback_count。
- cache_hit_rate、agent_steps、rag_top_k。
- budget_usage、quota_hit、cost_anomaly_alert。

### 常见根因

- Prompt 增加大量上下文。
- Top-K 或 Rerank 候选过大。
- Agent 循环或工具重试风暴。
- fallback 到高价模型。
- 缓存 key 变更导致命中率下降。

### 修复动作

- 立即限流、预算熔断、冻结异常 Key。
- 回滚 Prompt、路由或 RAG 配置。
- 上下文裁剪、缓存、模型分层路由。
- 成本事件入仓，建立应用/租户/版本级账单。
- 成本异常进入发布门禁。

## 十二、症状十一：安全或合规告警

### 现象

系统输出敏感信息、泄露 PII、被提示注入诱导、外部模型接收了不该外发的数据。

### 优先排查路径

1. 确认是输入外发、检索越权、工具越权还是输出泄露。
2. 看 data_classification、policy_decision、model_channel。
3. 看检索材料是否包含注入指令。
4. 看工具执行前是否做权限校验。
5. 看日志是否保存了原文敏感数据。

### 关键指标和日志

- pii_detected、redaction_applied、policy_version。
- model_channel、data_level、egress_allowed。
- prompt_injection_hit、tool_denied_count。
- sensitive_output_rate、audit_trace_id。

### 常见根因

- 合规路由放在模型调用后。
- 检索内容被当成指令。
- 外部工具列表对所有用户可见。
- 日志未脱敏。
- 缓存跨租户复用。

### 修复动作

- 模型调用前做数据分级和合规路由。
- 检索内容标记为不可信 evidence。
- 工具执行前服务端强校验。
- 日志脱敏和最小化保存。
- 安全集加入提示注入、越权、PII、外发策略样本。

## 十三、症状十二：微调模型上线后退化

### 现象

LoRA/SFT 后格式更稳定，但事实正确率下降、拒答变差、通用能力退化或延迟上升。

### 优先排查路径

1. 对比 base model、prompt-only、RAG-only、LoRA+RAG。
2. 看错误是否集中在动态知识。
3. 检查训练数据是否包含旧政策、错误答案或泄漏样本。
4. 看 base_model_version、lora_version、prompt_version、kb_version。
5. 看是否所有请求都走微调模型。

### 关键指标和日志

- task_accuracy、format_following、faithfulness、refusal_accuracy。
- adapter_version、dataset_version、eval_set_version。
- route_to_lora_rate、latency_delta、cost_delta。
- bad_case_type。

### 常见根因

- 把动态事实训练进权重。
- 线上日志未清洗直接进训练集。
- 只测格式，不测事实和安全。
- LoRA 和基座不兼容。
- 微调模型路由范围过大。

### 修复动作

- 动态知识回到 RAG，LoRA 只解决稳定行为模式。
- 数据脱敏、去重、纠错和专家审核。
- 微调上线必须过业务、安全、格式、通用能力回归。
- 按场景路由微调模型，保留基座回滚。

## 十四、补充排障卡：平台与工作流专项

这一节用于补齐平台化和低代码工作流里最容易被问到的排障点。它们不一定是模型本身的问题，更多发生在发布、路由、Key、供应商、工作流分支和业务采纳层。

### 卡一：线上回答旧政策、旧价格、旧流程

**症状**：用户明确问最新制度，但答案引用旧版本；文档已更新，RAG 或 Dify Knowledge 仍返回旧内容。

**优先排查路径**

1. 看 `doc_id`、`doc_version`、`index_version` 是否完成更新。
2. 检查向量索引、BM25 索引、Rerank 候选是否仍有旧 chunk。
3. 检查答案缓存、检索缓存、语义缓存是否带 `knowledge_version`。
4. 检查应用是否绑定旧知识库版本。
5. 回放问题，查看召回 `doc_id`、`chunk_id`、引用版本。

**关键指标和日志**

- `knowledge_version`、`index_version`、`doc_version`、`last_sync_time`。
- `indexing_status`、`embedding_status`、`recalled_doc_id`。
- `cache_key`、`cache_hit`、`cache_created_at`。
- stale_answer_rate、deleted_doc_hit_rate。

**常见根因**

- 文档上传成功，但异步索引任务失败。
- 只更新原文，没有删除旧 chunk。
- 新旧政策重复存在于多个知识库。
- 缓存 key 没包含索引版本。
- Rerank 未考虑时效和生效时间。

**修复动作**

- 更新采用“删旧 + 写新”，并能按 `doc_id -> chunk_ids` 清理旧索引。
- 文档删除、权限变更、版本发布触发缓存失效。
- 答案展示引用版本、生效日期和更新时间。
- 对旧政策问题建立回归集。

### 卡二：外部模型供应商故障导致大面积超时

**症状**：多个业务同时报模型超时、429、5xx，或流式输出中途断开。

**优先排查路径**

1. 按 provider、region、model、app 分桶，看是否集中在某供应商。
2. 检查网关重试、超时、熔断、fallback 是否放大流量。
3. 看备用模型是否容量足够，是否也被打满。
4. 看核心租户和低优先级任务是否共用同一配额。

**关键指标和日志**

- `provider_status_code`、`upstream_latency`、`timeout_rate`。
- `retry_count`、`fallback_hit_rate`、`circuit_breaker_state`。
- provider health、connection pool、queue depth。

**常见根因**

- 上游限流或区域故障。
- 重试风暴放大请求量。
- fallback 链路容量不足。
- 超时时间过长导致连接池耗尽。

**修复动作**

- 开启熔断，降低重试次数。
- 核心租户优先，低优先级任务降级或排队。
- 切备用模型或只读降级。
- 将供应商健康状态接入路由策略。

### 卡三：虚拟 Key 被滥用或单租户打爆配额

**症状**：某个 app 或 key 的 RPM/TPM、成本、失败率异常升高，影响其他业务。

**优先排查路径**

1. 按 `key_id`、`app_id`、`tenant_id`、IP、user-agent、模型分桶。
2. 判断是正常业务峰值、Key 泄漏、脚本循环还是恶意调用。
3. 检查是否有单次 token 上限、日预算和熔断策略。
4. 看 dev key 是否被用于生产。

**关键指标和日志**

- `rpm`、`tpm`、`daily_budget_usage`、`quota_hit`。
- `key_id`、`source_ip`、`request_pattern`、`cost_per_key`。
- abnormal_user_agent、request_interval、error_rate。

**常见根因**

- Key 泄漏。
- 预算只告警不熔断。
- 没有单次 `max_tokens` 和上下文长度限制。
- 脚本循环或 Agent 循环没有成本上限。

**修复动作**

- 冻结或轮换 Key。
- 降低配额，增加单次 token 和上下文限制。
- 异常 key、异常 IP、成本中心纳入告警。
- 给高成本调用加审批或异步队列。

### 卡四：Adapter 或模型版本错配导致表现随机

**症状**：同一请求多次结果不一致，部分实例质量差、延迟高或加载失败。

**优先排查路径**

1. 检查每个推理实例实际加载的 base model、adapter、tokenizer、chat template、量化配置。
2. 看灰度期间是否部分实例未热加载成功。
3. 检查缓存 key 是否包含 base、adapter、Prompt 和知识库版本。
4. 按 instance_id 对比错误率和延迟。

**关键指标和日志**

- `instance_id`、`base_model_sha`、`adapter_sha`。
- `tokenizer_version`、`chat_template_version`、adapter load error。
- per-instance error rate、adapter_hit_rate、route_to_lora_rate。

**常见根因**

- LoRA 与基座版本不匹配。
- tokenizer 或 chat template 与训练时不一致。
- 灰度发布时实例状态不一致。
- 语义缓存跨 adapter 复用。

**修复动作**

- 发布包锁定 base + adapter + tokenizer + template。
- 实例启动做一致性校验。
- Adapter 加载失败自动摘流。
- 保留旧版本回滚。

### 卡五：Dify 预览正常，生产环境效果变差

**症状**：业务在 Dify 画布里调试正常，但发布到生产后回答变啰嗦、拒答变多、引用变少，或同样输入在预览和线上表现不一致。

**优先排查路径**

1. 对比 preview、staging、prod 的 app_version、prompt_version、model_config、knowledge_version。
2. 检查生产环境是否走了不同模型、温度、上下文窗口或工具配置。
3. 查看是否只发布了 Workflow，但 Knowledge、Tool、变量配置没有同步。
4. 用同一批 golden set 分别跑预览和生产链路。
5. 检查生产入口是否额外注入 system prompt、用户画像、历史对话或安全策略。

**关键指标和日志**

- app_version、workflow_version、prompt_version、model_config。
- env、release_id、publisher、publish_time。
- preview_trace_id、prod_trace_id、node_input、node_output、final_prompt。
- golden set pass rate、refusal_rate、parse_error_rate。

**常见根因**

- Dify 画布改动未完整发布。
- 生产环境模型配置和预览环境不一致。
- 后端入口额外拼接历史上下文或安全模板。
- 多环境知识库版本漂移。

**修复动作**

- 建立发布包概念：Workflow、Prompt、Knowledge、Tool、Model Config 一起版本化。
- 生产发布前强制跑 golden set 和影子流量。
- 禁止手工改生产配置，所有变更进入审批和回滚。
- Trace 保存最终 Prompt 和节点级输入输出，支持预览/生产 diff。

### 卡六：工作流走错分支

**症状**：用户咨询制度问答，却被路由到投诉流程；普通查询被判断成高危操作；审批前置检查漏掉关键分支。

**优先排查路径**

1. 查看入口意图分类节点的输入、输出和置信度。
2. 检查分类标签是否和后续条件分支完全一致。
3. 复盘是否有新增业务类型但未更新路由规则。
4. 抽样低置信度、长文本、多意图输入和口语化输入。
5. 对比新旧 Prompt 或分类模型在路由评估集上的混淆矩阵。

**关键指标和日志**

- intent_label、intent_confidence、route_branch。
- route_reason、condition_hit、fallback_branch。
- branch_distribution、unknown_intent_rate。
- route_accuracy、manual_correction_rate。

**常见根因**

- 意图标签边界重叠。
- Few-shot 只覆盖理想样例。
- 工作流新增分支后，旧分类器未同步。
- 低置信度仍强行进入自动流程。
- 多意图请求没有拆分。

**修复动作**

- 给每个分支写清进入条件、排除条件和示例。
- 低置信度进入澄清节点。
- 建路由评估集，覆盖高频、边界、多意图和口语化输入。
- 高风险分支增加二次确认或规则校验。

### 卡七：人工审批节点失效

**症状**：退款、外发邮件、修改资料、审批建议等高风险动作没有进入人工确认；或者大量任务卡在人工节点无人处理。

**优先排查路径**

1. 检查风险分级是否正确命中。
2. 查看 workflow 是否存在绕过人工节点的 fallback 分支。
3. 检查审批通知、审批人路由、超时策略。
4. 查看审批结果是否被正确写回 workflow state。
5. 检查重试或恢复后是否重复提交审批。

**关键指标和日志**

- risk_level、approval_required、approval_id。
- approver_id、approval_status、approval_latency。
- timeout_policy、fallback_branch、pending_count。
- high_risk_action_without_approval。

**常见根因**

- 风险规则只写在 Prompt 里。
- fallback 分支绕过人工审批。
- 审批人配置错误或通知失败。
- 审批超时后默认继续执行。
- checkpoint 恢复后重复创建审批单。

**修复动作**

- 高风险动作由后端 Policy Engine 强制拦截。
- 审批超时默认转人工队列或失败，不自动执行。
- approval_id 和 business_id 幂等绑定。
- 审批节点加入积压、超时、绕过、重复提交监控。

### 卡八：工作流节点成功，但业务结果不可用

**症状**：工作流平台显示每个节点 success，但合同摘要不能法务使用，营销文案被运营驳回，工单分类被一线客服大量改回。

**优先排查路径**

1. 区分技术成功和业务成功。
2. 查看人工采纳率、修改率、驳回原因。
3. 抽样对比模型输出和业务专家最终版本。
4. 检查 Prompt 是否缺少业务验收标准。
5. 看用户是否绕开系统，或只复制部分结果。

**关键指标和日志**

- node_success_rate、workflow_success_rate。
- adoption_rate、edit_distance、manual_rewrite_rate。
- reject_reason、operator_feedback。
- time_saved、handoff_rate、repeat_usage_rate。

**常见根因**

- 验收指标只看生成成功。
- Prompt 没写清品牌、合规、口径、渠道格式。
- 输出太泛，业务人员还要二次重写。
- 用户流程变重，用 AI 反而多一步。

**修复动作**

- 把采纳率、修改率、处理时长纳入核心指标。
- 收集驳回原因，沉淀为 Prompt 约束和评估集。
- 输出格式对齐真实下游系统。
- 对低采纳场景先做 Copilot 建议，不急着全自动。


可以按下面结构讲：

| 段落 | 说什么 |
| --- | --- |
| 背景 | 哪个应用、什么用户、影响范围 |
| 现象 | 质量、延迟、成本、安全还是工具问题 |
| 止血 | 回滚、限流、禁用工具、切旧模型、转人工 |
| 定位 | 用哪些 trace、日志、指标、版本差异 |
| 根因 | 问题发生在哪一层，为什么之前没拦住 |
| 修复 | 短期修复和长期机制 |
| 复盘 | 哪些 case 进入评测集，哪些门禁新增 |

高分收尾：

> 这类问题不能只靠人肉经验定位。每个请求都要有 trace_id，把 Prompt、RAG 配置、模型版本、知识库版本、工具 Schema、路由策略和成本事件串起来。只有这样，线上事故才能从“猜模型怎么了”变成“定位哪一层变了”。

## 继续阅读

- [LLMOps 生产运营高频问答](/interview/llmops-production-qna)
- [大模型应用系统设计面试题](/interview/application-system-design)
- [大模型应用实战场景题库](/interview/application-practice-scenarios)
- [Agent 评测与安全合规高频问答](/interview/agent-evaluation-safety-qna)
- [推理部署与成本治理高频问答](/interview/inference-cost-qna)
- [RAG、Memory 与评测安全高频问答](/interview/rag-memory-eval-qna)
