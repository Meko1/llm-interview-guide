# LLM Prompt/Prefix Cache 生产工程

> Prefix Cache 不是“把 system prompt 放进 Redis”。它复用的是**完全相同 token 前缀的模型 KV 状态**，主要减少 prefill 计算和 TTFT；收益取决于 prompt 布局、请求分布、引擎拓扑、版本兼容性与驱逐策略。把这件事做成生产能力，关键不是打开一个开关，而是把稳定前缀设计成可治理的接口契约。

## 一、30 秒面试回答

**答法：**Prefix Cache 在模型或推理引擎内复用相同 token 前缀已计算好的 K/V，所以新请求不必重复 prefill 这段前缀，主要改善首 token 延迟并节省 GPU 计算。它与响应缓存不同：不直接复用用户答案；与语义缓存不同：不允许“语义近似”，必须 token 精确匹配。生产上我会把稳定的 system 指令、工具 schema、固定 few-shot 和共享文档放在前面，把用户问题、个性化数据和易变 RAG 证据放在后面；再用 model/tokenizer/template/adapter/policy 版本组成兼容域，监控 token 加权命中、节省的 prefill token、冷启动、驱逐和 P95 TTFT，并通过灰度和预热避免一次 prompt 发布把命中率打穿。

## 二、先划清边界：四种“缓存”优化的不是同一件事

| 类型 | 是否要求 token 精确相同 | 复用对象 | 对最终语义的影响 | 首要指标 |
| --- | --- | --- | --- | --- |
| Prefix/KV Cache | 是，命中公共前缀 | 模型内部 K/V | 无，仍然生成当前回答 | saved prefill tokens、TTFT |
| Prompt provider cache | 通常由上游按前缀规则识别 | 上游预填充状态与计费折扣 | 无 | cache read tokens、账单折扣 |
| 精确响应缓存 | 请求等价 | 已验证最终响应 | 直接返回历史语义 | 响应命中、E2E 延迟 |
| 语义响应缓存 | 否，近似匹配 | 历史响应/证据 | 可能复用答案，风险较高 | safe reuse precision |

因此 Prefix Cache 的安全模型更接近计算复用：只要前缀 token 确实完全相同，它不会把 A 用户的回答给 B 用户。但它仍有安全和治理问题：共享前缀不能混入用户私有内容；缓存命中日志可能暴露敏感 prompt 结构；一个策略或工具 schema 升级会造成兼容域分裂；错误的 prompt 拼接会让本应共享的前缀永远无法命中。

## 三、命中契约：不是字符串相同，而是 token 前缀相同

推理引擎会先 tokenize 请求，再在已有 KV block 或 radix tree 中寻找最长公共 token 前缀。下列任一变化都可能让命中断裂：

- model revision、tokenizer 版本、chat template、特殊 token；
- system prompt 中的空格、顺序、时间戳、随机 request id；
- 工具定义 JSON 的字段顺序、描述文案、枚举顺序；
- adapter/LoRA、RoPE 缩放、量化或 KV 精度等会改变 K/V 语义的配置；
- 图像、文件、动态文档、租户私有 policy 被插入到公共段；
- 框架在每次调用时悄悄注入“当前时间”“trace id”“用户画像”。

工程上应该显式定义一个 prefix compatibility domain：

```text
prefix_domain = hash(
  model_revision + tokenizer_revision + chat_template_revision +
  adapter_revision + tool_schema_revision + policy_bundle_revision +
  inference_kv_format
)
```

它不一定等于物理 cache key，而是发布和观测的逻辑边界。不同 domain 的 K/V 不能互用；同 domain 内才讨论前缀布局、预热和容量。这样模型或 policy 升级时，团队能预计命中下降属于预期冷启动，还是某个模板变更意外破坏了共享性。

### 3.1 Canonicalization 的正确位置

