# LoRA / QLoRA Adapter 服务化、多租户路由与回滚

> 训练出一个 LoRA adapter 只是起点。上线后真正的问题是：它与哪个 base model 兼容、如何不撑爆显存地挂载多个 adapter、谁能调用、如何灰度、如何发现退化并回滚。

## 一、30 秒面试回答

我会把 adapter 当成有依赖和风险标签的模型制品，而不是一个随手上传的权重文件。注册时校验 base model、tokenizer、架构、rank、量化与许可证；发布包绑定 adapter、base model、Prompt、推理参数和评测版本。服务层按租户、任务、区域和质量等级路由到 base 或指定 adapter，并限制可热加载数量和显存预算。新 adapter 先离线做领域、通用、安全与回归评测，再 shadow/灰度；trace 记录实际 adapter 版本和融合/热加载事件。异常时回滚整个 manifest，必要时卸载 adapter 或回到基础模型，而不是在生产环境重新训练。

## 二、制品契约与注册门禁

| 元数据 | 为什么必须保存 |
| --- | --- |
| base model 精确版本与哈希 | adapter 通常只对特定权重/架构兼容 |
| tokenizer 与 chat template | 不一致会导致格式和 token 边界漂移 |
| LoRA target modules、rank、alpha | 影响加载方式、显存和质量 |
| 训练数据/许可证/风险等级 | 支持合规与租户隔离 |
| 评测报告与基线差异 | 避免“能加载就发布” |
| adapter 版本与签名 | 防篡改、可回滚、可审计 |

注册服务应拒绝维度不匹配、未知来源、签名无效、base model 不兼容和评测未通过的制品。不要让在线 worker 从任意 URL 下载权重。

## 三、服务架构

```text
Model registry -> release manifest -> routing policy
       -> adapter cache / loader -> inference worker
       -> usage, trace, quality metrics -> rollback controller
```

Worker 预加载基础模型；adapter 按需从受控制品库加载到 CPU/GPU 缓存。适合热切换的引擎可在同一 base model 上服务多个 adapter，但仍受显存、并发和调度器限制。高风险或超大 adapter 可使用专属副本而非共享热池。

## 四、路由与隔离

路由至少先过滤：数据驻留、租户授权、base model 兼容、任务能力、上下文窗口和安全等级；再比较质量、成本、健康与当前缓存状态。不要根据用户在 Prompt 中写的“请使用金融 adapter”直接选择权重。

| 场景 | 推荐 |
| --- | --- |
| 通用问答 | 基础模型或通用 adapter |
| 稳定领域格式 | 指定已评测 adapter |
| 高敏租户 | 专属 adapter/资源池与严格授权 |
| adapter 不健康或未命中 | 回基础模型或经验证 fallback |

缓存 key、trace 和计量必须包含 `base_model_version + adapter_version + prompt_version`，否则无法复现或正确归因成本。

## 五、显存、热加载与容量

adapter 参数少于全量模型，但多 adapter 同时驻留仍会占 GPU/CPU 内存和加载带宽。设置：最大热驻留数、LRU/TTL、每租户配额、加载并发、预热名单和冷启动预算。持续观察 adapter load latency、命中率、GPU 显存、KV Cache、卸载次数与请求排队。

不要为提高命中率无限保留 adapter：KV Cache 才是在线长上下文并发的核心显存压力。应在 adapter 缓存和有效并发之间预留安全空间。

## 六、合并、量化与兼容性

离线 merge 可以简化在线加载，但会失去灵活路由且需要为每个组合保存完整权重；动态挂载更灵活，但引擎、量化格式和目标模块必须兼容。QLoRA 常用于低资源训练，不等于在线一定只能量化服务。上线前分别验证：输出格式、工具调用、长上下文、吞吐、显存、领域集、通用集和安全集。

## 七、评测、灰度与回滚

新 adapter 不能只在训练集上变好。发布门禁应包含：领域任务、基础通用能力、拒答/安全、结构化输出、成本与延迟。灰度按稳定用户/租户分桶，比较基础模型与 adapter 的任务成功、人工纠错、投诉、token 成本和 OOM。退化时按 release manifest 回滚；已产生的业务副作用仍由工具幂等/补偿机制处理。

