# 大模型手撕代码题解集

> 大模型岗位的手撕环节与传统算法题不同：考的不是 LeetCode 技巧，而是**你是否真的理解模型内部发生了什么**。本文收录最高频的 11 道手撕题，每道题给出可直接运行的参考实现 + 考点解析 + 面试官常见追问，建议动手默写一遍而不是只看。

## 手撕题考察什么

| 题目 | 出现频率 | 核心考点 |
| --- | --- | --- |
| 多头注意力（MHA） | ⭐⭐⭐⭐⭐ | 维度变换、缩放、causal mask |
| RMSNorm / LayerNorm | ⭐⭐⭐⭐ | 归一化公式、数值稳定性 |
| RoPE 旋转位置编码 | ⭐⭐⭐⭐ | 复数旋转、相对位置性质 |
| Top-k / Top-p 采样 | ⭐⭐⭐⭐ | 解码策略、概率截断 |
| Self-Consistency 投票 | ⭐⭐ | 多采样、答案归一化、置信度提前停止 |
| 带 KV Cache 的解码 | ⭐⭐⭐ | Prefill/Decode 两阶段 |
| LoRA 线性层 | ⭐⭐⭐ | 低秩分解、初始化策略 |
| DPO Loss | ⭐⭐⭐ | 偏好对齐目标函数 |
| SwiGLU FFN | ⭐⭐ | 门控激活结构 |
| 简化版 BPE | ⭐⭐ | 分词训练流程 |
| 交叉熵与困惑度 | ⭐⭐ | 语言模型损失、错位预测 |

面试官的评分点通常是：**维度标注是否清晰、边界细节（mask、eps、初始化）是否正确、能否边写边解释为什么**。

## 一、手撕多头注意力（MHA）

最高频的一道，几乎是大模型岗手撕的"两数之和"。

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
        scores = q @ k.transpose(-2, -1) / math.sqrt(self.d_head)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, float('-inf'))
        attn = F.softmax(scores, dim=-1)

        out = attn @ v                                # [B, n_heads, T, d_head]
        out = out.transpose(1, 2).reshape(B, T, -1)   # 拼回 [B, T, d_model]
        return self.o_proj(out)

# causal mask：下三角为 1，保证位置 t 只能看到 <= t 的 token
T = 8
mask = torch.tril(torch.ones(T, T))
```

**考点解析**：

- **为什么除以 $\sqrt{d_k}$**：点积的方差随维度线性增长，不缩放会让 softmax 进入饱和区、梯度消失。
- **mask 加在 softmax 之前**：把非法位置置为 $-\infty$，softmax 后权重恰好为 0；若 softmax 之后再置 0，权重和不再为 1。
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

- RMSNorm 公式：$y = \dfrac{x}{\sqrt{\frac{1}{d}\sum x_i^2 + \epsilon}} \cdot g$。与 LayerNorm 的区别是**不减均值、没有 bias β**，少一次统计量计算，效果几乎不掉。
- `eps` 加在开方**里面**（与主流实现一致），防止全零输入除零。
- 混合精度细节：先 `.float()` 再 `type_as(x)` 是 LLaMA 官方实现的写法，面试中写出来是明显加分项。

## 三、手撕 RoPE 旋转位置编码

```python
def precompute_freqs_cis(d_head: int, max_len: int, base: float = 10000.0):
    # 每两维一组，第 i 组频率 θ_i = base^{-2i/d}
    inv_freq = 1.0 / (base ** (torch.arange(0, d_head, 2).float() / d_head))
    t = torch.arange(max_len).float()
    freqs = torch.outer(t, inv_freq)                    # [max_len, d_head/2]
    return torch.polar(torch.ones_like(freqs), freqs)   # 复数 e^{i·mθ}

def apply_rope(x, freqs_cis):
    # x: [B, n_heads, T, d_head]，相邻两维视作一个复数
    x_c = torch.view_as_complex(x.float().reshape(*x.shape[:-1], -1, 2))
    x_c = x_c * freqs_cis[: x.shape[2]]                 # 第 m 个位置旋转角度 mθ
    return torch.view_as_real(x_c).flatten(-2).type_as(x)
