# 扩散模型与图像生成

> 文生图（Stable Diffusion、DALL·E、Midjourney、Flux）和文生视频（Sora）背后都是扩散模型。它和大语言模型是两条不同的技术路线，理解其原理是多模态面试的高频点。

## 一、扩散模型的核心思想

扩散模型（Diffusion Model）的灵感来自物理扩散，分两个过程：

- **前向过程（加噪）**：对一张真实图片**逐步添加高斯噪声**，经过很多步后变成纯噪声。这一步是固定的、不学习的。
- **反向过程（去噪）**：训练一个神经网络，学会**从噪声一步步「去噪」还原出图片**。

```
真实图 ──加噪→ ──加噪→ ... ──→ 纯噪声     (前向，固定)
纯噪声 ──去噪→ ──去噪→ ... ──→ 生成图     (反向，模型学习)
```

生成时：从一团随机噪声出发，让训练好的网络反复去噪 T 步，「雕刻」出一张图。**模型实际学的是「预测每一步要去掉的噪声」**。

## 二、与 GAN / VAE 的对比

| 模型 | 原理 | 特点 |
| --- | --- | --- |
| **GAN** | 生成器与判别器对抗 | 快（一步生成），但训练不稳、易模式崩溃 |
| **VAE** | 编码到隐空间再解码 | 稳定，但生成偏模糊 |
| **Diffusion** | 多步去噪 | 质量高、多样性好、训练稳，但生成慢（多步） |

扩散模型以**高质量 + 训练稳定**胜出，成为图像生成主流，代价是采样需多步、较慢（后续有加速方法）。

## 三、关键技术

### 3.1 Latent Diffusion（潜空间扩散）= Stable Diffusion

直接在像素空间做扩散太贵（高分辨率图像素多）。**Latent Diffusion** 先用 VAE 把图片压缩到**低维潜空间**，在潜空间做扩散，最后解码回像素。这让消费级显卡也能跑文生图——这就是 **Stable Diffusion** 的核心。

### 3.2 文本如何控制生成？

文生图要让文本控制图像内容：

- 用文本编码器（如 **CLIP** 的文本塔，见 [多模态](/multimodal/multimodal)）把 prompt 编码成向量。
- 通过**交叉注意力（Cross-Attention）**把文本向量注入去噪网络，引导每一步去噪朝着「符合描述」的方向。

### 3.3 Classifier-Free Guidance（CFG）

同时算「有文本条件」和「无条件」的去噪预测，按 `引导强度` 放大二者之差，让生成更贴合 prompt。CFG scale 越大越「听话」但可能失真——这就是文生图里常调的「guidance scale」。

### 3.4 去噪网络：U-Net → DiT

- 早期用 **U-Net**（卷积为主）做去噪骨干。
- 新一代用 **DiT（Diffusion Transformer）**——把去噪网络换成 Transformer，可扩展性更好，**Sora、Stable Diffusion 3、Flux** 都采用，是当前趋势。
- **SD3（Stable Diffusion 3）** 使用 **MMDiT（Multimodal Diffusion Transformer）**——在 DiT 基础上做多模态融合，文本和图像 token 在同一 Transformer 里双流交互，对齐更深。

### 3.5 Flow Matching / Rectified Flow（2024-2025 新范式）

**Flow Matching** 是扩散模型的推广，正在成为新的主流训练框架：

- 传统扩散用随机微分方程（SDE）定义前向加噪过程；Flow Matching 用**确定性常微分方程（ODE）**，从噪声到数据的路径是一条更直的线。
- **Rectified Flow** 是 Flow Matching 的代表实现：直接学习从噪声到数据的"直线路径"，采样步数更少、训练更高效。
- **Flux**（Black Forest Labs，2024）采用 Rectified Flow + DiT 架构（12B 参数），在图像质量、prompt 跟随和文字渲染上达到或超越 Midjourney v6 / DALL·E 3，是目前最强开源文生图模型之一。
- **SD3** 也采用 Rectified Flow 替代传统 epsilon-prediction。

> 一句话区分：**扩散是"逐步加噪/去噪"，Flow Matching 是"沿直线从噪声流向数据"**——后者路径更短、采样更高效，正在成为统一框架。

### 3.6 采样加速

原始 DDPM 要上千步，慢。**DDIM、DPM-Solver、LCM、一致性模型（Consistency Models）** 等把采样压缩到几十步甚至 1~4 步，大幅提速。

## 四、应用与代表

- **文生图**：Stable Diffusion 3（MMDiT + Rectified Flow）、Flux（12B，Rectified Flow + DiT）、DALL·E 3、Midjourney v6。
- **文生视频**：Sora、可灵、Runway——在时空上做扩散（DiT + 时序）。
- **图像编辑/可控生成**：ControlNet（用边缘/姿态/深度等控制）、Inpainting（局部重绘）、LoRA（轻量定制画风，原理同 [LoRA](/finetuning/lora)）。

## 五、扩散 vs 自回归

图像生成主流是扩散（并行去噪、质量高）；语言生成主流是自回归（逐 token）。但二者在融合：也有自回归图像生成（如把图像 token 化后像语言一样生成），以及用扩散做语言生成的探索。

## 六、高频追问

**Q：扩散模型的基本原理？** 前向对图片逐步加噪直到变纯噪声（固定）；反向训练网络逐步去噪还原（学习）。生成时从随机噪声出发反复去噪「雕刻」出图，模型实际学的是「预测每步要去掉的噪声」。

**Q：为什么扩散模型比 GAN 更主流？** 扩散训练稳定（不像 GAN 易崩溃/模式崩溃）、生成质量高、多样性好。代价是采样需多步、较慢，但有 DDIM/LCM 等加速方法缓解。

**Q：Stable Diffusion 为什么能在消费级显卡跑？** 它是 Latent Diffusion——先用 VAE 把图片压到低维潜空间，在潜空间做扩散（数据量小得多），再解码回像素，大幅降低算力需求。

**Q：文本怎么控制图像生成？** 用文本编码器（如 CLIP）把 prompt 编码成向量，通过交叉注意力注入去噪网络，引导每步去噪朝符合描述的方向；再用 Classifier-Free Guidance 放大文本条件的影响。

**Q：U-Net 和 DiT 的区别？** U-Net 是卷积为主的去噪骨干（早期 SD）；DiT 用 Transformer 替代，可扩展性更好，Sora/SD3/Flux 等新模型采用，是当前趋势。

**Q：扩散模型和大语言模型是一回事吗？** 不是。LLM 是自回归、逐 token 生成文本；扩散模型是多步去噪、并行生成图像/视频。它们是不同的生成范式，但都可用 Transformer 作骨干，且在多模态系统里常配合使用。

**Q：Flow Matching 和传统扩散有什么区别？** 传统扩散用随机加噪/去噪（SDE），路径弯曲、步数多；Flow Matching 用确定性 ODE，从噪声到数据的路径更直，采样步数更少、训练更高效。Flux 和 SD3 都采用了 Rectified Flow（Flow Matching 的代表）。Flow Matching 正在成为扩散的统一推广框架。
