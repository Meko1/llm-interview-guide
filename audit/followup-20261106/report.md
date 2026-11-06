# Atlas 续验与风险收尾报告

2026-11-06。本轮接续已完成的 242 篇文章交付，处理依赖、安全验证和搜索验收；不重复重写正文，不改变 URL、分级与来源审查标记，不提交、推送或部署。

## 已交付

- 兼容范围内更新锁定依赖，完成实际安装验证，而不是仅修改 package-lock.json。
- 搜索空白态增加两行等待说明，按钮无障碍名称说明首次全文索引加载；无结果时提示缩短为核心术语。提示是静态说明，不伪装成实时加载进度。
- 新增 `scripts/validate-search.mjs`，接入 `npm run build`：必须存在唯一 root 索引，242 篇均在索引中，7 组中英文检索有相关前 16 项，2 个仅正文检索词有结果。
- MiniSearch 7.2.0 显式列为开发依赖，与 VitePress 原来使用的版本一致，避免校验脚本暗中依赖包提升。
- 独立审查提出的“root 检查可能被静默跳过”和“仅 schema 不证明正文字段有内容”已修正。

## 依赖更新与安全边界

| 项目 | 原实际安装版本 | 本轮实际安装版本 |
| --- | --- | --- |
| Vue、shared、SSR 等同版本家族 | 3.5.34 | 3.5.45 |
| PostCSS | 8.5.15 | 8.5.32 |
| nanoid | 3.3.12 | 3.3.20 |
| source-map-js | 1.2.1 | 1.2.2 |
| MiniSearch | 7.2.0（间接） | 7.2.0（显式） |

VitePress 1.6.4、Vite 5.4.21、esbuild 0.21.5 保持原兼容范围，没有执行强制 audit fix 或未经验证的大版本替换。

审计比较：**2026-11-05 上轮快照 8 项（6 high / 2 moderate）→ 2026-11-06 完整安装后成功返回的审计 3 项（1 high / 2 moderate / 0 critical）**。不是 0 风险：剩余为 `vitepress → vite → esbuild` 构建/开发链，详情在 audit-after.json。

`npm audit --omit=dev` 返回 0 仅说明 npm 的开发依赖分类过滤结果；Vue 等依赖仍会参与生成静态客户端资源，不能由此认证网站或构建流程完全安全。

### 安装一致性纠正

本轮中途发现隐藏 npm 锁记录与实际解出的文件不一致；当时 Vue 的锁版本是 3.5.45，实际代码仍为 3.5.34。原始分歧如何产生未证明，不能仅从 npm 的“up to date”或 lockfile 断言已修复。首次重装遇到 Windows 的 esbuild 文件占用，释放本项目构建 helper 后，从干净缓存和新依赖树执行 npm ci，再验证 **185 个实际安装 manifest，0 个锁版本不匹配**。

SSR 反例：对属性名 `data-safe\ronfocus` 调用实际 `ssrRenderAttrs`。旧 3.5.34 会输出原始 CR；实际 SSR/shared 3.5.45 拒绝该属性，只保留正常 title。保存前后结果与可复跑探针。这个反例通过不等于全面 XSS 或供应链审计。