```

**考点解析**：

- RoPE 的本质：把 Q/K 向量每两维看成复平面上的点，位置 $m$ 的向量旋转 $m\theta$。这样 $\langle q_m, k_n \rangle$ 只依赖相对距离 $m-n$ —— **用绝对位置的操作实现了相对位置的效果**。
- 只作用在 **Q 和 K** 上，不作用在 V 上（V 不参与相似度计算）。
- 低维组高频（捕捉近距离顺序）、高维组低频（捕捉远距离衰减），这是后续 NTK/YaRN 外推方法"按频率分层处理"的基础。

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
- 三个矩阵而不是两个，所以 LLaMA 把 `d_ff` 设为 $\frac{8}{3}d_{model}$ 而不是 $4d_{model}$，保持参数量与标准 FFN 持平。
- SiLU（即 Swish）$x \cdot \sigma(x)$ 平滑、非单调，配合门控在大模型上稳定优于 ReLU/GELU。

## 五、手撕 Temperature / Top-k / Top-p 采样

```python
def sample(logits, temperature=1.0, top_k=0, top_p=1.0):
    """logits: [vocab_size]，返回采样到的 token id"""
    logits = logits / max(temperature, 1e-5)

    if top_k > 0:
        kth_value = torch.topk(logits, top_k).values[-1]
        logits[logits < kth_value] = float('-inf')

    if top_p < 1.0:
        sorted_logits, sorted_idx = torch.sort(logits, descending=True)
        probs = F.softmax(sorted_logits, dim=-1)
        cum_probs = torch.cumsum(probs, dim=-1)
        # 不含当前 token 的累积概率已超过 top_p 时，丢弃该 token
        # （保证至少保留概率最高的一个）
        remove = cum_probs - probs > top_p
        sorted_logits[remove] = float('-inf')
        logits = torch.full_like(logits, float('-inf')) \
                      .scatter(0, sorted_idx, sorted_logits)

    probs = F.softmax(logits, dim=-1)
    return torch.multinomial(probs, num_samples=1)
```

**考点解析**：

- **顺序**：先温度缩放，再截断，最后归一化采样。温度在截断之后做会改变候选集合。
- **temperature** 改变分布形状（→0 趋近贪心，→∞ 趋近均匀）；**top-k** 固定候选数量；**top-p** 按累积概率自适应候选数量——分布尖锐时候选少、平坦时候选多，这是 top-p 优于 top-k 的原因。
- 边界细节：top-p 的判断用"右移一位"的写法（`cum_probs - probs`），保证概率最高的 token 永远保留，否则 `top_p` 很小时会出现空候选集。

## 六、手撕 Self-Consistency 投票

这题考的是推理时算力扩展的工程落地：同一个问题采样多条推理链，抽取最终答案，做多数投票；当领先答案已经不可能被反超时提前停止。详见 [推理时算力扩展](/inference/test-time-scaling)。

```python
import re
from collections import Counter
from typing import Callable

def parse_answer(text: str) -> str | None:
    """把 CoT 输出解析成可投票的最终答案。
    面试时先写数字/选项版本，复杂 parser 留作可替换模块。
    """
    text = text.strip().lower()

    numbers = re.findall(r"-?\d+(?:\.\d+)?", text)
    if numbers:
        return numbers[-1]

    choices = re.findall(r"\b[a-d]\b", text)
    if choices:
        return choices[-1].upper()

    return None

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
    return votes.most_common(1)[0][0], votes, samples

# 简单测试：4 票对 1 票，最终答案为 42
answers = iter([
    "我们一步步算，答案是 42",
    "final answer: 41",
    "答案：42",
    "42",
    "所以最终是 42",
])

