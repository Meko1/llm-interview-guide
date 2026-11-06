---
title: 大模型手撕代码题解集
description: 通过注意力、位置编码、采样、归一化与低秩适配的教学实现训练推理能力，明确数值假设、张量形状和运行限制。
level: L2
roles:
  - 应用开发
  - 后端转型
classification: inferred
---
# 大模型手撕代码题解集

> 本页选择 11 个机制做手写练习，不声称招聘频率或排名。代码为教学片段，不是完整模型：Python 3.10+、PyTorch 为前置，后续片段复用第一段的 torch/nn/F；KV 示例还需要满足接口约定的模型。未做跨版本、GPU、低精度和性能实测，不保证复制即能运行所有模型。

## 手撕题考察什么

| 题目 | 建议验证边界（非排名） | 核心考点 |
| --- | --- | --- |
| 多头注意力（MHA） | mask 广播与全屏蔽行 | 维度变换、缩放、causal mask |
| RMSNorm / LayerNorm | 全零、dtype 与 eps | 归一化公式、数值稳定性 |
| RoPE 旋转位置编码 | 偶数维、绝对位置偏移 | 复数旋转、相对位置性质 |
| Top-k / Top-p 采样 | 零温度、并列、阈值 | 解码策略、概率截断 |
| Self-Consistency 投票 | 解析失败、平票与剩余预算 | 多采样、归一化、严格领先停止 |
| 带 KV Cache 的解码 | 单序列、EOS 与 cache position | Prefill/Decode 两阶段 |
| LoRA 线性层 | 矩阵方向与首步梯度 | 低秩分解、初始化策略 |
| DPO Loss | 回答 mask 与参考模型冻结 | 偏好对齐目标函数 |
| SwiGLU FFN | 三矩阵参数预算 | 门控激活结构 |
| 简化版 BPE | tie-break 与词边界 | 分词训练流程 |
| 交叉熵与困惑度 | 全忽略目标与 token 加权 | 语言模型损失、错位预测 |

面试官的评分点通常是：**维度标注是否清晰、边界细节（mask、eps、初始化）是否正确、能否边写边解释为什么**。

## 一、手撕多头注意力（MHA）

先约定本实现 mask 中非零表示允许；不是所有 PyTorch API 都采用同一语义。仅实现自注意力，没有 dropout、padding query 输出清零或融合内核。

```python
import math
import torch
import torch.nn as nn
import torch.nn.functional as F

class MultiHeadAttention(nn.Module):
    def __init__(self, d_model: int, n_heads: int):
        super().__init__()
        assert d_model % n_heads == 0
        self.n_heads = n_heads
        self.d_head = d_model // n_heads
        self.q_proj = nn.Linear(d_model, d_model)
        self.k_proj = nn.Linear(d_model, d_model)
        self.v_proj = nn.Linear(d_model, d_model)
        self.o_proj = nn.Linear(d_model, d_model)

    def forward(self, x, mask=None):
        B, T, _ = x.shape
        # [B, T, d_model] -> [B, n_heads, T, d_head]
        q = self.q_proj(x).view(B, T, self.n_heads, self.d_head).transpose(1, 2)
        k = self.k_proj(x).view(B, T, self.n_heads, self.d_head).transpose(1, 2)
        v = self.v_proj(x).view(B, T, self.n_heads, self.d_head).transpose(1, 2)

        # 注意力分数 [B, n_heads, T, T]，除以 sqrt(d_head) 防止 softmax 饱和
        scores = q.float() @ k.float().transpose(-2, -1) / math.sqrt(self.d_head)
        if mask is not None:
            allowed = torch.broadcast_to(mask.to(device=scores.device) != 0, scores.shape)
            if not allowed.any(dim=-1).all():
                raise ValueError("每个 query 至少需要一个允许的 key")
            scores = scores.masked_fill(~allowed, float('-inf'))
        if torch.isnan(scores).any() or torch.isposinf(scores).any() or not torch.isfinite(scores).any(dim=-1).all():
            raise ValueError("注意力分数存在无效值")
        attn = F.softmax(scores, dim=-1)

        out = attn.to(v.dtype) @ v                    # [B, n_heads, T, d_head]
        out = out.transpose(1, 2).reshape(B, T, -1)   # 拼回 [B, T, d_model]
        return self.o_proj(out)

# causal mask：下三角为 1，保证位置 t 只能看到 <= t 的 token
T = 8
mask = torch.tril(torch.ones(T, T))
```

