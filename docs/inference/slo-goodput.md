---
title: 推理 SLO 账本：TTFT、TPOT 与 goodput 的可复算口径
description: 从客户端计时、token 间隔、失败分母和负载模型出发计算推理 goodput，避免用成功样本延迟或峰值吞吐误判服务容量。
level: L2
roles:
  - Infra
  - 后端转型
  - 应用开发
classification: inferred
---
# 推理 SLO 账本：TTFT、TPOT 与 goodput 的可复算口径

> **要交付的能力**：面对两份“更快”的压测报告，能核对计时边界、负载、失败和 SLO，而不是只比较 token/s。
>
> L1 读指标表和反例；L2 运行请求账本并写报告；L3 区分开放负载、样本权重与容量边界。前置：[推理性能压测](/inference/inference-benchmark)、[KV 预算](/inference/kv-cache)。

## 1. 从哪一刻开始计时，决定你测到什么

| 时间点 | 定义示例 | 需要明确的边界 |
| --- | --- | --- |
| 请求开始 | 客户端开始发送请求 | 是否包含连接建立、序列化、重试 |
| 首次输出 | 客户端收到首个含生成内容的事件 | 不应把心跳、空事件或角色字段当 token |
| 最后输出 | 客户端收到最后一个生成内容事件 | 流事件可能包含多个 token |
| 请求结束 | 读到终止事件或连接完成 | 可能晚于最后一个 token |

使用单调时钟记录耗时；服务端的 prefill/decode 计时与客户端的端到端计时不是同一指标。客户端 TTFT 可能包含网络、排队、调度与首次生成，不等于纯 prefill 时间。

HTTP 200 也不必然表示请求完成：流中断、后续错误、超时和客户端取消都应进入账本。请求重试则要同时保留“用户逻辑请求”和“物理尝试”的标识，避免把重试当新增成功用户。

## 2. TPOT 与 ITL：平均间隔不是间隔分布

令 n 为实际生成的输出 token 数。若计时终点是最后一个 token，并能观察逐 token 时间：

令请求开始时刻为 t_start，逐 token 到达时刻为 t_1...t_n，且所有时间使用同一单位：

$$
\begin{aligned}
\mathrm{TTFT}&=t_1-t_{\mathrm{start}}\\
\mathrm{ITL}_i&=t_i-t_{i-1},\quad i=2,\ldots,n\\
\mathrm{TPOT}&=\frac{t_n-t_1}{n-1},\quad n>1\\
t_n-t_{\mathrm{start}}&=\mathrm{TTFT}+(n-1)\mathrm{TPOT}
\end{aligned}
$$

首 token 已被 TTFT 计入，所以只剩 n−1 个间隔。用 n 相乘会多算一个平均间隔。

实际实现也可能将请求结束时间用作 E2E。vLLM v0.19.1 的服务压测实现按下式计算 TPOT：[1]

~~~text
TPOT_proxy = (E2E_observed - TTFT) / (n-1)，n > 1
~~~

这个平均值可能包含最后 token 之后的协议尾部开销。若服务流事件合并多个 token，观察到的 chunk 间隔也不是逐 token ITL。**报告必须说明观测单位，不应以平滑的流事件伪装成细粒度 token 测量。**

- **n=1**：没有生成后续 token 的间隔，TPOT 在数学上未定义。
- **n=0**：检查失败、空输出或协议行为，不能无条件当作正常单 token 请求。
- **同样平均 TPOT**：一个请求均匀输出，另一个有长停顿和短突发，用户体验可能不同。
- **P95 TPOT**：每请求平均间隔的分位数；与全部间隔混合后计算的 P95 ITL 不等价。

vLLM 该版本为 goodput 判定将 n<=1 的 TPOT 设为 0，而 TPOT 统计列表只收 n>1 的样本。这是实现约定，不是数学定义；读取报告时要保留这一差别。[1]

## 3. 请求 goodput：先写 SLO 谓词，再计算吞吐

本页的教学 SLO：TTFT≤1000ms、TPOT≤50ms、E2E≤2000ms。**这些是构造阈值，不是全行业推荐值。** 单 token 请求只检验 TTFT 与 E2E，并单独报告数量。