winner, votes, samples = self_consistency(
    "6 * 7 = ?",
    generate_fn=lambda prompt, **kw: next(answers),
    k=5,
    min_samples=3,
)
assert winner == "42"
assert votes["42"] == 4
assert len(samples) == 5
```

**考点解析**：

- **必须采样而不是 greedy**：Self-Consistency 依赖不同推理路径的多样性；如果每次贪心解码都一样，K 次调用没有意义。
- **答案解析是核心边界**：数学题取最后一个数字，选择题取 A/B/C/D；解析失败的样本不要硬投票，应跳过或交给 verifier。
- **提前停止不能只看当前领先**：要判断第二名在剩余票数全部拿满时也追不上第一名，否则会过早锁错答案。
- **返回 samples 方便排查**：线上 bad case 要能看到每条 CoT 为什么投到某个答案，而不是只留下一个 winner。
- **开放域任务不适合简单众数**：写作、摘要、RAG 问答没有唯一标准答案，通常要换 Best-of-N、LLM-as-Judge 或 reward model。

**常见追问**：如果两个答案平票怎么办？——可以继续采样直到预算耗尽；预算耗尽仍平票时，用 verifier / reward model 打分，或者选择平均 logprob 更高的答案。不要随机返回，因为随机会让线上回归很难复现。

## 七、手撕带 KV Cache 的解码循环

```python
@torch.no_grad()
def generate(model, input_ids, max_new_tokens: int, eos_id: int):
    # Prefill 阶段：一次前向算完整个 prompt，缓存所有层的 K/V
    out = model(input_ids, use_cache=True)
    for _ in range(max_new_tokens):
        next_id = out.logits[:, -1].argmax(dim=-1, keepdim=True)  # 贪心解码
        input_ids = torch.cat([input_ids, next_id], dim=-1)
        if next_id.item() == eos_id:
            break
        # Decode 阶段：每步只喂 1 个新 token，复用缓存的 K/V
        out = model(next_id, past_key_values=out.past_key_values, use_cache=True)
    return input_ids
```

**考点解析**：

- 没有 KV Cache 时每步要重算全部历史 token 的 K/V，整体复杂度 $O(T^3)$（每步 $O(T^2)$ × T 步）；有了 Cache 每步只算新 token 的 Q 对历史 K/V 的注意力，降为 $O(T^2)$。
- **Prefill 是计算密集型**（大矩阵乘），**Decode 是访存密集型**（每步搬运整个 KV Cache 和权重），这是 vLLM/PagedAttention、投机解码等优化的出发点，详见 [推理优化](/inference/inference-optimization)。
- Cache 显存公式：$2 \times L \times T \times n_{kv} \times d_{head} \times \text{字节数}$（2 = K 和 V），会被追问估算具体模型的数值。

## 八、手撕 LoRA 线性层

```python
class LoRALinear(nn.Module):
    def __init__(self, base: nn.Linear, r: int = 8, alpha: int = 16):
        super().__init__()
        self.base = base
        for p in self.base.parameters():
            p.requires_grad = False                       # 冻结原权重
        # A 随机高斯初始化，B 零初始化 => 训练开始时 ΔW = BA = 0
        self.lora_a = nn.Parameter(torch.randn(base.in_features, r) * 0.01)
        self.lora_b = nn.Parameter(torch.zeros(r, base.out_features))
        self.scaling = alpha / r

    def forward(self, x):
        return self.base(x) + (x @ self.lora_a @ self.lora_b) * self.scaling
```

**考点解析**：

- 核心公式：$h = W_0 x + \frac{\alpha}{r} BAx$。$W_0$ 冻结，只训练 $A \in \mathbb{R}^{d \times r}$、$B \in \mathbb{R}^{r \times d'}$，可训练参数从 $d \times d'$ 降到 $r(d + d')$。
- **B 必须零初始化**：保证训练起点模型行为与原模型完全一致，A、B 都随机会引入初始噪声。
- 推理时可以把 $W_0 + \frac{\alpha}{r}BA$ 合并（merge），**零额外推理延迟**——这是 LoRA 相比 Adapter 的关键优势。
- 计算顺序 `x @ A @ B` 而不是先算 `A @ B`：前者复杂度 $O(d \cdot r) + O(r \cdot d')$，后者要先做 $O(d \cdot r \cdot d')$ 的矩阵乘，更慢。

更多原理（r/α 选择、QLoRA、DoRA）见 [LoRA 详解](/finetuning/lora)。

## 九、手撕 DPO Loss

```python
def dpo_loss(pi_chosen, pi_rejected, ref_chosen, ref_rejected, beta=0.1):
    """四个输入均为整条回答的对数概率 log p(y|x)，shape [B]
    pi_*  : 当前训练的策略模型
    ref_* : 冻结的参考模型（通常是 SFT 模型）
    """
    pi_logratio  = pi_chosen - pi_rejected
    ref_logratio = ref_chosen - ref_rejected
    logits = beta * (pi_logratio - ref_logratio)
    return -F.logsigmoid(logits).mean()