**考点解析**：

- **为什么除以 $\sqrt{d_k}$**：在各维独立、零均值、单位方差的近似下，点积方差随维度增长；缩放缓解 softmax 饱和，不是所有输入必然梯度消失的定律。
- **mask 加在 softmax 之前**：至少有一个有限允许分数时，非法位置概率为0；全行屏蔽会得到未定义归一化，本实现显式报错。padding mask 建议 [B,1,1,T]，causal 为 [T,T]，组合后还需处理 padding query。
- **维度变换链路**：`view` 拆头 → `transpose` 把 head 维提前（让每个头独立做矩阵乘）→ 算完 `transpose` 回来 → `reshape` 合并。`transpose` 后内存不连续，所以最后用 `reshape`（或先 `.contiguous()` 再 `view`）。

**常见追问**：改写成 GQA 怎么改？——K/V 投影输出维度改为 `n_kv_heads * d_head`，计算时用 `repeat_interleave` 把 KV 头复制到与 Q 头数对齐。

## 二、手撕 RMSNorm

```python
class RMSNorm(nn.Module):
    def __init__(self, dim: int, eps: float = 1e-6):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(dim))

    def forward(self, x):
        # 升到 float32 计算，避免 BF16/FP16 下平方求和的精度损失
        rms = x.float().pow(2).mean(dim=-1, keepdim=True).add(self.eps).rsqrt()
        return (x.float() * rms).type_as(x) * self.weight
```

**考点解析**：

- RMSNorm 公式：$y = \dfrac{x}{\sqrt{\frac{1}{d}\sum x_i^2 + \epsilon}} \cdot g$。此版本不减均值、不含 bias；性能和质量需同模型对照，不能保证与 LayerNorm 几乎无差。
- `eps` 加在开方**里面**（与主流实现一致），防止全零输入除零。
- 混合精度：平方均值升 FP32；最后与 weight 相乘时，输出 dtype 还取决于 weight 和类型提升。若接口要求与输入一致，需要明确模块 dtype 策略，而非只看一次 type_as。

## 三、手撕 RoPE 旋转位置编码

```python
def precompute_freqs_cis(d_head: int, max_len: int, base: float = 10000.0):
    if d_head <= 0 or d_head % 2 or max_len <= 0 or base <= 0:
        raise ValueError("需要正偶数 head_dim、正长度与正 base")
    # 每两维一组，第 i 组频率 θ_i = base^{-2i/d}
    inv_freq = 1.0 / (base ** (torch.arange(0, d_head, 2).float() / d_head))
    t = torch.arange(max_len).float()
    freqs = torch.outer(t, inv_freq)                    # [max_len, d_head/2]
    return torch.polar(torch.ones_like(freqs), freqs)   # 复数 e^{i·mθ}

def apply_rope(x, freqs_cis, start_pos: int = 0):
    if x.ndim != 4 or x.shape[-1] % 2 or start_pos < 0:
        raise ValueError("输入需为四维、偶数末维、非负位置")
    if start_pos + x.shape[2] > freqs_cis.shape[0]:
        raise ValueError("位置超出预计算范围")
    # x: [B, n_heads, T, d_head]，相邻两维视作一个复数
    x_c = torch.view_as_complex(x.float().reshape(*x.shape[:-1], -1, 2).contiguous())
    positions = freqs_cis[start_pos:start_pos + x.shape[2]].to(x.device)
    x_c = x_c * positions
    return torch.view_as_real(x_c).flatten(-2).type_as(x)
```

**考点解析**：

- RoPE 对 Q/K 每对维度旋转位置角度。固定未旋转向量时，旋转后的点积的位置因子依赖 n-m；Q/K 本身仍依赖输入内容，不能说点积只依赖距离。单 token decode 要用真实 start_pos，不能每步从0旋转。
- 只作用在 **Q 和 K** 上，不作用在 V 上（V 不参与相似度计算）。
- 相邻维配对是一个约定，其他模型可能采用半维配对、部分旋转和不同 base；不同频率不意味着注意力随距离单调衰减。