~~~text
good(request) = 请求成功完成 AND 所有适用的 SLO 都满足
请求完成吞吐 = 成功完成数 / 测试秒数
请求 goodput = good 请求数 / 测试秒数
成功率 = 成功完成数 / 全部提交数
SLO 达标比例 = good 请求数 / 全部提交数
~~~

失败不能进入 good 分子，也不能从提交数分母中消失。vLLM 的参考实现使用满足所配 SLO 的已成功请求数除以测试时长，得到请求 goodput。[1]

另一种可定义的量是**达标请求贡献的输出 token/s**。它不是 request goodput：长输出请求权重更高，也不能和输入+输出总 token/s 混用。指标名称必须写全。

测量时间窗也要一致。本页采用有限请求 cohort：从开始提交到全部完成或超时，包含 drain，分母是这段总时长。稳态固定时间窗则应明确跨窗请求的归属，报告未完成数；不能用窗口内到达数配窗口内完成延迟而忽略右删失。

## 4. 可运行：六条请求的性能账本

以下耗时和 token 数全部为**构造数据**，演示归一化与分母；不是任何硬件、模型或框架的实测。假设六个请求在一个包含 drain 的 10 秒测试中全部得到终态。

~~~python
from collections import Counter
from math import isclose

records = [
    {"id": "r1", "success": True, "tokens": 11, "ttft_ms": 200, "e2e_ms": 600},
    {"id": "r2", "success": True, "tokens": 11, "ttft_ms": 1100, "e2e_ms": 1400},
    {"id": "r3", "success": True, "tokens": 5, "ttft_ms": 100, "e2e_ms": 400},
    {"id": "r4", "success": True, "tokens": 1, "ttft_ms": 400, "e2e_ms": 450},
    {"id": "r5", "success": False, "tokens": 0, "ttft_ms": None, "e2e_ms": None},
    {"id": "r6", "success": True, "tokens": 6, "ttft_ms": 300, "e2e_ms": 500},
]
duration_seconds = 10.0
limits = {"ttft_ms": 1000, "tpot_ms": 50, "e2e_ms": 2000}
if duration_seconds <= 0:
    raise ValueError("Duration must be positive")

reasons = Counter()
completed = []
good = []
single_token_count = 0
for record in records:
    if not record["success"]:
        reasons["request_failed"] += 1
        continue
    tokens = record["tokens"]
    ttft = record["ttft_ms"]
    e2e = record["e2e_ms"]
    if tokens < 1 or ttft is None or e2e is None or not (0 <= ttft <= e2e):
        raise ValueError("Invalid successful request ledger")
    completed.append(record)
    tpot = (e2e - ttft) / (tokens - 1) if tokens > 1 else None
    if tokens == 1:
        single_token_count += 1
    violations = []
    if ttft > limits["ttft_ms"]:
        violations.append("ttft")
    if tpot is not None and tpot > limits["tpot_ms"]:
        violations.append("tpot")
    if e2e > limits["e2e_ms"]:
        violations.append("e2e")
    reasons.update(violations)
    if not violations:
        good.append(record)

submitted = len(records)
print("completed_rps", len(completed) / duration_seconds)
print("request_goodput_rps", len(good) / duration_seconds)
print("success_rate", len(completed) / submitted if submitted else None)
print("slo_over_submitted", len(good) / submitted if submitted else None)
print("completed_output_tokens_per_s",
      sum(record["tokens"] for record in completed) / duration_seconds)
print("good_request_output_tokens_per_s",
      sum(record["tokens"] for record in good) / duration_seconds)
print("single_token_count", single_token_count)
print("violations_not_mutually_exclusive", dict(reasons))
assert len(completed) == 5 and len(good) == 3
assert isclose(len(good) / duration_seconds, 0.3)
assert sum(record["tokens"] for record in good) == 18
~~~

| 结果 | 数值 | 解读 |
| --- | --- | --- |
| 完成请求吞吐 | 0.5 req/s | 5 条请求成功完成 |
| 请求 goodput | 0.3 req/s | 只有 3 条满足本页 SLO |
| 成功率 | 5/6 | 失败保留在提交分母 |
| SLO 达标比例 | 3/6 | 不等于成功请求中的 3/5 |
| 成功请求输出吞吐 | 3.4 token/s | 包含超 SLO 的成功请求 |
| 达标请求输出吞吐 | 1.8 token/s | 不是请求 goodput |