对于 JSON 工具 schema 和固定配置，可在**生成公共前缀之前**进行 canonical serialization：固定字段顺序、稳定数字格式、明确默认值和字符编码。不能在已生成的用户消息上做激进规范化，因为那会改变语义。原则是“对受控配置做确定性构建，对用户内容保持原样”。

## 四、Prompt 布局：把稳定部分放前面不是全部

推荐按稳定性和敏感性分层组织上下文：

```text
1. 全局安全与产品指令             稳定、公共
2. 模型角色与输出契约             稳定、公共
3. 固定工具 schema 与调用规则     稳定、公共
4. 领域 few-shot/共享说明         低频更新、公共或按租户分区
5. 租户 policy 与产品配置          稳定但必须有 tenant scope
6. 当前会话摘要                   变化较慢、通常不可跨用户
7. RAG 证据与工具结果             高频变化
8. 当前用户请求                   每次变化
```

这种顺序同时服务三件事：最大化最长公共前缀；避免把高频变化内容夹在前面切断后续复用；把不同安全域隔离在不同前缀树枝上。注意它不是绝对规则。若租户 policy 很长且全部用户共享，可以放入该租户专属的稳定前缀；若工具 schema 会随会话动态授权，则它必须随请求变化，不能为了命中率把权限信息硬编码到公共部分。

### 4.1 四个常见破坏命中的反模式

1. **在 system prompt 里写当前时间和 request id**：每次调用都变，公共前缀从第一 token 就分叉。
2. **把用户画像放在固定指令前**：用户变化截断了之后全部共享规则和工具 schema 的命中。
3. **每次随机排列工具或 few-shot**：A/B 实验和程序 map 的非确定遍历都会造成碎片。
4. **RAG chunk 先于固定工具/规则插入**：检索结果一变，后面的公共内容全部失去复用机会。

一个实用做法是在 trace 中记录 `prefix_length_tokens`、`common_prefix_ratio` 和前缀组成的分段 token 数。看到命中下降时，可以定位是 system、tool schema、tenant policy 还是 RAG 段发生了抖动，而不是猜测“引擎缓存失效”。

## 五、缓存拓扑：缓存在哪一层决定了收益形态

### 5.1 上游托管 Prompt Cache

部分 MaaS 会自动或显式缓存长前缀，并将 cache read token 与普通 input token 区分计费。应用侧仍要控制前缀稳定性、最小可缓存长度、TTL、地域和模型版本，但无需管理 GPU 内存。它适合希望快速获得成本折扣的团队；局限是策略透明度、可观测性、跨请求命中算法和缓存保留时间受供应商限制。

### 5.2 单实例 KV Cache

vLLM、SGLang 等引擎在一个实例内维护 paged/radix 结构，命中时效果直接、延迟最低。问题是负载均衡会把同一前缀的请求打散到不同实例，导致全局请求量很大而单实例命中很低。会话亲和、按 prefix hash 路由或一致性哈希能提高局部性，但也可能造成热点与容量不均。

### 5.3 跨实例 KV 池与 Prefill/Decode 分离

分布式 KV 池、remote cache 或 P/D disaggregation 可让预填充后的状态跨实例复用或迁移。它解决多机命中与资源弹性，却引入网络传输、序列化格式、RDMA/PCIe 带宽、可用性和复杂调度问题。判断是否值得，必须比较：

$$\text{saved prefill latency} > \text{KV transfer latency} + \text{coordination overhead}$$

短前缀、小请求或低并发场景通常不值得把系统复杂化；超长共享文档、多轮 Agent、批量代码审阅等场景可能收益显著。

### 5.4 亲和路由的两难

只按 `prefix_hash` 路由能提高命中，但热点前缀可能集中在少数 GPU，其他实例空闲。可以采用：分片后的小范围候选集、power-of-two choices、热点前缀复制、超过阈值后的 spillover、以及“缓存收益 vs 排队延迟”的动态决策。不要为了命中率把 P95 排队时间推高；最终目标是 goodput 和用户体验。