**常见追问**：为什么 RoPE 可以做长度外推？——直接外推会让没见过的大角度旋转失真，所以需要位置插值（PI）或 NTK/YaRN 调整 base 频率，详见 [位置编码](/basics/position-encoding)。

## 四、手撕 SwiGLU FFN

```python
class SwiGLU(nn.Module):
    def __init__(self, d_model: int, d_ff: int):
        super().__init__()
        self.gate = nn.Linear(d_model, d_ff, bias=False)
        self.up   = nn.Linear(d_model, d_ff, bias=False)
        self.down = nn.Linear(d_ff, d_model, bias=False)

    def forward(self, x):
        return self.down(F.silu(self.gate(x)) * self.up(x))
```

**考点解析**：

- 结构是 $\text{down}(\text{SiLU}(W_g x) \odot W_u x)$：一条支路过 SiLU 当**门控**，另一条支路提供内容，逐元素相乘。
- 忽略 bias 时标准两矩阵 FFN 参数约 8d²，三矩阵为 3dh；等预算 h=8d/3，实际模型还可能取整或用额外倍率，并非所有版本固定此值。
- SiLU 为 $x\sigma(x)$，选择门控是架构取舍，不保证任何数据、预算都优于 ReLU/GELU。

## 五、手撕 Temperature / Top-k / Top-p 采样

```python
def sample(logits, temperature=1.0, top_k=0, top_p=1.0):
    """logits: [vocab_size]，返回采样到的 token id"""
    if logits.ndim != 1 or not logits.numel():
        raise ValueError("只支持非空单序列 logits")
    if not math.isfinite(temperature) or temperature < 0 or not 0 < top_p <= 1:
        raise ValueError("temperature需非负有限，top_p需在(0,1]")
    if not isinstance(top_k, int) or not 0 <= top_k <= logits.numel():
        raise ValueError("top_k需为[0,vocab_size]内整数")
    if torch.isnan(logits).any() or torch.isposinf(logits).any() or not torch.isfinite(logits).any():
        raise ValueError("logits含无效值或没有可选 token")
    if temperature == 0:
        return logits.argmax().reshape(1)
    logits = logits.double().clone()
    logits = (logits - logits.max()) / temperature

    if top_k > 0:
        selected_values, selected_indices = torch.topk(logits, top_k)
        logits = torch.full_like(logits, float('-inf')).scatter(0, selected_indices, selected_values)

    if top_p < 1.0:
        sorted_logits, sorted_idx = torch.sort(logits, descending=True)
        probs = F.softmax(sorted_logits, dim=-1)
        cum_probs = torch.cumsum(probs, dim=-1)
        # 不含当前 token 的累积概率已超过 top_p 时，丢弃该 token
        # （保证至少保留概率最高的一个）
        remove = cum_probs - probs >= top_p
        sorted_logits[remove] = float('-inf')
        logits = torch.full_like(logits, float('-inf')) \
                      .scatter(0, sorted_idx, sorted_logits)

    probs = F.softmax(logits, dim=-1)
    return torch.multinomial(probs, num_samples=1)
```

**考点解析**：

- **顺序**：先温度缩放，再截断，最后归一化采样。温度在截断之后做会改变候选集合。
- temperature=0 明确走贪心；正温度缩放有限 logit 分布，极限结论需考虑屏蔽位置与并列。top-k 此实现保留恰好 k 个索引，边界并列选择不承诺稳定；top-p 保留累计到阈值的前缀，不保证优于 top-k。
- 边界细节：top-p 的判断用"右移一位"的写法（`cum_probs - probs`），保证概率最高的 token 永远保留，否则 `top_p` 很小时会出现空候选集。

## 六、手撕 Self-Consistency 投票

这题考的是推理时算力扩展的工程落地：同一个问题采样多条推理链，抽取最终答案，做多数投票；当领先答案已经不可能被反超时提前停止。详见 [推理时算力扩展](/inference/test-time-scaling)。

