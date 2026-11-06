---
title: 微调训练工具链实战
description: 用数据、模板、冻结参数与资源账本选择微调工具链，区分示意配置和可执行实验，建立训练到部署的回归检查。
level: L2
roles:
  - 算法研究
  - 应用开发
classification: inferred
---
# 微调训练工具链实战

> **工具能启动，不等于实验正确。** L2 应能核查数据、模板、可训练参数、损失分母和部署产物。本文给出检查流程和配置示意，未执行训练；基础见 [微调范式](/finetuning/finetuning) 与 [LoRA](/finetuning/lora)。

## 工具链全景

| 层 | 工具 | 定位 |
| --- | --- | --- |
| 积木层 | HF Transformers + PEFT + TRL | 官方积木，灵活但要自己拼 |
| **一站式** | **LLaMA-Factory** | 配置文件/WebUI 驱动；具体算法与模型支持按版本确认 |
| 一站式 | Axolotl | YAML 配置入口，核对需要的后端 |
| 效率层 | Unsloth | 优化实现候选，需按硬件、模型、长度对照测量 |
| 分布式后端 | DeepSpeed (ZeRO) / FSDP | 多卡显存切分，挂在上述框架之下（见 [分布式训练](/pretraining/distributed-training)） |
| RL 专用 | verl / OpenRLHF / TRL | PPO/GRPO 等 RLHF 训练（见 [RLHF](/finetuning/rlhf)） |

选型先问：能否查看处理后的 token/label，能否指定冻结边界和 loss reduction，能否导出可回滚产物？在线 RL 再核对 rollout 与训练的权重同步、奖励执行与并行后端。功能表不是性能排行榜。

## LLaMA-Factory 实操流程

### 1. 准备数据（最重要的一步）

主流两种格式（JSON 文件 + 在 `dataset_info.json` 注册）：

单轮结构示意：

```json
{"instruction": "把这句话翻译成英文", "input": "今天天气很好", "output": "The weather is nice today."}
```

多轮结构示意：

```json
{"conversations": [
  {"from": "human", "value": "什么是 LoRA？"},
  {"from": "gpt", "value": "LoRA 是一种参数高效微调方法……"}
]}
```

JSON 对象要按选用版本组织为数组/JSONL 并注册字段映射，上面不是完整可加载数据文件。训练前解码处理后的输入与 label，逐 token 看角色、mask、EOS 和截断；LIMA 的千条设置不是任意任务的数据门槛。

### 2. 训练配置（关键参数）

以下是历史模型的**参数示意**，不是已验证启动脚本；需补 dataset 注册、训练入口、输出路径并确认安装版本。数值仅为实验起点，不是推荐定律。

```yaml
model_name_or_path: Qwen/Qwen2.5-7B-Instruct
finetuning_type: lora
lora_target: all
lora_rank: 8
template: qwen
cutoff_len: 2048
learning_rate: 1.0e-4
num_train_epochs: 3
per_device_train_batch_size: 2
gradient_accumulation_steps: 8
```

QLoRA 通常仍使用 LoRA 训练方式，再配置冻结基座的量化；不要把 `qlora` 当必然有效的 `finetuning_type` 枚举。`all` 的实际展开和是否排除输出头由框架/模型决定，打印目标模块与可训练参数确认。

无 packing 且每个设备 batch 一致时，有效样本 batch 为 `2×8×数据并行副本数`，不是 tensor/pipeline 并行卡数。有效 token batch 随长度、mask 和 packing 改变，梯度累积不增加单次可容纳长度。

### 3. 显存估算速查（7B 模型，BF16）

| 方式 | 可以先算的载荷 | 峰值仍需测量的部分 |
| --- | --- | --- |
| 全参 | 假设权重/梯度 BF16、主副本/Adam 状态 FP32：16 字节/参数，7B 为 112 GB | 激活、缓冲、分片通信 |
| LoRA | 7B BF16 基座载荷约 14 GB，另加适配器训练状态 | 激活和长序列仍可能主导 |
| QLoRA | 7B 的 4-bit 编码载荷约 3.5 GB | 元数据、未量化模块、反量化、激活和优化器峰值 |

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
2. **基座与目标不匹配**：Base/Instruct 都可能做 SFT 或继续训练，比较已有行为、预算和退化，不套硬规则。
3. **灾难性遗忘**：通用 replay 和 LoRA 是待验证措施，冻结底座不保证挂载后的行为无退化，比例由实验决定。
4. **EOS 处理不当**：数据没正确加结束符 → 推理时停不下来。
5. **重复样本/数据泄漏**：训练集混入评估集，离线指标虚高。
6. **学习率照抄**：优化器、有效 batch、缩放和目标层共同决定更新幅度；用验证曲线选择，不宣称固定十倍关系。

## 训练后的衔接

```
LoRA 适配器 ──► 合并权重(merge) ──► 评估回归(评估集+通用基准抽查)
           ──► 量化导出(GGUF/AWQ/GPTQ) ──► vLLM/llama.cpp 部署
```

- 合并后可无 LoRA 新增分支，但浮点/量化误差仍需回归；未合并与多 LoRA 的支持条件和运行开销要按实际服务测量。
- 上线前必须跑：任务评估集 + 通用能力抽查（确认没把模型「训傻」）+ 安全抽查。

## 高频追问

**Q：LoRA 的 target modules 挂哪些层？**
在固定数据与预算下比较 attention-only 和扩展 FFN，记录实际形状、参数、峰值和质量。GQA 的 K/V 宽度可能不同，不能按两个方阵统一计数，也不保证 all 必胜。

**Q：怎么判断模型「训好了」？**
三层验证：① loss 曲线正常收敛且无过拟合；② 任务评估集指标达标（对比训前 baseline）；③ 通用能力没退化（抽查几个通用基准/对话样例）。只看 loss 是新手最常见错误。

**Q：SFT 训练数据要多少条？**
由覆盖和学习曲线决定，不用千条/万条作充分条件。事实、行为、引用与权限需求要分开，SFT 不能代替知识版本治理。

**Q：QLoRA 训出来的效果和 LoRA 一样吗？**
原论文在具体设置下报告竞争力，不能外推为任意任务相同效果或峰值必减半。对照训练精度、未合并、合并与再量化的业务和安全指标。

**Q：多卡训练 DeepSpeed ZeRO 选哪个 stage？**
显存够 → ZeRO-1/2（只切优化器/梯度，通信少）；模型大到单卡装不下参数 → ZeRO-3（参数也切，通信开销大）。LoRA 微调 7B/14B 通常 ZeRO-2 足够。原理见 [分布式训练](/pretraining/distributed-training)。

**Q：做 GRPO/RLHF 训练用什么框架？**
按模型、算法、并行方式和排障需求选候选。在线 RL 要编排 rollout、奖励、训练和权重同步；没有同负载测试，不能断言某框架吞吐高得多。见 [强化学习基础](/advanced/rl-basics)。

## 首次训练的检查门禁

先对少量样本检查预处理和一小段训练，不把这当完整验收。留存环境版本、数据 hash、template、有效 token、可训练参数、训练步数与 checkpoint；再用未参与调参的任务/安全集比较底座和适配器，并测试重载、合并与回滚。日志平台不得上传未授权敏感样本。

[LLaMA-Factory 官方 README](https://github.com/hiyouga/LLaMA-Factory)已读取功能和后端说明；尝试读取旧示例 YAML 路径返回 404，因此本页配置仅为示意，不能声称已验证可运行。未执行训练、显存测量或部署测试。
