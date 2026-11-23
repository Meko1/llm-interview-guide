---
name: 知序 · LLM 学习手册
description: 冷白、墨色与钴蓝的中文技术出版物
colors:
  cobalt: "#3157bb"
  cobalt-hover: "#25489f"
  cobalt-soft: "#e9eefb"
  paper: "#f6f7fa"
  paper-alt: "#eff1f6"
  surface: "#fcfcfe"
  ink: "#202633"
  ink-secondary: "#515d71"
  ink-muted: "#606d80"
  divider: "#dce1eb"
  border: "#c9d1df"
  dark-cobalt: "#a6bbff"
  dark-cobalt-hover: "#c2d0ff"
  dark-cobalt-soft: "#253252"
  dark-paper: "#171b24"
  dark-paper-alt: "#1d2330"
  dark-surface: "#202736"
  dark-elevated: "#242b3a"
  dark-ink: "#e8ecf5"
  dark-ink-secondary: "#b5bfd3"
  dark-ink-muted: "#a2aec5"
  dark-divider: "#333e53"
  dark-border: "#45526a"
  button-text: "#f8f9fc"
typography:
  display:
    fontFamily: "Manrope, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "clamp(36px, 3.5vw, 50px)"
    fontWeight: 700
    lineHeight: 1.42
    letterSpacing: "-.035em"
  body:
    fontFamily: "PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "17px"
    lineHeight: 1.95
  article-title:
    fontFamily: "Manrope, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "clamp(29px, 3vw, 38px)"
    fontWeight: 700
    lineHeight: 1.45
  catalog-title:
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.65
rounded:
  control: "6px"
  panel: "12px"
spacing:
  small: "8px"
  medium: "16px"
  large: "24px"
  section-gap: "32px"
  mobile-section: "48px"
components:
  button-primary:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.button-text}"
    rounded: "{rounded.control}"
    padding: "13px 20px"
  button-primary-hover:
    backgroundColor: "{colors.cobalt-hover}"
    textColor: "{colors.button-text}"
  path-application:
    backgroundColor: "{colors.cobalt-soft}"
    rounded: "{rounded.panel}"
    padding: "32px"
  path-research:
    backgroundColor: "{colors.paper-alt}"
    rounded: "{rounded.panel}"
    padding: "32px"
---

# Design System: 知序 · LLM 学习手册

## Overview

**Creative North Star: "技术出版物"**

用户于 2026-11-12 确认整体替换 Atlas 品牌：以冷白、墨色和钴蓝建立清晰、克制的阅读环境。应用开发与面试、算法与训练进阶并列为主要入口；品牌标记为 `docs/public/zhixu-mark.svg`。

本文件为 2026-11-13 的实现核对，合并更新既有 DESIGN.md。以 `docs/.vitepress/theme/zhixu.css`、`components/HomePage.vue`、`components/ArticleCatalog.vue` 为主，结合 `index.ts` 引入的旧样式层确认继承行为。这里记录源码事实，不代替浏览器视觉验收。最新主题覆盖最后加载；旧 `atlas-*` 类名与兼容资源仍保留。

**Key Characteristics:**

- 页面依靠标题、编号、细分隔线与留白建立秩序。
- 首页封面和精选问题连接对应文章或段落。
- 首页、导航和长文共用明暗主题变量；教学画布保留固定深色背景。
- 不自动播放装饰动画；保留操作反馈和教学状态变化。

## Colors

### Primary

钴蓝用于链接与因果掩码图版。双路线通过文字与细线区分，明暗主题均使用语义颜色变量。

### Neutral

冷白承载页面，次级纸色分隔阅读区块，面板表面提高筛选器的辨识度。墨色、次级墨色和弱墨色分别承担标题正文、说明及辅助信息。细分隔线与控件边框使用不同深度。深色主题保留相同语义关系。

**教学画布的边界：** 教学实验（`labs.css`）、路线步骤（PathJourney）和能力定位上下文仍保留固定深蓝绘图画布，不随页面主题切换。控件和状态已换成钴蓝色系；教学主操作色为 `#7890e5`，焦点色为 `#98abee`，路线当前步骤为 `#b7c7fa`。它们是绘图专用色，不替代页面的语义品牌变量。浅色页面中的深色画布是保留的专业绘图区域。

**当前与完全统一的差异：** 教学区域仍有局部字号、圆角及固定色值；旧类名和未使用的旧样式也仍保留。新主题已覆盖首页搜索按钮、首页焦点及深色 `--guide-focus` / `--guide-surface`，不要将历史 CSS 中的定义直接当作当前最终样式。

