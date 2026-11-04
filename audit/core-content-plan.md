# 四篇标杆内容补强计划

用户于 2026-11-03 确认本轮范围：RAG、Agent、LoRA、RLHF；保留已上线视觉与旧 URL，发布前再次确认。

## 目标与方法

- RAG、Agent：把重复的速记、项目话术与收口章节合并为一条阅读主线；保留数据治理、安全、恢复、评测和容量等实质内容。
- LoRA、RLHF：补齐公式假设、可复算例子、部署边界、方法选型和分层追问；去除没有条件的效果与成本保证。
- 新增章节锚点采用稳定语义名。将原版所有标题锚点映射到对应新章节，用页面内兼容锚点保留旧深链；不把历史标题再次堆进侧栏。
- 代码仅提供 Python 标准库的教学复算，不声称训练过模型。数据明确为构造样例，不代表线上指标或真题。
- 保持原阅读级别；人工核实分级与独立技术审校分开，不填写 reviewedAt 或伪评分。

## 实施清单

- [x] 核对原论文、官方实现及四篇原文，记录关键修正。
- [x] 精简 RAG 与 Agent，加入证据诊断和写操作恢复案例。
- [x] 补强 LoRA 与 RLHF，执行参数量与 DPO 损失复算。
- [x] 对照 cd89cbb 的 232 个旧标题锚点，确认全部保留。
- [x] 执行 npm run check、npm run build、git diff --check，抽检桌面与移动端阅读。
- [x] 记录验证与未完成事项，不自动提交、推送或部署。

## 涉及文件

正文仅修改 docs/rag/rag-basics.md、docs/agent/agent-basics.md、docs/finetuning/lora.md、docs/finetuning/rlhf.md。构建会更新 docs/_data/pages.json、audit/inventory.csv 与 audit/report.md；验证记录另存 audit/core-content-validation.md。不改主题、依赖和全站其他正文。

## 验收边界

已增加一次独立 AI 只读复核；它不是人工技术审校，也不生成 85 分等发布评分。本轮未运行模型训练与线上负载实验。
