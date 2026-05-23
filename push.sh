#!/usr/bin/env bash
# 一键把本项目推送到 GitHub: https://github.com/Meko1/llm-interview-guide
# 用法： bash push.sh
set -e

REMOTE_URL="https://github.com/Meko1/llm-interview-guide.git"

cd "$(dirname "$0")"

echo "==> 当前目录: $(pwd)"

if [ ! -d .git ]; then
  echo "==> 初始化 git 仓库"
  git init
fi

echo "==> 添加并提交文件"
git add .
git commit -m "init: 大模型面试指南 (LLMGuide)" || echo "（无新改动可提交，跳过）"

echo "==> 设置默认分支为 main"
git branch -M main

if git remote | grep -q "^origin$"; then
  echo "==> 远程 origin 已存在，更新其地址"
  git remote set-url origin "$REMOTE_URL"
else
  echo "==> 添加远程 origin"
  git remote add origin "$REMOTE_URL"
fi

echo "==> 推送到 GitHub（首次会要求登录，密码处请粘贴 Personal Access Token）"
git push -u origin main

echo ""
echo "✅ 完成！接下来到 GitHub 仓库 Settings → Pages，把 Source 设为 'GitHub Actions' 即可自动部署。"
echo "   站点地址将是: https://meko1.github.io/llm-interview-guide/"