## Typography

中文正文使用系统无衬线；展示标题和编号继承 Manrope 加中文系统字体。Manrope 仅自托管 700 字重，字体文件为 `docs/public/fonts/manrope-bold.ttf`，使用 `font-display: swap`。

- 模型专题封面的中文标题优先取系统宋体，拉丁模型名称使用同组衬线斜体。桌面字号 44–70px，手机 32–50px。
- 精选与主题标题沿用宋体层级，路线、图解和正文使用无衬线字体。
- 长文正文使用 body 层级，767px 以下缩为 16px，行高不变。长文二级标题桌面 27px、手机 24px；三级标题 21px、手机 20px。
- 目录标题使用 catalog-title 层级，手机 18px；描述 15px、行高 1.85；元信息 13px。目录描述保留两行截断。
- 标签与辅助文字通常为 13–15px；实验和能力定位中仍存在更小的继承字号，尚不属于统一后的正文规范。

## Layout

专题封面宽度上限 1300px。桌面左侧是问题标题、导读和双路线，右侧是因果掩码。手机依次显示标题、两个路线入口和图解。

主题索引桌面三列、959px 以下两列、767px 以下单列。L0–L4 桌面横排五列，手机改为纵向紧凑条目。目录筛选器桌面为宽关键词框加三个选择框，手机单列；板块条目按组排列，保留标题、描述和元信息。

长文在带页内目录的布局中最大宽度 46rem；侧栏宽 272px。段落上下间距 20px，二级标题上方 56px、手机 40px。代码、表格及公式采用局部滚动；不要把长行内容扩展成页面级横向滚动。

## Elevation & Depth

首页、主路线与目录以底色和边框区分层级，没有新增面板投影。不要把此结论扩展成 VitePress 搜索弹窗等内建组件完全无阴影。阅读进度条层级为 31，默认隐藏；仅支持 CSS 滚动时间轴时显示，减少动画偏好下隐藏。

## Shapes

主要按钮、输入框、代码块与引用块使用 control 圆角，主路线和筛选面板使用 panel 圆角。旧组件仍有 4px、8px、10px 和圆形节点，并未全局收敛成两个圆角值。品牌标记为钴蓝圆角方块中的白色「知」字；箭头使用内联 SVG。

## Components

- **主次按钮：** 主按钮钴蓝实底，次按钮使用文本色和描边，最小高度 48px；桌面内边距见 frontmatter，手机主次按钮为 12px 15px。悬停改变底色，按压缩放至 0.98。目录空状态的通用按钮继承旧 `!important` 白色文字，因此与首页主按钮存在轻微颜色差异。
- **首页导览**：主文章由具体问题引出。用 Q 行选择当前位置，实色单元代表允许访问的位置，斜线代表屏蔽位置。首屏两条路线分别进入应用与研究。
- **问题阅读列表：** 左侧序号，中间问题与说明，右侧级别及阅读时长。手机将元信息移到标题下方。悬停仍有横移 4px 的继承反馈。
- **目录筛选：** 关键词只匹配标题和描述，另有主阅读级别、目标岗位、知识板块三个选择框。`q`、`level`、`role`、`section` 保存到 URL，并在路由切换与浏览器历史变化时读取。结果数量使用状态播报；空结果提供清除筛选入口。首页板块入口直接链接到目录筛选结果。
- **导航与长文：** 沿用 VitePress 导航、侧栏、页内目录和搜索；长文元信息保留分级与核查状态。保持旧文章 URL 与锚点。首页导航及搜索按钮已显式覆盖为共享主题色。
- **教学与能力定位：** 保留现有输入、状态、计算和自测。视觉变化不得改变技术含义。固定深色绘图画布及其专用色见 Colors。
- **焦点和动效：** 全局焦点轮廓使用 `--guide-focus`；教学画布使用固定浅钴蓝焦点色。首屏、正文与路线详情已取消入场动画。减少动画偏好关闭动画和过渡。

## Do's and Don'ts

- 使用语义主题变量添加新界面，同时验证浅色与深色状态。
- 通过中文标题、说明、序号与分隔线支持阅读和定位。
- 保留文章 URL、主要导航标签、搜索、技术内容、阅读分级和教学交互。
- 明确区分共享明暗主题的阅读界面与保留固定深色背景的教学画布。
- 不把初次分级、文章数量、浏览进度或查看答案写成能力掌握与质量认证。
- 不新增持续装饰动效，不将旧薄荷色局部样式继续扩散为品牌规范。
