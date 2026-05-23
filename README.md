# LLMGuide · 大模型面试指南

> 系统整理大模型 / LLM 方向的「八股文」与高频面试题，参考 [JavaGuide](https://javaguide.cn/) 的形式，覆盖大模型基础、Transformer、预训练、微调、RLHF、Prompt、RAG、Agent、推理优化与部署、评估、多模态等。

基于 [VitePress](https://vitepress.dev/) 构建的纯静态文档网站，可一键部署到 GitHub Pages。

## 内容结构

- **大模型基础**：核心概念总览、Transformer、Attention 及变体、位置编码（RoPE/ALiBi）、Tokenizer
- **训练与微调**：预训练目标与数据、缩放定律与涌现能力、SFT/PEFT、LoRA/QLoRA、RLHF/DPO
- **Prompt 工程**：Few-shot、CoT、ReAct、Prompt 注入与防护
- **RAG**：基础流程与组件、进阶优化与评估
- **Agent**：核心组件与范式、Function Calling 与 MCP
- **工程与落地**：推理优化与部署、模型评估与幻觉
- **进阶**：多模态大模型、经典模型盘点

## 本地运行

需要 Node.js 18+。

```bash
# 安装依赖
npm install

# 本地开发（默认 http://localhost:5173）
npm run dev

# 构建静态站点（输出到 docs/.vitepress/dist）
npm run build

# 本地预览构建产物
npm run preview
```

## 部署到 GitHub Pages

本仓库已内置 GitHub Actions 工作流（`.github/workflows/deploy.yml`），推送到 `main` 分支会自动构建并部署。

启用步骤：

1. 在 GitHub 仓库页面进入 **Settings → Pages**。
2. 把 **Build and deployment → Source** 设置为 **GitHub Actions**。
3. 推送代码到 `main` 分支，Actions 会自动构建并发布。
4. 站点地址通常为 `https://<用户名>.github.io/llm-interview-guide/`。

> 注意：`docs/.vitepress/config.mts` 中的 `base` 已设为 `/llm-interview-guide/`，与仓库名一致。如果你改了仓库名，或使用自定义域名/部署到根路径，请相应修改 `base`。

## 贡献

欢迎提 Issue 指出错误，或提 PR 补充 / 完善内容。

## 许可

[MIT](./LICENSE) © Meko1
