# 四篇标杆内容验证记录

日期：2026-11-03。基线：cd89cbb。正文修改仅限 RAG、Agent、LoRA、RLHF；未提交、推送或部署。

## 内容变化

- RAG：合并重复速记、项目话术与收口，保留并重组解析、版本、权限、检索、引用、评测、更新与容量主线；补充 Recall / Hit 区分、时效冲突与可复算向量预算。
- Agent：合并重复答题模板；增加模型/执行器分工、暂停与恢复、审批动作绑定、外部操作账本、checkpoint 的重复副作用窗口。
- LoRA：补充非方阵形状、初始化梯度、训练状态账本、参数量复算、量化与合并边界；移除无条件单卡、零延迟和统一效果排序。
- RLHF：区分反馈来源与算法，补充 DPO 假设与损失复算、PPO 旧策略/参考区别、GRPO 成本与奖励边界。
- 所有追问明确为模拟题；项目表达要求真实证据，不提供虚构线上成绩。

## 一手资料核对

核对 LoRA（2106.09685）、QLoRA（2305.14314）、InstructGPT（2203.02155）、DPO（2305.18290，包括 HTML 推导）、DeepSeekMath（2402.03300）、RAG（2005.11401）、Lost in the Middle（2307.03172）、BEIR（2104.08663）、ReAct（2210.03629）、Constitutional AI（2212.08073），以及 Anthropic Agent 模式与 AWS 幂等设计文档。

PEFT / TRL 的官方源码与文档引用固定到本轮读取的提交：65e7758329ace54785cd3e43dbf727f8ba879016、b40abd828000255d723fd2bb2e1984266e55865f。没有声称安装或训练这些版本。

## 可执行验证

- npm run check：244 个清单页面元数据、内部路径与基线 URL 通过。
- npm run build：264 个 Markdown 源页面均生成产物；265 个 HTML 的站内目标与锚点检查通过。
- git diff --check：通过。
- 旧标题锚点：RAG 105/105、Agent 96/96、LoRA 14/14、RLHF 17/17，共 232 个；无重复 ID。RAG/Agent 合并标题后的旧深链映射至对应主题段落，不保留重复正文。
- 三段正文 Python 标准库代码实际执行，规范化 Windows 换行后与正文预期输出逐行一致。DPO 另查正负大 logit 的有限损失与策略等于参考时的 log(2)。

实际输出：

```text
RAG: Macro Recall 0.500; Hit Rate 0.667
LoRA: 8,388,608 parameters; 16.0 MiB; Fraction of 7B 0.120%
LoRA: Unmerged [5.0, 10.5]; Merged [5.0, 10.5]
DPO: Logit 0.200000; Loss 0.598139; reference loss 0.693147
```

这些是构造数据复算，不是模型训练、GPU 性能或业务效果实验。

## 页面阅读验证

本轮没有修改主题或引入依赖。agent-browser CLI 不在可执行路径，改用本机已配置的 Playwright + Chromium 检查本地 preview，非线上发布验证。

- 四篇在 1440×1000 与 390×844 均无页面级水平溢出；浏览器无 pageerror，页面请求未出现 HTTP 4xx/5xx。
- 初检发现站点未启用数学渲染：LoRA/RLHF 会显示 LaTeX 源码。仅将两篇公式改为可读文本公式，保留数学含义；复检未出现原始 LaTeX。
- 四篇各抽检一个旧末尾深链，DOM 锚点存在；全量 232 个锚点另以构建产物验证。
- RLHF 推导 details 可用 Enter 展开；深色主题抽检；LoRA/RLHF 仍显示“初次分级 · 待核实”。
- 截图保存在本机临时目录：llmguide-core-rag-desktop.png、llmguide-core-lora-mobile-final.png、llmguide-core-rlhf-dark.png，不作为站点资产提交。

## 独立复核与边界

独立 AI 审阅以新上下文只读核对四篇，未发现正文阻塞项；指出 LoRA/RLHF 改标 reviewed 会误导为人工分级，已恢复原 inferred。RAG/Agent 保留原元数据，不新增人工审校日期。

没有人工技术审稿，没有评分达标声明，没有模型训练与线上负载验证。原有全站大搜索 chunk 构建警告仍在；依赖未改。全站其他正文的准确性不在本轮认证范围。

目录与机械审计文件因 catalog 重建同步更新，包括上一次发布后的 Git 日期刷新；这些日期仍不等于技术审校日期。