违反条件可能重叠，计数之和不必等于超标请求数。需要同时保存每条请求的原因集合，不能把多项超标简单当多次失败。

## 5. 开放负载与固定并发，测的是不同问题

- **固定并发 / 闭环**：一个请求结束才补下一个。服务变慢时提交速率自动降低，适合测给定并发下的效率，但可能掩盖真实持续到达的排队压力。
- **固定到达率 / 开环**：按预设时刻提交。服务变慢时积压可能增长，更适合检查指定到达过程下的 SLO；还须测压测客户端能否按时发出。
- **突发负载**：平均 RPS 相同，峰值排队也可能不同。报告到达间隔和 burst 条件，不只写平均并发。

Little's Law 的 L=λW 在稳定系统、统一边界等条件下可用于交叉核对平均在途量、到达率与停留时间；不是让“并发=RPS×P95延迟”的通用公式。

扫描到达率时同时画 goodput、成功率、TTFT/TPOT 分位数和积压，而不是寻找最高吞吐点。Prefill 常偏算力密集、decode 常偏访存密集，但瓶颈还取决于 batch、上下文、硬件、并行通信与运行时，必须通过测量检验。

## 6. 一份可比较的报告至少包含什么

| 类别 | 必须记录 |
| --- | --- |
| 实现 | 模型、tokenizer、模板、精度、框架版本、提交或镜像 |
| 硬件 | GPU 型号与数量、显存、互联、并行方式 |
| 负载 | 输入/输出长度分布、请求数、到达过程、并发、终止与重试规则 |
| 缓存 | 前缀复用、冷/热状态、KV 策略、预热规则 |
| 计时 | 客户端/服务端边界、chunk/token、超时、测试与 drain 时长 |
| 结果 | 提交/成功/失败/未完成、SLO 定义、goodput、延迟样本数与分位数 |
| 成本 | 同质量约束下的资源时长、费用与预算，不从峰值吞吐直接推月成本 |

只对成功请求报告延迟分位数是可以的，**但必须标注样本范围并同时报告失败**。样本太少时 P99 对个别值极敏感；重复测试和报告原始分布比假装给出稳定容量更诚实。

## 7. 实践与面试追问

**最小交付**：原始请求账本、SLO 谓词、同条件负载配置、失败分布和一份可重算报告；没有 GPU 时交付构造演示与实验设计，不写“实测达到”。

<details>
<summary>复算：重试后成功，用户成功率和物理尝试成功率相同吗？</summary>

构造两个用户请求：第一个尝试两次后成功，第二个尝试一次失败。共 3 次物理尝试、1 次成功尝试，尝试成功率为 1/3；共 2 个逻辑用户请求、1 个最终成功，用户成功率为 1/2。两种口径都可以报告，不能混用分母。用户端到端时延还必须包含重试等待；只测最后一次成功尝试可能伪造 SLO 达标。

</details>

- **token/s 翻倍，为什么体验更差？** 可能是长输出、batch 或排队变化；检查 goodput、长度分布与失败。
- **TPOT 很好，为什么中途卡顿？** 每请求平均值隐藏尾部间隔，或服务按 chunk 合并；查看观测粒度与 ITL 分布。
- **单 token 请求 TPOT=0 是不是无限快？** 不是；只是某些实现的统计约定，没有后续间隔可测。
- **峰值吞吐能直接给生产容量吗？** 不能；还缺到达分布、SLO、稳定性、冗余和成本约束。

继续阅读：[KV Cache 复算](/inference/kv-cache) · [裁判校准](/evaluation/judge-calibration) · [一手资料阅读地图](/advanced/primary-source-reading)

## 一手来源与证据范围

资料核对日期：2026-11-04。

1. [vLLM v0.19.1：服务压测实现文档](https://docs.vllm.ai/en/v0.19.1/api/vllm/benchmarks/serve/)：核对 calculate_metrics 的 TPOT、单 token 处理与 request_goodput 代码摘录。选定版本用于明确口径，不代表推荐版本或最新版本。

本页计时契约、请求账本、负载说明和实验建议为工程整理；未进行硬件压测，也未据此为任何部署给出容量保证。
