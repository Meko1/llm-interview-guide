# 前沿对齐技术（2025-2026）

## 从 RLHF 到新一代对齐

经典 RLHF（PPO）虽然有效，但存在训练不稳定、奖励模型 hack、超参敏感等问题。2025-2026 年涌现了一批更高效、更稳定的对齐方法。

```
对齐技术演进路线：
RLHF (PPO) → DPO → GRPO → DAPO → RLVR
     ↓          ↓       ↓        ↓
 奖励模型    无需 RM   群组相对  分布感知  可验证奖励
```

## GRPO（Group Relative Policy Optimization）

### 核心思想

DeepSeek 提出的方法，**去掉了 Critic 模型**，用组内相对排序代替绝对奖励值：

1. 对同一个 prompt 采样一组回复（如 8-16 个）
2. 用奖励模型或规则对每个回复打分
3. 在组内计算相对优势（advantage）：高于均值的为正样本，低于均值的为负样本
4. 用相对优势更新策略

```
传统 PPO:
  策略模型 + Critic 模型 + 奖励模型（3 个模型）
  → 训练复杂，显存占用大

GRPO:
  策略模型 + 奖励模型（2 个模型）
  → 无 Critic，用组内统计量代替
  → 更稳定，显存节省 ~33%
```

### 数学表达

```
优势函数: A_i = (r_i - mean(r_group)) / std(r_group)
损失函数: L = -E[min(ratio * A, clip(ratio, 1-ε, 1+ε) * A)] + β * KL(π || π_ref)
```

### 应用

- DeepSeek-R1 的核心训练方法
- 特别适合数学/代码等有明确正确性标准的任务
- 可用规则奖励（如代码执行通过率）替代奖励模型

## DAPO（Distribution-Aware Policy Optimization）

### 动机

DPO 在分布偏移时表现退化。DAPO 解决了 DPO 的几个核心问题：

1. **分布感知**：考虑在线策略与参考策略的分布差异
2. **动态采样**：从当前策略采样而非固定数据集
3. **自适应 KL 约束**：防止策略退化

### 关键改进

- 在 DPO 基础上引入在线采样（on-policy sampling）
- 动态更新偏好数据（而非一次性离线数据）
- 更好地处理长尾分布的偏好对

## RLVR（Reinforcement Learning with Verifiable Rewards）

### 核心理念

对于有**可验证正确性**的任务（数学、代码、逻辑推理），不需要人类标注偏好数据，直接用验证器作为奖励信号：

```
任务类型            奖励信号
数学推理  →  最终答案是否正确（执行验证）
代码生成  →  测试用例是否通过
逻辑推理  →  逻辑检验器验证
翻译      →  BLEU / 人类评分
```

### 优势

- 无需昂贵的人类偏好标注
- 奖励信号精确、无噪声
- 可大规模自动化训练
- DeepSeek-R1 和 OpenAI o1 的核心思路

### 局限

- 仅适用于有客观验证标准的任务
- 开放式生成（创意写作、对话）仍需人类偏好

## Dr. GRPO（Distilled GRPO）

在 GRPO 基础上加入蒸馏信号：
- 同时从教师模型学习和从奖励信号学习
- 结合了蒸馏的稳定性和 RL 的探索性
- DeepSeek-R1-Distill 系列的训练方法

## RLAIF（RL from AI Feedback）

用 AI 模型代替人类标注偏好数据：

```
传统 RLHF:  人类标注偏好对 → 训练 RM → PPO
RLAIF:      AI 模型评判偏好 → 训练 RM → PPO（或直接 DPO）
```

- Anthropic Constitutional AI 的核心方法
- 显著降低标注成本
- 需要确保 AI 评判的质量和一致性

## Constitutional AI

Anthropic 提出的方法，用**宪法原则**指导 AI 自我改进：

1. **红队生成**：模型生成可能有害的回复
2. **自我批评**：模型根据宪法原则评判自己的回复
3. **自我修正**：根据批评修正回复
4. **RLAIF**：用 AI 偏好训练

### 宪法原则示例

- "回答应当有帮助、无害且诚实"
- "避免歧视和偏见"
- "在不确定时表达不确定性"

## SimPO（Simple Preference Optimization）

DPO 的简化变体，去掉了参考模型：
- 使用序列平均对数概率作为隐式奖励
- 加入长度归一化，避免偏好长回复
- 训练更简单，效果接近 DPO

```
DPO:   L = -log σ(β * (log π(y_w)/π_ref(y_w) - log π(y_l)/π_ref(y_l)))
SimPO: L = -log σ(β * (avg_log_π(y_w) - avg_log_π(y_l)) - γ)
```

## 方法对比总结

| 方法 | 是否需要 RM | 是否在线 | 适用场景 | 代表工作 |
|------|------------|---------|---------|---------|
| PPO (RLHF) | 是 | 是 | 通用 | InstructGPT / ChatGPT |
| DPO | 否 | 否（离线） | 通用 | Zephyr / 各开源模型 |
| GRPO | 是/规则 | 是 | 可验证任务 | DeepSeek-R1 |
| DAPO | 否 | 是 | 偏好对齐 | 研究阶段 |
| RLVR | 验证器 | 是 | 数学/代码 | o1 / R1 |
| SimPO | 否 | 否 | 通用 | 轻量对齐 |
| RLAIF | AI 评判 | 可选 | 规模化 | Constitutional AI |

## OpenRLHF / veRL 训练框架

### OpenRLHF
- 开源的统一 RLHF 训练框架
- 支持 PPO / DPO / GRPO / KTO / ORPO 多种算法
- 分布式训练支持（Ray + DeepSpeed/FSDP）

### veRL
- 字节跳动开源的 RL 训练框架
- 专注高效的在线 RL 训练
- 支持 GRPO / PPO with hybrid parallelism

## 高频面试追问

1. **GRPO 相比 PPO 的核心优势？为什么去掉 Critic？**
   - 减少训练复杂度和显存（不需要 Critic 模型）；用组内相对排序天然归一化奖励

2. **DPO 为什么会在分布偏移时退化？**
   - DPO 用离线数据训练，但策略在训练过程中会偏离参考策略，导致偏好信号失效

3. **RLVR 的适用范围和限制？**
   - 仅适用于有客观验证标准的任务；开放式生成仍需人类偏好

4. **DeepSeek-R1 的训练流程？**
   - 预训练 → SFT → GRPO with verifiable rewards → 蒸馏到小模型（Dr.GRPO）

5. **Constitutional AI 如何保证 AI 评判质量？**
   - 用明确的宪法原则约束评判标准；多轮自我改进迭代；最终仍需人类审核

6. **SimPO 相比 DPO 省了什么？丢了什么？**
   - 省了参考模型的前向传播（训练更快）；可能在分布偏移严重时不如 DPO 稳定
