---
title: Tokenizer 与分词
description: Tokenizer 决定了模型如何把文本切成 token，是输入输出的第一道关口，也是中英文成本差异、词表大小等问题的根源。
level: L1
roles:
  - 在校生
  - 算法研究
  - 应用开发
classification: inferred
---
# Tokenizer 与分词

> Tokenizer 决定了模型如何把文本切成 token，是输入输出的第一道关口，也是中英文成本差异、词表大小等问题的根源。

## 什么是 Tokenizer？

Tokenizer 把文本映射到词表 ID，并把输出 ID 解码为文本。实际流水线还可能有规范化、预切分、子词编码和特殊 token 处理。token 可是字、词片段、字节或控制标记，不一定介于字符和单词之间；一个 UTF-8 字符甚至可能由多个 token 的字节共同组成。

## 为什么不直接用字符或单词？

- **按单词切分（Word-level）**：固定词表外的词通常映射为 unknown，无法保留完整词形；扩大词表会增加存储成本。
- **按字符切分（Char-level）**：词表很小，但序列变得极长，且单个字符语义稀薄，建模困难。
- **子词切分（Subword）**：折中方案。常见词作为整体，罕见词拆成子词片段，兼顾词表大小和 OOV 处理，是主流做法。

## 主流子词算法

### BPE（Byte Pair Encoding）

训练 BPE 时，从基本符号开始反复合并高频相邻对，得到词表及合并优先级。基本符号可以是字符，也可以是字节。若包含完整 256 字节基础表，byte-level BPE 可表示有效文本的 UTF-8 字节，无须因新词退成 unknown；这不等于模型理解新词，也不覆盖规范化丢失、非法 Unicode 或特殊 token 策略等问题。字符 BPE 则可能遇到未覆盖字符。

构造训练语料：`low` 出现 3 次，`lower` 出现 1 次，且不跨单词边界合并。按词频计数，`l o` 与 `o w` 各出现 4 次，`w e` 与 `e r` 各出现 1 次；并列时这里指定先合并 `l o`：

```
初始：    l o w       l o w e r
第一轮：  lo w        lo w e r
第二轮：  low         low e r
```

第二轮 `lo w` 仍出现 4 次。推理时应用已经学好的优先级，不在用户文本上重新统计频率学习词表；实际预切分规则也会限制可合并边界。

### WordPiece