### 7.1 Adapter 发布状态机

把 adapter 的生命周期显式建模，避免“上传成功就是线上可用”：

```text
draft -> candidate -> canary -> stable -> deprecated
                         \-> revoked
```

- `draft`：制品仅可被作者和 CI 读取。
- `candidate`：兼容性、签名和离线评测已通过，可预加载但不接真实流量。
- `canary`：稳定分桶的小流量灰度，自动采集质量、OOM、加载和成本指标。
- `stable`：路由策略可选择的正式版本，仍保留基线与回滚指针。
- `deprecated/revoked`：不再接受新请求；`revoked` 用于安全、许可证或严重质量事件，立即阻断新加载。

每个状态转换写入不可变 release manifest：制品 digest、base model/tokenizer/chat template、PEFT 配置、量化/引擎版本、租户范围、评测证据、审批人与生效时间。路由只读取已批准的状态，而不是依据文件名或最新上传时间。

### 7.2 会话黏附与原子切换

同一个会话或可恢复 run 必须固定 effective adapter 版本。否则用户在多轮对话、流式重连或工具重试中可能前半段使用 `v12`、后半段使用 `v13`，结果无法复现。运行快照和缓存 key 至少包含：

```text
tenant + isolation domain + base model + adapter digest
+ prompt version + engine/quant config + routing policy version
```

发布时先将 candidate 预加载并做健康探针，再原子更新 routing pointer；在途请求继续使用原快照，旧 adapter 等待 drain 后卸载。紧急 revoke 则阻断新请求、失效相关缓存，并按风险回退到已验证的 stable adapter 或基础模型。

### 7.3 Adapter 专项观测与暂停阈值

除通用质量门禁外，按 `base + adapter + prompt + engine/quant` 组合观察：加载延迟、热加载命中率、GPU 显存、KV 分配失败、OOM、队列等待、成本、领域成功率和通用能力回归。预先定义自动暂停 canary 的规则，例如：连续质量回归、OOM 超过基线、加载错误增加或安全拒绝异常。排障时先核对 digest 与兼容矩阵，再看路由/缓存、引擎热加载和实际容量，避免把 adapter 问题误判为模型整体退化。

## 八、高频问答

**Q：多 adapter 如何避免串租户？**

注册、路由和制品下载都按租户/授权控制；请求的 adapter 由可信策略选择；缓存与 trace 带租户和版本；专属或高敏 adapter 使用独立资源边界。模型层不能作为唯一隔离手段。

**Q：adapter 比全量微调的生产优势是什么？**

制品更小、训练和存储成本低，可复用同一基础模型并快速灰度/回滚；代价是兼容性、热加载、路由和质量回归更复杂，不能把它当作零成本插件。

**Q：adapter 质量退化怎么定位？**

先固定 base、tokenizer、Prompt、数据切片和评测版本，比较 adapter 与基线的领域/通用/安全指标；再看路由是否选错、加载是否失败、量化/模板是否变更，最后决定回滚、修复数据还是重新训练。

## 九、项目讲法模板

> 我们将 LoRA 制品纳入模型注册表，校验其 base model、tokenizer、量化与评测报告，并以 manifest 绑定线上 Prompt、参数和路由策略。推理服务在同一基础模型上受控热加载 adapter，按租户与任务路由，同时用显存预算和缓存上限保护 KV Cache。新版本先通过领域、通用、安全和延迟门禁，再灰度；trace 记录实际 adapter，出现退化可一键回到稳定 manifest。这让低成本微调真正变成可运营能力。

继续学习：[LoRA 微调](/finetuning/lora)、[量化与部署](/inference/quantization)、[微调平台面试题](/interview/finetuning-platform-qna)、[LLM 推理容量与弹性伸缩设计](/interview/llm-inference-capacity-autoscaling-playbook)、[LLM 评测与发布门禁实战](/interview/evaluation-release-gates)。