```python
import re
from decimal import Decimal
from collections import Counter
from typing import Callable

def parse_answer(text: str) -> str | None:
    """把 CoT 输出解析成可投票的最终答案。
    面试时先写数字/选项版本，复杂 parser 留作可替换模块。
    """
    text = text.strip().lower()

    answers = re.findall(r"(?:final answer|最终答案|答案)\s*(?:[:：=]|是|为)?\s*(-?\d+(?:\.\d+)?|[a-d])\b", text)
    answer = answers[-1] if answers else text
    if re.fullmatch(r"-?\d+(?:\.\d+)?", answer):
        value = Decimal(answer)
        return "0" if value == 0 else format(value.normalize(), "f")
    return answer.upper() if re.fullmatch(r"[a-d]", answer) else None

def self_consistency(
    prompt: str,
    generate_fn: Callable[..., str],
    k: int = 16,
    min_samples: int = 3,
    temperature: float = 0.7,
    top_p: float = 0.95,
    max_new_tokens: int = 512,
) -> tuple[str | None, Counter, list[str]]:
    """采样 k 条回答，对解析出的最终答案做多数投票。

    generate_fn 是可注入模型调用，便于测试；返回 winner、票数和原始样本。
    """
    if k <= 0 or not 1 <= min_samples <= k:
        raise ValueError("需要正采样预算与有效最小样本数")
    votes = Counter()
    samples = []

    for i in range(k):
        response = generate_fn(
            prompt,
            temperature=temperature,
            top_p=top_p,
            max_new_tokens=max_new_tokens,
        )
        samples.append(response)

        answer = parse_answer(response)
        if answer is None:
            continue
        votes[answer] += 1

        if i + 1 < min_samples:
            continue

        winner, win_count = votes.most_common(1)[0]
        runner_up = votes.most_common(2)[1][1] if len(votes) > 1 else 0
        remaining = k - (i + 1)

        # 第二名即使拿到剩余所有票也追不上，才可以提前停止
        if win_count > runner_up + remaining:
            return winner, votes, samples

    if not votes:
        return None, votes, samples
    ranked = votes.most_common(2)
    if len(ranked) > 1 and ranked[0][1] == ranked[1][1]:
        return None, votes, samples
    return ranked[0][0], votes, samples

# 简单测试：第4次采样后3票对1票已无法反超，提前返回42
answers = iter([
    "我们一步步算，答案是 42",
    "final answer: 41",
    "答案：42",
    "42",
    "最终答案：42",
])

winner, votes, samples = self_consistency(
    "6 * 7 = ?",
    generate_fn=lambda prompt, **kw: next(answers),
    k=5,
    min_samples=3,
)
assert winner == "42"
assert votes["42"] == 3
assert len(samples) == 4
```

**考点解析**：

- **必须采样而不是 greedy**：Self-Consistency 依赖不同推理路径的多样性；如果每次贪心解码都一样，K 次调用没有意义。
- **答案解析是边界**：此例只接受显式答案标记或纯数字/选项，归一化42与42.0；不支持单位、分数、科学计数、语义答案或恶意重复标签。不能取解释末尾的任意数字冒充答案。
- **提前停止不能只看当前领先**：要判断第二名在剩余票数全部拿满时也追不上第一名，否则会过早锁错答案。
- **返回 samples 用于查解析**：只保存获准的可见回答/最终答案摘要，不索取或外发隐藏推理链；票占比不是答案正确的校准概率。
- **开放域任务不适合简单众数**：写作、摘要、RAG 问答没有唯一标准答案，通常要换 Best-of-N、LLM-as-Judge 或 reward model。

**常见追问**：平票怎么办？此实现返回 None，交澄清或独立 verifier；第一条出现的答案不是默认正确。平均 logprob 受长度、tokenizer、模型影响，不能跨候选无条件比较。提前停止只保证剩余预算无法改变票数赢家，不保证事实正确。

## 七、手撕带 KV Cache 的解码循环