WordPiece 用于 BERT 系列。[Hugging Face 教学说明](https://huggingface.co/docs/transformers/tokenizer_summary)以联合出现频率相对独立频率的得分解释其词表构造动机，而不是 BPE 的纯频次；不应把一个教学得分当作所有工具完全相同的训练实现。常见 WordPiece 编码使用最长匹配，并带 `##` 等续接标记，而不是按 BPE merge ranks 编码。基础字符或词段覆盖不足时仍可能输出 unknown。

### Unigram / SentencePiece

**Unigram 是算法，SentencePiece 是工具库。** Unigram 从较大的候选子词集合出发，学习片段概率并按移除片段造成的损失变化裁剪词表；编码可选择高似然切分，训练也可采样多种切分。

[SentencePiece](https://github.com/google/sentencepiece)支持 BPE 和 Unigram，直接处理 Unicode 字符序列，不要求预先按空格分词；它不是天然的 byte-level tokenizer。是否启用 byte fallback、字符覆盖和规范化，应读具体模型配置，不能仅凭 LLaMA/Qwen 等家族名称推断。

默认 SentencePiece 规范化采用自定义 NFKC 变体，还可压缩多余空格。编码/解码因此未必还原原始字符串，只能在规范化约定下讨论可逆性。`▁` 常表示空格处理，不应直接等同一个天然单词边界。

## 中文为什么更「费 token」？

这不是中文的固定性质，而是词表、训练语料和预切分共同决定的效率。某些编码中常见英文词完整、中文字符拆得较细；面向中文的词表也可能把常见中文词编码得很短。应对相同语义任务分别计数，而不是套用「一个汉字几个 token」：

- 输入 token 更多会占据更多窗口；费用还需乘该服务单价，并计入输出和模板开销。
- 因此面向中文的模型（如 Qwen、GLM）会扩充中文词表来缓解。

## 高频追问

**Q：词表大小如何权衡？** 词表越大，单个 token 承载信息越多、序列越短、推理越快，但 Embedding 和输出层参数变多、显存占用增加，且低频 token 训练不充分。常见词表大小从 3 万到 15 万不等。

这里「更快」不是保证：短序列可降低部分计算，大词表又增大输出 head 和采样开销。跨模型替换整个 tokenizer，也不保证所有文本都更短。

**Q：为什么大模型会数错字母、做不好字符级任务（如反转字符串）？** 因为模型看到的是 token 而非单个字符，一个 token 可能包含多个字符，模型对 token 内部的字符结构感知很弱。

**Q：special token 有哪些？** 如 `<bos>`/`<eos>`（句子开始/结束）、`<pad>`（填充）、`<unk>`（未知）、以及对话模板里的角色标记（如 `<|user|>`、`<|assistant|>`）。微调时需对这些模板对齐。

**Q：Tokenizer 和模型必须配套吗？** 是的。token ID 与 Embedding 一一对应，换了 Tokenizer 就等于换了输入空间，模型权重无法直接复用。

**Q：BPE 和 WordPiece 的核心区别？** 要分训练和编码：BPE 学合并优先级并按规则合并；WordPiece 的词表构造动机不同，常见编码是最长匹配。不能只背一个评分规则就断言工具实现相同，也不能把 SentencePiece 当第三种互斥算法。

**Q：为什么扩充中文词表能省 token / 提速？** 默认词表里中文覆盖少，一个汉字常被拆成多个字节 token。扩充中文词表后，常见汉字/词组成为单个 token，序列变短，既省 API 成本又加快推理。代价是 Embedding 和输出层参数变大，且需要继续训练让新 token 学到合理表示。

**Q：同样一段话，为什么不同模型算出的 token 数不同？** 因为各家 Tokenizer 的算法、词表大小和语料不同。同一句中文在 GPT 系列和 Qwen 上的 token 数可能差一倍以上，所以跨模型比较成本时要用各自的分词器实际计数，不能套用固定换算。

**本地观察，而非背比例。** 以下需 Python 3 与 `tiktoken`；首次获取编码表可能需要网络。`cl100k_base` 是固定编码名，不代表当前所有产品的分词器。没有 API 调用与计费；输出长度请自己运行观察，本文不伪造计数结果。

```python
import tiktoken

encoding = tiktoken.get_encoding("cl100k_base")
samples = ["人工智能", " hello", "hello", "2026-11-05", "ＡＢＣ", "ABC"]
for text in samples:
    token_ids = encoding.encode(text)
    restored = encoding.decode(token_ids)
    print(repr(text), len(token_ids), token_ids, restored == text)
```

要检查服务请求用量，还应包括聊天模板、工具 schema 和服务额外封装；本地纯文本计数不等于账单。单独解码一个 token 也可能不是完整 UTF-8 字符，应避免把解码替换字符当作真实 token 内容。

<details>
<summary>自测：能编码新 emoji，是否证明没有 OOV 且模型认识它？</summary>

完整字节基础表可能把它拆成多个字节片段，因此无需 unknown；但表达可编码不等于训练充分或语义理解。再检查规范化是否保留原文本、special token 是否被解释为控制标记，才能判断具体输入契约。

</details>

实际契约检查应记录词表/merge 文件、normalizer、special token ID、chat template 和版本；修改词表后同步输入 embedding 与输出 head，并用原任务集回归，而不是只检查文件能载入。

一手资料：[SentencePiece 规范化](https://github.com/google/sentencepiece/blob/master/doc/normalization.md)、[tiktoken](https://github.com/openai/tiktoken)、[Hugging Face 分词算法](https://huggingface.co/docs/transformers/tokenizer_summary)。
