# 推理部署与成本治理高频问答

> 这页面向 AI Infra、推理部署、模型平台、Java AI 后端岗位。面试官通常不会只问「vLLM 用过吗」，而会追问：为什么慢、怎么压测、怎么估卡、怎么量化、怎么降成本、线上 SLA 被打爆时怎么止血。相关原理见 [推理优化与部署](/inference/inference-optimization)、[推理框架对比](/inference/serving-frameworks)、[推理性能压测](/inference/inference-benchmark)、[量化实战](/inference/quantization)。

## 怎么用这页

1. 先背 Prefill / Decode / KV Cache / TTFT / TPOT / goodput 这组共同语言。
2. 再用「框架选型 -> 压测报告 -> 容量规划 -> 成本治理 -> 降级预案」组织系统设计答案。
3. 项目讲法不要只说部署了某个模型，要能拿出 SLA、压测曲线、成本公式、回滚策略和上线验收证据。

## 推理基础：Prefill / Decode / KV Cache

**Q：Prefill 和 Decode 有什么区别？为什么一定要分开讲？**  
Prefill 是处理输入 prompt，一次性并行计算整段上下文，主要影响 TTFT，瓶颈更偏算力。Decode 是自回归逐 token 生成，每一步都要读权重和历史 KV Cache，主要影响 TPOT、吞吐和输出成本，瓶颈更偏显存带宽。面试里分开讲，是因为优化手段不同：Prefill 看 prompt 长度、chunked prefill、prefix cache、张量并行；Decode 看连续批处理、量化、KV Cache 管理、投机解码。

**Q：为什么 output token 通常比 input token 贵？**  
Input token 在 Prefill 阶段可以并行算完；output token 必须逐个生成，每生成一个 token 都要读取模型权重和 KV Cache。输出越长，Decode 阶段越久，显存带宽和 GPU 时间占用越多，所以 API 和私有化成本里输出 token 更贵。

**Q：KV Cache 怎么估显存？**  
粗略口径是：`batch_size * sequence_length * layers * kv_heads * head_dim * 2(K/V) * bytes_per_element`。如果使用 GQA/MQA/MLA，`kv_heads` 会下降；如果做 KV 量化，`bytes_per_element` 会下降。面试里重点不是背公式，而是说清楚 KV Cache 随并发和上下文长度线性增长，长上下文 + 高并发最容易把显存打满。

**Q：长上下文并发为什么容易 OOM？**  
权重显存基本固定，但 KV Cache 会随用户数、上下文长度、输出长度增长。一个 32K 请求不只 Prefill 慢，还会长期占用 KV Cache；当多个长会话同时 Decode，显存碎片和 KV 占用会让可接入并发迅速下降。应对思路是上下文裁剪、摘要、RAG 替代超长上下文、PagedAttention、KV 量化、prefix cache、并发准入和超长请求隔离队列。

## 框架选型：vLLM / SGLang / TensorRT-LLM / llama.cpp

**Q：生产推理框架怎么选？**  
默认先看 vLLM：生态成熟、OpenAI 兼容接口、PagedAttention、continuous batching、LoRA 管理和社区资料都丰富。多轮 Agent、结构化输出、公共前缀复用很多时看 SGLang。NVIDIA 硬件上追极致性能、愿意承受工程复杂度时看 TensorRT-LLM。端侧、本地开发、离线演示或消费级硬件看 llama.cpp / Ollama。真正的选型要补一句：最终用同一模型、同一输入输出分布、同一 SLA 压测，不靠框架名拍脑袋。

**Q：vLLM 的 PagedAttention 解决什么？**  
传统 KV Cache 连续预分配会产生碎片和浪费，尤其请求长度差异很大时。PagedAttention 把 KV Cache 像操作系统分页一样按块管理，逻辑连续、物理可不连续，提升显存利用率和并发吞吐，是 vLLM 能扛在线请求的重要基础。

