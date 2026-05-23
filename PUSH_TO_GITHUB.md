# 如何把本项目推送到你的 GitHub

下面是两种方式，任选其一。仓库地址将是：`https://github.com/Meko1/llm-interview-guide`

---

## 准备：先在 GitHub 上创建一个空仓库

1. 登录 https://github.com/Meko1 ，点右上角 **+ → New repository**。
2. Repository name 填：**`llm-interview-guide`**。
3. **不要**勾选 "Add a README / .gitignore / license"（保持空仓库，避免冲突）。
4. 点 **Create repository**。

---

## 方式 A：用脚本一键推送（推荐）

在终端里 `cd` 到本项目文件夹（即包含 `package.json` 的 `llm-interview-guide/` 目录），然后运行：

```bash
bash push.sh
```

脚本会自动 `git init`、提交、关联远程仓库并推送。第一次推送时会要求你登录 GitHub（见下方「关于身份验证」）。

---

## 方式 B：手动执行命令

在项目根目录依次执行：

```bash
git init
git add .
git commit -m "init: 大模型面试指南 (LLMGuide)"
git branch -M main
git remote add origin https://github.com/Meko1/llm-interview-guide.git
git push -u origin main
```

---

## 关于身份验证（重要）

GitHub 早已不支持账号密码直接推送。第一次 push 时，请用以下任一方式登录：

- **推荐：Personal Access Token（PAT）**
  1. 打开 https://github.com/settings/tokens → **Generate new token (classic)**。
  2. 勾选 **repo** 权限，生成后复制这串 token。
  3. push 时，用户名填 `Meko1`，**密码处粘贴这个 token**（不是你的账号密码）。

- **或：GitHub CLI**：安装 [`gh`](https://cli.github.com/) 后运行 `gh auth login`，按提示在浏览器授权，之后 push 免输入。

- **或：SSH**：若你已配置 SSH key，把远程地址换成
  `git@github.com:Meko1/llm-interview-guide.git` 即可。

---

## 推送之后：开启网站（GitHub Pages）

1. 仓库 **Settings → Pages**。
2. **Build and deployment → Source** 选 **GitHub Actions**。
3. 仓库里已自带工作流（`.github/workflows/deploy.yml`），它会自动构建并发布。
4. 等 Actions 跑完，访问：`https://meko1.github.io/llm-interview-guide/`

> 若网站资源 404，多半是 `base` 路径问题。确认 `docs/.vitepress/config.mts` 里的 `base` 为 `/llm-interview-guide/`（与仓库名一致）。
