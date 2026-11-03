# LLMGuide 编辑与开发规范

阅读 `PRODUCT.md` 了解定位。保留已有文章 URL；不自动 commit、push 或部署；不将密钥写入任何文件。内容面向 L0–L4，核心为 L1/L2。

文章 frontmatter 必须有 `title`、`description`、`level`、`roles`。自动分级必须标 `classification: inferred`，人工审阅才能标 `reviewed`。技术审校日期不能根据 Git 时间推断。

优先解释设计动机、假设、失败模式、工程取舍和可验证计算。避免「最新」「最高频」「完全无损」等无出处绝对断言。引用论文、官方文档或官方实现，区分实验结果与通用结论。

修改后执行 `npm run check` 与 `npm run build`。全站机械指标不代表人工质量评分；未审查的准确性必须保留待核状态。