**Q：SGLang 的 RadixAttention 适合什么场景？**  
适合大量公共前缀复用的场景，例如多轮 Agent、固定系统提示、同一工作流多次调用模型、结构化输出密集任务。它用前缀树识别和复用 KV Cache，比只复用固定 system prompt 更细。面试里可以说：不是所有场景都比 vLLM 好，要看 prefix 命中率和结构化输出占比。

**Q：TensorRT-LLM 为什么性能强，但不是所有团队都用？**  
它深度绑定 NVIDIA GPU、kernel、图优化、FP8/INT8 能力，极致性能很好。但模型适配、构建、版本兼容、调试和运维复杂度更高。适合流量大、硬件统一、性能收益能覆盖工程成本的平台团队；中小业务先用 vLLM/SGLang 更稳。

## 性能压测：TTFT / TPOT / goodput / SLA

**Q：评估推理服务只看 tokens/s 行不行？**  
不行。tokens/s 是裸吞吐，可能靠牺牲延迟堆出来。在线服务要同时看 TTFT、TPOT/ITL、E2E 延迟、P95/P99、错误率、排队时间、GPU 利用率、显存占用、KV Cache 命中率和 goodput。goodput 是满足 SLA 的有效吞吐，比峰值吞吐更接近业务价值。

**Q：goodput 怎么解释给面试官？**  
假设 SLA 是 TTFT < 1s、TPOT < 50ms，只有满足这个 SLA 的请求贡献的 token/s 才算 goodput。一个配置总吞吐很高，但 P95 TTFT 已经 5s，就不能说它能服务在线对话。调参目标是在 SLA 内找到最大有效吞吐，而不是把 batch 拉到最大。

**Q：一份可信的压测报告必须写什么？**  
至少写：模型版本、精度、推理框架、硬件、并行策略、输入输出长度分布、并发梯度、请求到达模式、采样参数、TTFT/TPOT/E2E 分位数、吞吐、goodput、错误率、GPU 利用率、显存/KV 占用、成本口径。只给「某卡某模型 X token/s」通常不可信，因为输入输出长度和 SLA 可能完全不同。

**Q：怎么做容量规划？**  
先从业务目标反推：峰值 QPS、平均输入长度、平均输出长度、SLA、可接受排队时间。再用压测得到单卡或单实例在该 SLA 下的 goodput。粗略估算：`所需 GPU 数 = 峰值有效 token/s / 单 GPU goodput * 冗余系数`。冗余系数要覆盖流量波动、故障、灰度、长尾请求和批量任务挤占。

## 成本治理：$/百万 token、模型路由、缓存

**Q：私有化部署怎么计算单 token 成本？**  
常用口径是：`$/百万 token = GPU 小时成本 / 每小时有效 token 数 * 1,000,000`。如果是自购 GPU，还要把折旧、机房、电力、运维、空闲率算进去。面试里要强调有效 token 数最好用 goodput，不要用超 SLA 的峰值吞吐粉饰成本。

**Q：降低成本有哪些手段？**  
先分层：减少不必要 token、提升单卡有效吞吐、把请求路由到合适模型。具体手段包括 prompt 压缩、RAG 只塞必要证据、prefix cache、语义缓存、连续批处理、W4A16/W8A8/FP8 量化、KV 量化、投机解码、冷热模型分层、小模型处理简单意图、大模型处理复杂任务、离线任务错峰。

**Q：Self-Consistency / Best-of-N 这类 test-time scaling 怎么控成本？**
先承认它本质上是在推理时多花算力：K 条采样、搜索树或 PRM 打分都会放大 token 和 GPU 时间。生产里不能固定 K=32 乱跑，而要做动态预算：简单题 K=1，难题再升 K；投票置信度足够就 early stopping；多条采样共享 prefix cache；可验证任务才上 BoN/PRM；离线高价值任务才考虑 ToT/MCTS。详见 [推理时算力扩展](/inference/test-time-scaling)。

**Q：模型路由怎么设计？**  
先做意图和难度分级：简单 FAQ、格式转换、分类抽取走小模型；复杂推理、长上下文、多工具任务走大模型；高价值用户或高风险任务走更强模型并加审计。路由策略要可观测：记录命中原因、成本、效果、回退路径，并定期用评测集校准，避免为了省钱牺牲关键任务成功率。