```python
@torch.no_grad()
def generate(model, input_ids, max_new_tokens: int, eos_id: int):
    if input_ids.ndim != 2 or input_ids.shape[0] != 1 or input_ids.shape[1] == 0:
        raise ValueError("此例只支持batch=1、无padding的非空输入")
    if max_new_tokens < 0:
        raise ValueError("生成长度不能为负")
    if max_new_tokens == 0:
        return input_ids
    # Prefill 阶段：一次前向算完整个 prompt，缓存所有层的 K/V
    out = model(input_ids, use_cache=True)
    for step_index in range(max_new_tokens):
        next_id = out.logits[:, -1].argmax(dim=-1, keepdim=True)  # 贪心解码
        input_ids = torch.cat([input_ids, next_id], dim=-1)
        if next_id.item() == eos_id or step_index + 1 == max_new_tokens:
            break
        # Decode 阶段：每步只喂 1 个新 token，复用缓存的 K/V
        out = model(next_id, past_key_values=out.past_key_values, use_cache=True)
    return input_ids
```

**考点解析**：

- 设 prompt 长P、生成N：密集全注意力无缓存的注意力项为 $\sum_{i=0}^{N-1}O((P+i)^2)$；缓存为 $O(P^2)+\sum_{i=1}^{N-1}O(P+i)$。只有把P视为常量、N记作T才简化为O(T³)对O(T²)，未包含投影/FFN、带宽和批调度成本。
- **Prefill 是计算密集型**（大矩阵乘），**Decode 是访存密集型**（每步搬运整个 KV Cache 和权重），这是 vLLM/PagedAttention、投机解码等优化的出发点，详见 [推理优化](/inference/inference-optimization)。
- Cache 显存公式：$2 \times L \times T \times n_{kv} \times d_{head} \times \text{字节数}$（2 = K 和 V），会被追问估算具体模型的数值。

## 八、手撕 LoRA 线性层

```python
class LoRALinear(nn.Module):
    def __init__(self, base: nn.Linear, r: int = 8, alpha: int = 16):
        super().__init__()
        if r <= 0 or not base.weight.is_floating_point():
            raise ValueError("需要正秩与浮点nn.Linear基座")
        self.base = base
        for p in self.base.parameters():
            p.requires_grad = False                       # 冻结原权重
        # A随机、B零：本代码行向量约定下ΔW=(AB)^T=0
        self.lora_a = nn.Parameter(torch.randn(base.in_features, r, device=base.weight.device, dtype=base.weight.dtype) * 0.01)
        self.lora_b = nn.Parameter(torch.zeros(r, base.out_features, device=base.weight.device, dtype=base.weight.dtype))
        self.scaling = alpha / r

    def forward(self, x):
        return self.base(x) + (x @ self.lora_a @ self.lora_b) * self.scaling
```

**考点解析**：

