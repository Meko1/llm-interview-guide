# 分布式训练与显存账本

“用了多卡”不是分布式训练的答案。高质量回答应先说模型为什么放不下，再说明数据并行、ZeRO/FSDP、张量并行和流水线并行分别消除了哪一种复制或哪一个瓶颈。

## 一、训练显存的五本账

1. **权重**：参数本身的存储。
2. **梯度**：可训练参数的反向结果。
3. **优化器状态**：AdamW 的一阶、二阶矩通常以高精度保存。
4. **激活**：反向传播所需中间结果，强依赖 batch、序列长度和层数。
5. **临时缓冲**：通信 bucket、attention workspace、allocator 碎片。

混合精度 AdamW 下，每个参数往往仍对应十几 bytes 的训练状态：低精度权重只是其中一部分。故“权重能放进显存”不等于“模型能训练”。长上下文时激活和注意力中间量又会迅速成为主导。

## 二、先区分三种容量问题

| 放不下的对象 | 优先手段 | 代价 |
| --- | --- | --- |
| optimizer/grad/参数状态 | ZeRO、FSDP、PEFT | 更多 gather/shard 通信或训练约束 |
| 激活 | micro batch、checkpoint、FlashAttention、序列并行 | 重计算、吞吐或实现复杂度 |
| 单层矩阵/计算 | Tensor Parallel | 层内高频通信 |

这张表比“显存不够就开 ZeRO-3”更准确。ZeRO-3 主要切分训练状态；它不会魔法般消掉长序列的激活峰值。

## 三、数据并行与 all-reduce

DDP 在每张卡复制完整模型、分发不同数据。反向后每卡得到本地梯度，通过 all-reduce 得到相同全局梯度，各卡再做同样更新，因此权重保持一致。它易用但不降低单卡状态占用。

全局 batch 为：

$$B_{global}=B_{micro}\times N_{DP}\times N_{accumulation}$$

梯度累积可模拟较大 batch，但不等价于免费扩卡：每次更新更慢、调度步数语义不同，通信与随机性也不同。

## 四、ZeRO/FSDP 与模型并行

ZeRO-1 切 optimizer state；ZeRO-2 再切 gradient；ZeRO-3 再切参数。FSDP 是按模块按需 gather 参数、完成计算后重新分片的常见实现。它们优先解决“数据并行下每卡重复保存状态”。

Tensor Parallel 在一层矩阵内部切分，例如按 attention head 或 MLP 中间维分摊到多卡；它通常需要低延迟高速互联。Pipeline Parallel 按层切 stage，通过 micro batch 填充流水线，但要处理流水线气泡。序列/上下文并行按 token 维切分，主要服务长上下文激活与 attention 压力。

## 五、Activation Checkpointing：拿计算换内存

反向必须使用前向中间值。checkpoint 不保存每一层激活，只保存边界，反向时重算中间片段。它减少的是激活，不是 optimizer state；代价是额外 FLOPs 和调度开销。随机层还要正确保存随机数状态，否则重算前后不一致。

## 六、性能不能只看 GPU 利用率

至少拆分 `compute`、all-reduce/collective、dataloader、pipeline idle 和显存峰值。一个简单扩展效率是：

$$E=\frac{\text{单卡吞吐}\times\text{卡数}}{\text{多卡实际吞吐}}$$

卡数翻倍但吞吐只增 30%，常见原因是通信不能与反向重叠、每卡 batch 太小、数据加载慢、stage 负载不均或跨节点拓扑差。profile 后再调策略，比继续堆卡有效。

## 七、面试高频问答

### Q1：ZeRO-3 和 TP 的区别？

ZeRO-3 在数据并行组内分片参数、梯度和 optimizer state，重点解决状态复制；TP 在一层计算内部切张量，需要多个设备共同完成一次层计算，重点解决单层容量与计算。二者常组合。

### Q2：OOM 时先做什么？

先看显存快照，判断峰值来自状态、激活还是临时 buffer。激活主导先处理长度、micro batch、checkpoint 与 attention 实现；状态主导再考虑 FSDP/ZeRO、PEFT 或 optimizer 配置。

### Q3：为什么多卡可能更慢？

因为计算没有覆盖通信，或每卡工作太少。还可能是数据供给、拓扑和流水线气泡问题。要用 profiler 分出等待时间，而不是凭总利用率猜测。

## 八、面试回答模板

> 我会先列显存账本：权重、梯度、Adam 状态、激活和通信缓冲。DDP 只分数据，状态仍复制；状态放不下时用 ZeRO/FSDP，激活放不下时用 checkpoint、长度治理或序列并行，单层放不下再上 TP。选型后我会用 tokens/s、通信等待和显存峰值做 profile 验证，并把 checkpoint 的模型、optimizer、scheduler 和数据状态一起保存，保证可恢复。