**Q：缓存会不会导致错误答案复用？**  
会，所以缓存要分层和带边界。Prefix cache 复用 KV，相对安全；语义缓存复用答案，要绑定模型版本、prompt 版本、用户权限、知识库版本、时间有效期和相似度阈值。RAG 场景绝不能跨租户复用答案；知识库更新后要能失效缓存。

## 量化与压缩：W4A16 / W8A8 / FP8 / KV 量化

**Q：W4A16 和 W8A8 怎么选？**  
W4A16 只量化权重，激活仍用 FP16，主要省显存、降访存，适合显存受限和 Decode 访存瓶颈。W8A8 权重和激活都 8bit，可以利用 INT8 算力提升吞吐，但对 outlier 和 kernel 支持要求更高。H100/H200 等硬件上可考虑 FP8。选型时先看瓶颈是显存、带宽还是算力，再用业务评测集验精度。

**Q：量化上线前要验什么？**  
验三类：效果、性能、稳定性。效果看真实业务集、长上下文、结构化输出、拒答和安全样本，相对 FP16 基线的掉点是否可接受；性能看 TTFT、TPOT、goodput、显存、成本；稳定性看长压、OOM、不同长度分布、并发波动和回滚。只看 PPL 或只跑几条样例不够。

**Q：KV Cache 量化和权重量化有什么不同？**  
权重量化主要减少模型权重显存和每步读取量；KV Cache 量化减少会话状态显存，直接提升长上下文和高并发容量。风险也不同：KV 量化过激可能伤长文本一致性、引用准确性和多轮记忆，因此必须覆盖长上下文评测。

## 私有化部署项目讲法

**Q：让你设计一个企业私有化大模型服务，怎么答？**  
可以按六层讲：

1. **入口层**：OpenAI 兼容 API、鉴权、租户、限流、审计、SSE。
2. **路由层**：按模型能力、成本、延迟、租户策略和健康状态路由。
3. **推理层**：vLLM/SGLang/TensorRT-LLM，连续批处理、prefix cache、量化、LoRA 热加载。
4. **容量层**：GPU 池、队列、准入控制、长短请求隔离、弹性扩缩、故障转移。
5. **观测层**：TTFT、TPOT、goodput、错误率、GPU/KV、每租户成本、bad case。
6. **治理层**：模型目录、版本灰度、评测门禁、安全策略、成本预算、回滚。

**Q：线上突然 TTFT 飙升，怎么排查？**  
先看排队时间是否升高，再看 Prefill 是否被长 prompt 打满，是否有批量任务挤占在线池，prefix cache 命中率是否下降，GPU 利用率和显存是否异常，模型或 prompt 是否刚发布。止血动作包括限流、隔离长请求、降低 max input/output token、切小模型、关闭低优先级任务、扩容 prefill 池或回滚版本。

**Q：线上 TPOT 飙升，怎么排查？**  
TPOT 偏 Decode，先看 batch 是否过大、KV Cache 是否接近上限、显存带宽是否打满、量化 kernel 是否退化、输出长度是否异常增长。止血可以降并发、缩短 max output token、启用更激进量化或小模型路由，必要时拆分在线和离线流量。

## 面试前 30 分钟速背

1. Prefill 看 TTFT，Decode 看 TPOT 和输出成本。
2. Decode memory-bound，量化和 batching 对它最有效。
3. KV Cache 随上下文和并发线性增长，是长上下文容量瓶颈。
4. vLLM 默认生产首选，SGLang 强在前缀复用和结构化输出，TensorRT-LLM 强在 NVIDIA 极致性能。
5. 压测看 goodput，不只看裸吞吐。
6. 容量规划用业务峰值 token/s 除以单卡 SLA goodput，再乘冗余。
7. 成本口径用 $/百万有效 token，别用超时吞吐装便宜。
8. 降成本靠少 token、提吞吐、模型路由、缓存、量化和错峰。
9. 量化上线要验效果、性能、稳定性三类门禁。
10. 私有化项目要讲入口、路由、推理、容量、观测、治理六层。
