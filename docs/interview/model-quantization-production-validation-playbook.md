# 模型量化生产验收、精度回归与回滚系统设计

> INT8、INT4、AWQ、GPTQ 的目标不是“模型能跑起来”，而是在指定硬件、引擎和业务任务上用更少显存换取可接受的质量、延迟和稳定性。量化上线失败往往表现为工具 JSON 偶发失效、长上下文退化或 OOM，而不是一个平均 benchmark 分数下降。

## 一、30 秒面试回答

我会把量化视为模型制品变体，绑定 base model、量化算法/校准集、权重与 KV 精度、推理引擎、硬件和 tokenizer。候选量化版先在相同 Prompt、工具、RAG、长度分布和并发下与 FP 基线比较领域任务、通用能力、安全、结构化输出、长上下文、TTFT/TPOT、显存和 SLA goodput。通过门禁后 shadow 与灰度，trace 记录实际量化配置；出现关键切片质量退化、JSON/tool 调用失败、OOM 或 P99 变差时按 manifest 回滚到已验证精度。量化不是一次离线转换，而是可观测、可比较、可撤销的服务发布。

## 二、验收维度

| 维度 | 不能遗漏的检查 |
| --- | --- |
| 质量 | 领域、通用、安全、语言、长尾切片 |
| 契约 | JSON schema、tool calling、函数参数、引用格式 |
| 长上下文 | 检索证据、位置偏差、最大窗口、KV 行为 |
| 性能 | TTFT、TPOT、SLA goodput、加载时间 |
| 容量 | 权重显存、KV Cache、并发、碎片、OOM |
| 兼容 | 引擎、GPU、算子、tokenizer、chat template |

不要只在短问答上测 perplexity 或 tokens/s。生产回归集必须包含真实输入输出长度和高风险任务。

## 三、发布制品与对照实验

```text
base model digest + quant method/config + calibration dataset hash
+ weight/KV precision + engine/hardware + prompt/tool/index versions
+ eval report + rollout policy
```

对照实验固定数据、随机种子、并发、模型参数和硬件。比较 `FP baseline` 与候选量化版的质量-成本曲线，而非只比较单点吞吐。若 INT4 节省显存却导致需要更多重试、fallback 或人工复核，实际每成功任务成本可能更高。

### 3.1 可判定的非劣门禁与运行证据

关键切片预先定义非劣阈值、最小样本量和置信区间；schema/tool/safety 等合约失败属于硬失败，不允许用平均分抵消。逐样本配对比较基线与候选，使用 bootstrap CI 或重复运行处理非确定性；golden/bad-case 集冻结版本、标签复核并与训练数据隔离。面对“胜率差 0.8% 能否发布”，回答应是看 CI、关键切片和硬失败，而非看一个平均数字。

线上 trace/metrics 还要证明实际运行的是目标配置：权重与 KV 精度、kernel 命中率、dequant/fallback 比率、engine、CUDA/driver 和权重 digest。否则部署了 INT4 文件却静默回退 FP16，容量与成本结论都不成立。

## 四、灰度、告警与回滚

量化灰度应稳定分桶，分别观察质量、schema valid rate、工具成功、拒答、TTFT、TPOT、KV 使用率、OOM、fallback、成本和用户纠错。停止规则预先定义：关键安全/权限退化、结构化输出失败、P99 超标、OOM 增长或真实成本无收益时暂停。回滚是切换到上一个 base+precision+engine manifest；在途请求固定已有快照，避免同一会话混用不同数值精度。

### 4.1 容量分位数与原子回滚

容量使用 P95/P99 输入输出长度、突发到达、Prefill/Decode 竞争、KV 碎片和长请求隔离来测每实例可接纳并发，再加入 N+1、灰度余量、故障域和冷启动时间。成本口径统一为 `(推理 + 重试 + fallback + 人工介入) / 成功任务数`，并按任务切片比较。

灰度使用稳定 hash 分桶、候选/基线对照、最小样本量与连续 N 个观察窗口；安全/合约失败立即回滚，其他指标触发自动暂停。回滚时原子切换路由权重，新请求读取旧 manifest，在途会话保持 affinity；tokenizer、chat template、LoRA、索引和缓存均按 manifest 隔离或失效，随后运行自动验收与演练记录。

## 五、高频问答

**Q：为什么量化后模型更快却不一定更划算？**

权重更小可提高可容纳并发，但若质量下降导致输出变长、重试、fallback 或人工介入，端到端成本会上升。必须按每成功任务成本和 SLA goodput 评估。

**Q：量化会影响 KV Cache 吗？**

权重量化主要降低权重显存；KV 精度是另一项选择，直接影响长会话容量和质量。两者要分别记录、压测和回归，不能把“INT4 模型”当作完整配置描述。

**Q：怎样发现量化的隐藏退化？**

按任务、语言、长度、工具/JSON、RAG 引用和安全切片评测；线上 shadow 与灰度监控 schema、工具成功、用户纠错和 fallback。平均分不变也可能掩盖关键长尾失败。

## 六、项目讲法模板

> 我们将量化版作为带完整 manifest 的模型制品发布，固定算法、校准数据、权重/KV 精度、引擎和硬件。离线在真实长度与并发下对比 FP 基线的任务质量、工具 JSON、长上下文、TTFT/TPOT、显存和 SLA goodput；灰度按稳定用户分桶，监控 OOM、fallback 和每成功任务成本。达到停止规则立即回滚到稳定精度，因此量化从“跑分优化”变成可验证的生产容量优化。

继续学习：[模型量化](/inference/quantization)、[推理成本与性能优化](/interview/inference-cost-qna)、[LLM 推理容量与弹性伸缩设计](/interview/llm-inference-capacity-autoscaling-playbook)、[LoRA Adapter 服务化与回滚设计](/interview/lora-adapter-serving-governance-playbook)。