官方修复线索：[Vue SSR 属性名 CR 修复](https://github.com/vuejs/core/commit/a2b40db9a83b36ed9da3a16403cf8f040262d73f)。其余公开 advisory 地址直接记录在审计 JSON 中。

## 搜索方案的实测取舍

**最终保留原完整全文索引：6,366,787 字节，4,545 个章节，97,008 个词项。大 chunk 警告仍保留，没有调整告警门槛。**

试验过构建期 gzip + 按需解码原型，但未交付：

| 单次本地实验 | 原搜索 | gzip 原型 |
| --- | --- | --- |
| 本地冷开搜索 | 8.917 秒 | 0.878 秒 |
| 2 Mbps / 80 ms / 4 倍 CPU 限速冷开 | 17.328 秒 | 11.086 秒 |
| 同条件重新打开 | 2.151 秒 | 10.329 秒 |
| 索引编码传输体积 | 约 1.227 MB（预览服务器 HTTP Brotli） | 约 1.785 MB |

原型看似改善本地首次加载，却增加已 Brotli 压缩时的传输量并使重新打开退步。本地预览的即时压缩成本不能代表 GitHub Pages CDN，因此拒绝作为正式优化；解码依赖 fflate、压缩适配器均已移除。实验完整记录见 search-experiments.json，明确不是正式版本性能承诺。

中文分词与字符 n-gram 也仅做离线实验：分词边界与固定预期不一致、跨浏览器一致性未验证；n-gram 估算增加索引体积。没有将它们或仅标题索引替代完整全文搜索。真正的结构优化仍需另立兼容与性能验收，不把移除构建警告当成用户体验改善。

## 最终验收

| 检查 | 结果 |
| --- | --- |
| 242 篇正文 SHA256 | 全部与已完成编辑库存一致，未重新编辑正文 |
| npm run check | 254 个元数据页面通过 |
| npm run build / check:built | 276 个源页面、277 个 HTML 通过 |
| check:search | 唯一 root、242 条文章路线、7 个中英文查询、2 个仅正文查询通过 |
| 旧标题深链接 | 4,281 个原 ID 全部保留 |
| 数学 | 563 个容器，无渲染错误；不证明全部数学结论正确 |
| 全站浏览器 | 242 路线 × 1440/390，另 320 深色/减少动画图解，共 485 案例，无脚本/资源/整页溢出/数学异常 |
| 搜索专项 | 1440 浅色、390 浅色、320 深色/减少动画：21 查询、等待提示、无结果提示、结果 SPA 导航通过 |
| 安装一致性 | 185 个 Windows 实际安装包，0 个锁版本差异 |
| Vue SSR CR 反例 | 实际 3.5.45 通过 |
| git diff --check | exit 0；未因 CRLF 提示改变仓库设置 |

485 个页面案例在实际依赖升级后执行；随后仅精简搜索提示换行，以重新构建和 21 个搜索查询复验。目视检查代表手机搜索截图，不能冒称 242 篇都获人工美学/无障碍审查。验证是本地构建与浏览器检查，不是线上部署监控。

## 剩余事项

1. 构建/开发链剩余 3 个审计项：评估受维护的 VitePress/Vite 组合，并完成新的构建与浏览器矩阵后再升级；暂不强行覆写兼容范围，不把本地开发服务器暴露公网。
2. 完整全文索引仍约 6.37 MB：需要真正的索引结构与加载策略优化，保留中英文检索、正文检索、深链接与跨浏览器回归。
3. 来源、版本、实验和专业审校继续看九组逐篇 openIssues。原 verified 199 / linked_only 34 / not_applicable 9 不变；verified 不是全文人工科学审校，不自动关闭待核事项。
4. 本轮没有执行训练、GPU benchmark、商业模型 API、真实审批/资金操作，没有使用历史对话中暴露的密钥。

## 证据与复跑

- `validation.json`：本轮静态、构建、搜索、安全和出版状态汇总。
- `browser-validation.json`：485 行完整页面结果；`search-browser-validation.json`：搜索专项。
- `audit-before.json`：上轮历史快照；`audit-after.json` / `audit-production.json`：本轮成功审计。
- `installed-lock-verification.json`：185 个实际 manifest 与锁版本对照。
- `vue-cr-before.json` / `vue-cr-after.json`：明确版本的 SSR 反例；`probes/vue-ssr-cr.mjs`：便携探针。
- `search-experiments.json`：被拒绝的 gzip 原型与测量条件，不作为上线版本数据。

常规验证：分别运行 `npm run check` 和 `npm run build`。独立搜索验证：`npm run check:search`。压缩体积仅诊断：`node scripts/validate-search.mjs --measure`。SSR 反例：`node audit/followup-20261106/probes/vue-ssr-cr.mjs`。

**未提交、推送或部署。** 本轮不覆盖上轮 242 篇编辑报告与回执，旧报告顶部仅增加本报告入口，避免将旧告警数字误认为最新状态。