```

**考点解析**：

- DPO 目标：$-\log \sigma\big(\beta[\log\frac{\pi(y_w)}{\pi_{ref}(y_w)} - \log\frac{\pi(y_l)}{\pi_{ref}(y_l)}]\big)$，让策略模型相对参考模型**更偏好 chosen、更不偏好 rejected**。
- 序列对数概率 = 各 token logprob **求和**（注意不是平均，长度归一化是 SimPO 等变体做的改进）。
- $\beta$ 控制偏离参考模型的程度，作用类似 RLHF 中的 KL 系数；参考模型的存在防止模型为了拉开偏好差而崩坏。
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
- 实际工业实现（GPT 系列的 byte-level BPE）在**字节**而非字符上做 BPE，256 个初始字节保证任何字符串都能编码、无 UNK。
- 常见追问：词表大小怎么选？——太小则序列变长、推理变慢；太大则 embedding 占参数多、低频 token 训练不充分。多语言模型（如 Qwen 152K）通常比英文模型（LLaMA 1/2 的 32K）大。

## 十一、手撕因果语言模型损失与困惑度

```python
def causal_lm_loss(logits, labels, ignore_index=-100):
    """logits: [B, T, V]，labels: [B, T]
    关键：错位 —— 用位置 t 的输出预测位置 t+1 的 token
    """
    shift_logits = logits[:, :-1, :].reshape(-1, logits.size(-1))
    shift_labels = labels[:, 1:].reshape(-1)
    loss = F.cross_entropy(shift_logits, shift_labels,
                           ignore_index=ignore_index)
    ppl = torch.exp(loss)        # 困惑度 = e^{平均交叉熵}
    return loss, ppl
```

**考点解析**：

- **错位（shift）是最容易写错的点**：第 $t$ 个位置的 logits 是在"看过前 $t$ 个 token"后对第 $t+1$ 个 token 的预测，所以 logits 去掉最后一位、labels 去掉第一位。
- `ignore_index=-100`：SFT 时把 prompt 部分的 label 置为 -100，实现 **loss mask**（只在回答部分计算损失）。
- 困惑度 $\text{PPL} = \exp(\text{平均交叉熵})$，直观含义是"模型在每一步平均在多少个等可能的候选里犹豫"。

## 面试答题技巧

1. **先写注释再写代码**：先把输入输出 shape 标出来（`# x: [B, T, d_model]`），思路清晰且方便面试官跟随。
2. **边写边说考点**：写到 `sqrt(d_k)` 时主动解释为什么缩放，写到 B 零初始化时主动说原因——把手撕变成展示理解深度的机会。
3. **写不出 API 不要慌**：面试官在意的是逻辑而非 API 记忆，`torch.einsum` 记不住就写 `@` + `transpose`，说明白等价性即可。
4. **主动提边界情况**：mask 的广播、混合精度的 float32 上转、top-p 的空集保护，能主动提到的人极少，提了就是区分度。

## 高频追问

**Q：手撕 MHA 时如果要求支持交叉注意力（cross-attention）怎么改？**
Q 来自 decoder 的输入 x，K/V 来自 encoder 的输出 memory：`k = self.k_proj(memory)`，且不需要 causal mask（可以看到完整的编码序列）。

**Q：为什么 attention 里用 `masked_fill(-inf)` 而不是乘 0？**
softmax 前置 $-\infty$ 后该位置权重精确为 0 且其余权重重新归一化；softmax 后乘 0 会破坏权重和为 1 的性质，输出尺度不稳定。

**Q：LoRA 的 A 全零、B 随机行不行？**
不行。若 A 为零，反向传播中 B 的梯度 $\propto Ax = 0$，B 永远学不到东西；标准做法（A 随机、B 零）既保证 ΔW=0 的无扰动起点，又保证两个矩阵都有有效梯度。

**Q：top-p 和 top-k 能一起用吗，顺序有影响吗？**
能，通常先 top-k 再 top-p（HuggingFace 默认顺序）。两者都是对候选集合的截断，先用 top-k 限定上限再用 top-p 自适应收缩；顺序交换结果可能不同，但实践差异不大。

**Q：KV Cache 为什么不缓存 Q？**
解码时每步只需要**当前新 token 的 Q** 与历史所有 K/V 计算注意力，历史 token 的 Q 在它们各自那一步已经用完，之后永远不会再被用到。

**Q：写一个数值稳定的 softmax？**
先减最大值：`exp(x - x.max()) / exp(x - x.max()).sum()`。直接 `exp(x)` 在 x 较大时上溢出为 inf；减最大值不改变结果（分子分母同乘 $e^{-x_{max}}$），这也是 FlashAttention online softmax 的基础。