## 六、容量、驱逐与成本账本

Prefix Cache 占用的仍是 KV 内存，不能无限保留。容量预算应至少区分：权重常驻、活跃会话 KV、共享前缀 KV、预留碎片/调度缓冲和故障冗余。一个缓存条目的价值不只由长度决定：长前缀节省更多 prefill token，但也占用更多 KV；高频前缀即使较短，长期收益也可能更高。

可以定义近似价值函数：

$$value(prefix)=expected\_hits\times saved\_prefill\_ms - memory\_bytes\times eviction\_pressure$$

实际实现可用 LRU、LFU、成本加权 LFU、TTL、按租户配额或按 domain 独立池。最忌讳的是用一个全局 LRU 让低价值的超长前缀挤掉高频公共规则，或让一个大租户独占全部共享 KV。

### 6.1 不要只看请求命中率

两个前缀各命中 100 次：一个长度 50 token，一个长度 20k token，节省的计算完全不同。应同时报告：

- `token-weighted prefix hit rate`：按可复用 prefill token 加权；
- `saved_prefill_tokens` 与 `saved_prefill_ms`：直接反映收益；
- `TTFT cold/warm delta`：冷、热路径分别看 P50/P95/P99；
- `eviction churn`：条目刚写入就被逐出说明容量或布局有问题；
- `cache memory share`：共享前缀不能挤压活跃请求的 KV 预算；
- `per-domain/per-tenant fairness`：避免收益被单一业务垄断。

## 七、发布治理：Prompt 变更也会造成性能回归

PromptOps 常只关注输出质量，但对高流量服务来说，一行 system prompt 或工具 schema 的改动也可能导致缓存命中从 80% 降到 0%，TTFT、GPU 利用率和成本同步恶化。发布流程应把 prefix compatibility 当作非功能契约。

### 7.1 发布前检查

1. 识别变更是否影响公共前缀 token、tokenizer/template、工具 schema、adapter 或 KV 格式。
2. 在录制流量上计算旧/新模板的最长公共前缀分布和预期 token 加权命中。
3. 同时回归输出质量、tool-call schema、策略遵循和安全样本，不能为了缓存回滚有效规则。
4. 评估冷启动容量：新 domain 上线后所有请求都要 prefill，GPU 是否能承受。
5. 明确预热源、预热上限、失效范围和一键回滚动作。

### 7.2 灰度与双域运行

可把 `prompt_version` 显式纳入 domain，让新旧版本短期并存。灰度流量先命中新域缓存；旧域继续服务未迁移流量。若新版本质量正常但 TTFT 恶化，先看公共前缀是否被动态字段污染、是否漏做 schema canonicalization、是否因新工具定义过大导致容量被挤出，而非立刻判断引擎退化。回滚时应恢复旧 domain 的路由权重，而不是删除所有缓存后让系统遭遇回源洪峰。

### 7.3 预热的边界

预热适合稳定且高频的公共前缀，例如合规 system 指令、工具定义和固定 few-shot。不要用真实用户私有会话、未授权文档或敏感检索结果做共享预热。预热也要限速、分批、可取消，并计入 GPU 成本；若预热的前缀从未被真实流量命中，它只是把成本从用户请求提前支付。

## 八、排障手册：TTFT 变慢时先分清缓存问题还是流量问题

| 现象 | 先看什么 | 常见根因 | 处置 |
| --- | --- | --- | --- |
| 命中率突降 | domain、模板 diff、分段 token 数 | 时间戳/随机字段/工具顺序变化 | 回滚模板，固定序列化 |
| 命中率正常但 TTFT 变慢 | 排队、prefill 队列、GPU 负载 | 热点亲和、长请求抢占、缓存迁移 | 限制热点、分离长短请求 |
| 驱逐激增 | KV pool、条目长度分布、写入率 | 过大前缀、容量不足、发布双域 | 配额、TTL、扩容或删低价值项 |
| 只有部分实例命中低 | 路由分布、pod 重启、冷实例比例 | 无亲和、自动扩缩导致冷启动 | 一致性哈希、渐进扩容、预热 |
| 成本不降 | saved tokens、上游账单、输出长度 | 只缓存短前缀或输出 token 主导 | 重新分层 prompt，控制输出 |