- 本代码采用行向量：$h=xW_0^T+(\alpha/r)xAB$，A为[d,r]、B为[r,d']，而 PyTorch weight 为[d',d]；merge应加 $(\alpha/r)(AB)^T$。可训练参数为r(d+d')，不含冻结基座。
- B零A随机使分支初值为0；首步A梯度为0、B一般非零。A零B随机也可以先更新A，再让B获得梯度；两者都零才会同时困住。B零是常用选择，不是唯一可训练初始化。
- merge移除前向低秩分支，但有合并成本、dtype舍入和多adapter切换问题；不承诺零延迟变化或逐位无损，量化权重需专用合并/再量化方案。
- 对单个输入向量，低秩分支 `x @ A @ B` 约O(dr+rd')；先物化AB需O(drd')，但预先merge后可跨很多请求摊销。性能还受batch、kernel和内存影响，不能仅由此式断言所有场景更快。

更多原理（r/α 选择、QLoRA、DoRA）见 [LoRA 详解](/finetuning/lora)。

## 九、手撕 DPO Loss

```python
def dpo_loss(pi_chosen, pi_rejected, ref_chosen, ref_rejected, beta=0.1):
    """四个输入均为整条回答的对数概率 log p(y|x)，shape [B]
    pi_*  : 当前训练的策略模型
    ref_* : 冻结的参考模型（通常是 SFT 模型）
    """
    if not math.isfinite(beta) or beta <= 0:
        raise ValueError("beta需为正")
    pi_logratio  = pi_chosen - pi_rejected
    ref_logratio = ref_chosen.detach() - ref_rejected.detach()
    logits = beta * (pi_logratio - ref_logratio)
    return -F.logsigmoid(logits).mean()
```

**考点解析**：

- DPO 目标：$-\log \sigma\big(\beta[\log\frac{\pi(y_w)}{\pi_{ref}(y_w)} - \log\frac{\pi(y_l)}{\pi_{ref}(y_l)}]\big)$，让策略模型相对参考模型**更偏好 chosen、更不偏好 rejected**。
- 序列对数概率 = 各 token logprob **求和**（注意不是平均，长度归一化是 SimPO 等变体做的改进）。
- beta同时影响参考正则相关权衡与损失梯度尺度，不能简单说越大偏离越大；参考项也不是安全/通用能力不退化保证。序列logprob仅求回答目标token之和，排除prompt与padding，并固定EOS、截断和mask约定。
- 为什么 DPO 不需要奖励模型？——它利用 Bradley-Terry 模型把"最优策略与奖励的解析关系"代回偏好概率，把 RL 问题化成了监督学习，推导见 [RLHF / DPO 对齐](/finetuning/rlhf)。

## 十、手撕简化版 BPE 训练

```python
from collections import Counter

def train_bpe(words: list[str], num_merges: int):
    # 语料统计成 词 -> 频率，词先拆成字符元组
    vocab = Counter(tuple(w) for w in words)
    merges = []
    for _ in range(num_merges):
        # 1. 统计所有相邻 pair 的加权频率
        pairs = Counter()
        for word, freq in vocab.items():
            for i in range(len(word) - 1):
                pairs[(word[i], word[i + 1])] += freq
        if not pairs:
            break
        # 2. 取频率最高的 pair 作为本轮合并规则
        best = max(pairs, key=pairs.get)
        merges.append(best)
        # 3. 在所有词中执行合并
        new_vocab = Counter()
        for word, freq in vocab.items():
            merged, i = [], 0
            while i < len(word):
                if i < len(word) - 1 and (word[i], word[i + 1]) == best:
                    merged.append(word[i] + word[i + 1]); i += 2
                else:
                    merged.append(word[i]); i += 1
            new_vocab[tuple(merged)] += freq
        vocab = new_vocab
    return merges
```

**考点解析**：

- BPE 训练 = 重复"统计相邻 pair 频率 → 合并最高频 pair"，直到达到目标词表大小。推理（编码）时按训练得到的 merges **顺序**依次应用。
- 本例是逐词字符合并，不是完整 byte-level tokenizer：没有预分词、token ID、特殊token、序列边界或持久化。最高频并列的选择受输入顺序影响，应声明tie-break。词内不可跨边界合并。
- 字节级实现可由256字节基元覆盖可编码UTF-8输入，但规范化、特殊token和无效Unicode处理仍有边界，不能保证任意对象/字节都无损。词表大小需以固定模型版本和语料测序列长度、参数与低频统计，不用未核的产品数字推选型。

## 十一、手撕因果语言模型损失与困惑度

```python
def causal_lm_loss(logits, labels, ignore_index=-100):
    """logits: [B, T, V]，labels: [B, T]
    关键：错位 —— 用位置 t 的输出预测位置 t+1 的 token
    """
    if logits.ndim != 3 or labels.shape != logits.shape[:2] or logits.size(1) < 2:
        raise ValueError("需要匹配[B,T,V]/[B,T]且T至少为2")
    shift_logits = logits[:, :-1, :].float().reshape(-1, logits.size(-1))
    shift_labels = labels[:, 1:].reshape(-1)
    if not (shift_labels != ignore_index).any():
        raise ValueError("没有有效预测目标，mean loss/PPL未定义")
    loss = F.cross_entropy(shift_logits, shift_labels,
                           ignore_index=ignore_index)
    ppl = torch.exp(loss)        # 困惑度 = e^{平均交叉熵}
    return loss, ppl
```

**考点解析**：

- **错位（shift）是最容易写错的点**：第 $t$ 个位置的 logits 是在"看过前 $t$ 个 token"后对第 $t+1$ 个 token 的预测，所以 logits 去掉最后一位、labels 去掉第一位。
- `ignore_index=-100`：SFT 时把 prompt 部分的 label 置为 -100，实现 **loss mask**（只在回答部分计算损失）。
- PPL为有效目标token平均负对数似然的指数，是编码代价的有效分支数解释，不是校准置信度。多批汇总先累加NLL与有效token数再exp，不能直接平均批PPL；不同tokenizer或loss mask的PPL不可直接比，极大loss还可能exp溢出。

## 面试答题技巧

1. **先写注释再写代码**：先把输入输出 shape 标出来（`# x: [B, T, d_model]`），思路清晰且方便面试官跟随。
2. **边写边说考点**：写到 `sqrt(d_k)` 时主动解释为什么缩放，写到 B 零初始化时主动说原因——把手撕变成展示理解深度的机会。
3. **写不出 API 不要慌**：面试官在意的是逻辑而非 API 记忆，`torch.einsum` 记不住就写 `@` + `transpose`，说明白等价性即可。
4. **主动提边界情况**：mask广播、FP32归约、top-p空集与全忽略目标；这是解释正确性，不保证面试评分。

## 高频追问

**Q：手撕 MHA 时如果要求支持交叉注意力（cross-attention）怎么改？**
Q 来自 decoder 的输入 x，K/V 来自 encoder 的输出 memory：`k = self.k_proj(memory)`，且不需要 causal mask（可以看到完整的编码序列）。

**Q：为什么 attention 里用 `masked_fill(-inf)` 而不是乘 0？**
softmax 前置 $-\infty$ 后该位置权重精确为 0 且其余权重重新归一化；softmax 后乘 0 会破坏权重和为 1 的性质，输出尺度不稳定。

**Q：LoRA 的 A 全零、B 随机行不行？**
可以。在行向量xAB约定下，A零B随机时首步B梯度为0但A一般能更新；下一步B就可能获得梯度。A随机B零则相反。两者都零会让两个梯度都零；“标准初始化两个矩阵首步都有效”是错误结论。

**Q：top-p 和 top-k 能一起用吗，顺序有影响吗？**
能。本例固定先top-k再top-p，不宣称所有库版本默认一致；先top-k会重新归一化候选，再计算累计概率，顺序可改变结果，差异必须实测。

**Q：KV Cache 为什么不缓存 Q？**
解码时每步只需要**当前新 token 的 Q** 与历史所有 K/V 计算注意力，历史 token 的 Q 在它们各自那一步已经用完，之后永远不会再被用到。

**Q：写一个数值稳定的 softmax？**
对有限非空向量，沿归一化维减最大值再exp/sum；批量实现需要指定dim和keepdim。全-inf或含NaN/+inf要另定义拒绝/修复策略，减最大值不能使这些输入自动有效。

一手依据与运行限制：[PyTorch SDPA](https://docs.pytorch.org/docs/2.15/generated/torch.nn.functional.scaled_dot_product_attention.html)本轮仅读官方检索摘录，bool True=允许；该摘录也提醒MultiheadAttention bool mask语义相反；[Transformer mask](https://docs.pytorch.org/docs/2.14/generated/torch.nn.Transformer.html)本轮未读，仅导航，不能跨API套语义。[HF 4.52.3 Cache](https://huggingface.co/docs/transformers/v4.52.3/cache_explanation)本轮未读，仅导航。本文generate只演示无padding单序列、模型自行推断位置的接口；调用者需model.eval()，现代模型可能必须显式传attention_mask/cache_position，优先选固定版本内置generate。此例不处理批量EOS、滑窗或Cache对象迁移。

[LoRA官方layers.py](https://github.com/microsoft/LoRA/blob/main/loralib/layers.py)和 [DPO论文](https://arxiv.org/abs/2305.18290)本轮未取得正文，保留待核；LoRA行/列方向与首步梯度结论由本文xAB公式推导，不冒称已读作者讨论，不添加模型收益保证。[minbpe 官方仓库](https://github.com/karpathy/minbpe/tree/master)仅读官方UTF-8字节级说明摘录，本页字符BPE不是该实现复现。

<details>
<summary>L1–L3：如何验证手写代码而不是背API？</summary>

**L1**：先画shape与mask语义，解释全屏蔽、EOS、无有效label时返回什么。**L2**：比较同权重、同输入与官方算子，限定dtype容差；p=[0.6,0.25,0.15]、top_p=0.6只应保留首项，LoRA首步检查哪一支梯度为零。**L3**：推导RoPE旋转内积和LoRA梯度，做缓存/无缓存相同位置的logits对照，区分数学等价、浮点差异与真实性能。

</details>
