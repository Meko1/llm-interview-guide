# 微调训练工具链实战

> 懂 LoRA 原理却没跑过一次训练，面试讲不出细节、工作上手就懵。本文覆盖微调工具链选型、LLaMA-Factory 实操流程、显存估算、loss 曲线判读与高频踩坑——把「会原理」补成「能动手」。原理部分见 [微调范式](/finetuning/finetuning) 与 [LoRA 详解](/finetuning/lora)。

## 工具链全景

| 层 | 工具 | 定位 |
| --- | --- | --- |
| 积木层 | HF Transformers + PEFT + TRL | 官方积木，灵活但要自己拼 |
| **一站式** | **LLaMA-Factory** | 配置文件/WebUI 驱动的微调全家桶（SFT/DPO/PPO），中文生态首选 |
| 一站式 | Axolotl | YAML 驱动，海外社区主流 |
| 效率层 | Unsloth | 手写算子加速 LoRA，单卡速度/显存优化显著 |
| 分布式后端 | DeepSpeed (ZeRO) / FSDP | 多卡显存切分，挂在上述框架之下（见 [分布式训练](/pretraining/distributed-training)） |
| RL 专用 | verl / OpenRLHF / TRL | PPO/GRPO 等 RLHF 训练（见 [RLHF](/finetuning/rlhf)） |

选型一句话：**学习和中小项目用 LLaMA-Factory；要深度定制用 Transformers+PEFT 自己写；单卡抠效率加 Unsloth；上 RL 用 verl/OpenRLHF。**

## LLaMA-Factory 实操流程

### 1. 准备数据（最重要的一步）

主流两种格式（JSON 文件 + 在 `dataset_info.json` 注册）：

```json
// Alpaca 格式：单轮指令
{"instruction": "把这句话翻译成英文", "input": "今天天气很好", "output": "The weather is nice today."}

// ShareGPT 格式：多轮对话
{"conversations": [
  {"from": "human", "value": "什么是 LoRA？"},
  {"from": "gpt", "value": "LoRA 是一种参数高效微调方法……"}
]}
```

数据质量 > 数量：千条精标常胜过万条粗数据（LIMA 结论，见 [数据工程](/pretraining/data-engineering) 的 SFT 一节）。

### 2. 训练配置（关键参数）

```yaml
model_name_or_path: Qwen/Qwen2.5-7B-Instruct
finetuning_type: lora        # lora / qlora（加 quantization_bit: 4）/ full
lora_target: all             # 推荐 all（q/k/v/o/gate/up/down 全挂）
lora_rank: 8                 # 常用 8~64，任务越复杂越大
template: qwen               # ⚠️ 必须与模型匹配，错了效果崩
cutoff_len: 2048             # 按数据长度分布定
learning_rate: 1.0e-4        # LoRA 常用 1e-4~2e-4；全参用 1e-5 量级
num_train_epochs: 3          # SFT 常用 2~3，多了过拟合
per_device_train_batch_size: 2
gradient_accumulation_steps: 8   # 等效 batch = 2×8×卡数
```

### 3. 显存估算速查（7B 模型，BF16）

| 方式 | 显存需求 | 单卡可行性 |
| --- | --- | --- |
| 全参微调 | ~120GB+（参数+梯度+优化器） | 需多卡 + ZeRO |
| LoRA | ~18-24GB | 单张 24G 卡（4090/A10）可跑 |
| **QLoRA（4-bit）** | ~10-14GB | 单张 16G 卡可跑 |

OOM 时按序尝试：减 batch（加梯度累积补回）→ 减 cutoff_len → 开 gradient checkpointing → LoRA 换 QLoRA → 上 ZeRO/多卡。

## 训练监控：loss 曲线怎么看

```
正常：train loss 平滑下降后趋缓，eval loss 同步下降
过拟合：train 继续降、eval 开始回升  ──► 减 epoch / 加数据 / 减 rank
不收敛：loss 几乎不动              ──► 查模板是否错、学习率过小、数据是否有效
突刺(spike)：loss 突然飙升          ──► 降学习率、查脏数据、梯度裁剪
```

配 wandb/SwanLab/TensorBoard 看曲线；**eval loss 只是代理指标**，最终以任务评估集为准（见 [模型评估](/evaluation/evaluation)）。

## 高频踩坑清单

1. **Chat template 不匹配（最高频）**：template 与基座模型不符（如 Qwen 模型用了 llama3 模板），特殊 token 错位 → 模型输出乱码/不停止/答非所问。训练和推理必须用同一模板。
2. **基座选错**：领域继续预训练应基于 Base；只做 SFT 对话微调基于 Instruct（见 [LLaMA 与 Qwen](/models/llama-qwen) 的选型追问）。
3. **灾难性遗忘**：纯领域数据训完通用能力崩。混 10-30% 通用数据、用 LoRA 限制改动、降学习率。
4. **EOS 处理不当**：数据没正确加结束符 → 推理时停不下来。
5. **重复样本/数据泄漏**：训练集混入评估集，离线指标虚高。
6. **学习率照抄**：全参的 1e-5 量级和 LoRA 的 1e-4 量级差 10 倍，抄错方向直接训崩或不动。

## 训练后的衔接

```
LoRA 适配器 ──► 合并权重(merge) ──► 评估回归(评估集+通用基准抽查)
           ──► 量化导出(GGUF/AWQ/GPTQ) ──► vLLM/llama.cpp 部署
```

- merge 后是普通权重，部署零额外延迟；也可不 merge，用 vLLM 的多 LoRA 服务（一个基座挂多个适配器，多租户省显存）。
- 上线前必须跑：任务评估集 + 通用能力抽查（确认没把模型「训傻」）+ 安全抽查。

## 高频追问

**Q：LoRA 的 target modules 挂哪些层？**
早期习惯只挂 q/v 投影；现在经验是 **all（含 FFN 的 gate/up/down）效果更好**，QLoRA 论文也是全挂。参数量仍然很小，没必要省。

**Q：怎么判断模型「训好了」？**
三层验证：① loss 曲线正常收敛且无过拟合；② 任务评估集指标达标（对比训前 baseline）；③ 通用能力没退化（抽查几个通用基准/对话样例）。只看 loss 是新手最常见错误。

**Q：SFT 训练数据要多少条？**
对齐风格/格式：千条精标足够；注入领域问答能力：万条级起步；想注入大量新知识：SFT 不是正确工具，考虑继续预训练 + RAG 组合。方向比数量重要。

**Q：QLoRA 训出来的效果和 LoRA 一样吗？**
QLoRA 论文结论是基本打平（NF4 量化误差被 LoRA 适配吸收）。实践中差距极小，显存减半的收益远大于风险；但推理部署时注意：训练时基座是 4-bit，合并导出后用什么精度要重新评估。

**Q：多卡训练 DeepSpeed ZeRO 选哪个 stage？**
显存够 → ZeRO-1/2（只切优化器/梯度，通信少）；模型大到单卡装不下参数 → ZeRO-3（参数也切，通信开销大）。LoRA 微调 7B/14B 通常 ZeRO-2 足够。原理见 [分布式训练](/pretraining/distributed-training)。

**Q：做 GRPO/RLHF 训练用什么框架？**
小规模实验用 TRL；正经训练用 **verl** 或 OpenRLHF——RL 训练同时要「生成（rollout）」和「训练」，verl 把 vLLM 推理引擎和训练引擎编排在一起，吞吐高得多。这也是 RL 训练比 SFT 工程复杂的核心原因（见 [强化学习基础](/advanced/rl-basics)）。