排障时不可只查看“cache enabled=true”。必须把一次请求拆成入站 token、最长命中前缀、缓存所在实例、prefill 时间、排队时间、decode 时间和最终 TTFT；这样才能区分 token 布局、缓存容量、路由和模型负载。

## 九、验收与压测矩阵

上线前至少覆盖以下条件：

| 维度 | 场景 |
| --- | --- |
| 温度 | 冷启动、热缓存、发布双域、cache node 重启 |
| 前缀长度 | 256、2k、8k、32k token 的共享段 |
| 分布 | 单热点、长尾、多租户公平、请求突发 |
| 内容 | 固定工具 schema、动态 RAG、长会话、结构化输出 |
| 容量 | 正常负载、接近 KV 上限、驱逐抖动、故障迁移 |
| 正确性 | 不同权限、不同 policy、adapter/model 变更、模板回滚 |

验收门禁可写成：热路径 P95 TTFT 相比冷路径有明确收益；token 加权命中达到业务预期；共享 KV 不使活跃会话 OOM 或 goodput 退化；新旧 template 同时运行时无跨 domain 命中；缓存开启和关闭下的回答质量、引用、工具调用与安全结果等价。

## 十、高频面试问答

### Q1：为什么把固定 system prompt 放前面能加速？

**答法：**自回归模型会为前缀计算每层 K/V。若固定 system prompt 位于最前且 token 完全一致，后续请求可直接复用它的 K/V，跳过该段 prefill。若固定内容在用户消息或动态 RAG 后面，前缀在前面已经分叉，后续再相同也无法形成同一前缀命中。

### Q2：Prefix Cache 会不会造成跨用户答案泄露？

**答法：**它复用的是 K/V 计算状态而非最终答案，只对完全相同 token 前缀生效，理论上不会直接返回另一用户的文本。但公共前缀不得混入私有信息，model/template/policy/domain 必须兼容；日志、远程 KV 池和路由也要按租户与安全域隔离。真正会直接复用答案的是响应/语义缓存，二者要分开设计。

### Q3：Prefix Cache 命中很高，为什么成本没有明显下降？

**答法：**可能命中的都是短前缀，或者输出 decode token 才是主要成本，也可能亲和路由造成排队抵消了 prefill 收益。应看 token 加权命中、saved prefill token/ms、冷/热 TTFT 和输出 token 占比，不要只看按请求计数的 hit rate。

### Q4：Prompt 发布如何避免缓存命中断崖？

**答法：**将 prompt/template/tool schema 等版本建成 prefix domain；发布前在录制流量评估最长公共前缀与冷启动容量；灰度运行新旧 domain、对稳定公共段做限速预热；若指标异常，优先检查动态字段和序列化顺序，再按 domain 回滚而非全量清缓存。

## 十一、项目讲法

> “我们把 Prompt 设计成稳定前缀与易变上下文两层：系统策略、工具 schema 和 few-shot 由确定性构建器生成，用户问题、会话摘要和 RAG 证据后置。路由按 prefix hash 做有限亲和，同时设置热点溢出避免排队。模型、tokenizer、模板、adapter 和 policy 组成兼容域，发布时新旧域并行灰度并预热公共段。我们用 token 加权命中、saved prefill ms、P95 TTFT、驱逐抖动和每租户公平性评估，而不是只报 hit rate；在权限或模板不确定时宁可回源，也不复用跨域 KV。”

这段表达展示的不是“会开 prefix cache”，而是能把 prompt、推理引擎、容量、发布和安全共同设计成一条可运营链路。
