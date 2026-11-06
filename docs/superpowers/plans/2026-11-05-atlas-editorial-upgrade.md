# Atlas 全站逐篇深度重编 Implementation Plan

> **For agentic workers:** Use executing-plans where available. Each worker owns disjoint article files and its receipt. Do not overwrite other work. No commits, pushes, deployments or new branches.

**Goal:** 对现有 242 篇知识文章逐篇核查并深度重编，统一阅读呈现，保留 URL 与有价值内容。

**Architecture:** 多名作者分模块隔离、模块内依次处理正文；主 agent 维护账本、统一样式、交叉审查和构建。原有未提交文件已在仓库外快照备份。agent 编辑与人工技术审阅分开。

**Tech Stack:** VitePress / Vue、Markdown、现有 content.mjs 与 validate-build.mjs；不引入后端或付费图片接口。

---

## Task 1: 逐篇清单与分工

- [x] 读取 PRODUCT.md、DESIGN.md、AGENTS.md，保留已有改动。
- [x] 从 docs/_data/pages.json 的 article 字段锁定 242 篇；首页、路径、目录与设计文档不计入。
- [x] 写入 audit/editorial-20261105/inventory.json；初始全部 pending。
- [x] 每组依次读完整正文，按实质问题重编或说明保留理由，不脚本批量插入固定段落。

分工：foundations 26；training-inference 22；applications 37；alignment-research 25；engineering-tools 31；interview-1/2/3 各 30；models-multimodal 11。每组只写分配文章与 `audit/editorial-20261105/receipts/<group>.json`，不写共享目录、样式或其他组。

## Task 2: 正文编辑

- [x] 修正概念、单位、公式、版本与过强断言；未核数字或时效信息删除或保留待核标识。
- [x] 按读者层级组织：L0 直觉；L1 构建/排障；L2 约束/取舍；L3/L4 推导/实验/证据边界。
- [x] 知识或产品事实链接原论文、官方文档或官方实现；实际读取与仅链接在 receipt 中分开，不编造审阅。
- [x] 按需要补可复算例子、失败样例、验证协议、决策表或原生折叠自测，不强制代码/图表数量。
- [x] 保留 URL、已有关键标题锚点、交互组件、可用代码与相关链接；classification 不改 reviewed，不伪造 reviewedAt。
- [x] 每篇 receipt 包含 path、status（edited/retained）、summary、sources、sourceReview（verified/linked_only/not_applicable）和 openIssues。读正文后才可登记。

## Task 3: 阅读设计

- [x] 保留 Atlas 深色入口与浅色阅读内页，沿用 Manrope 与中文回退，不新增字体或图片依赖。
- [x] 标题、正文、例子、引用、自测层级清晰；宽表和代码在自身容器滚动，手机不整页溢出。
- [x] 动效为理解服务，减少动画与键盘路径可用；阅读进度不代表掌握度。
- [x] 独立排版评估与机械扫描；最终集中检查桌面/手机，集中修正后最多一次确认。

## Task 4: 整合与验证

- [x] receipt 对照实际内容和差异，未完成 / 待核事项保留，不把 agent 自述视作人工审校。
- [x] 交叉审查术语、公式、引用、版本、冗余与旧锚点；必要兼容锚点由主 agent 处理。
- [x] 全部写入结束后执行 npm run catalog、npm run check、npm run build、git diff --check，不让子 agent 并发重建共享产物。
- [x] 浏览器批量检查基础、研究、工程、面试的桌面/手机、展开、表格/代码、路由与减少动画。
- [x] 汇总 audit/editorial-20261105/report.md，明确实改、保留、待处理、待核、机械/视觉验证与人工审阅边界。

## 验收命令

在 D:/llm-projects/llm-interview-guide 执行 npm run check，检查元数据、站内路径与旧 URL；npm run build 完成目录重建、检查、构建与产物锚点校验；git diff --check 检查补丁格式。无新测试框架，无自动提交。只有每篇记录和对应验证确实完成后才能报告全站任务完成。

## 执行结果（2026-11-05）

242 篇均有逐篇编辑回执，剩余 0 篇。来源方式、未核事项与复算边界保留在 audit/editorial-20261105；机械验证与 agent 编辑不等于人工科学审校。全站 485 个浏览器案例经一次集中手机行内数学修正后通过；8 项依赖告警及较大搜索索引保留为后续工作。本轮不提交、推送或部署。
