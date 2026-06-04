#!/usr/bin/env bash
# ECS 一键：git pull → 同步 backend → 构建前端 → 同步静态 → 重启 API
# 用法: bash /var/www/wework-saas-git/deploy/ecs_deploy_from_git.sh
set -euo pipefail

GIT=/var/www/wework-saas-git
RUN=/var/www/wework-saas/backend
WEB=/var/www/wework
WEB2=/var/www/zhiflow/frontend/dist

cd "$GIT"
git pull origin main

rsync -av --exclude node_modules --exclude .env \
  "$GIT/backend/" "$RUN/"

cd "$GIT/frontend"
npm ci
npm run build

rsync -av --delete "$GIT/frontend/dist/" "$WEB/"
rsync -av --delete "$GIT/frontend/dist/" "$WEB2/"

pm2 restart syqw-api --update-env
sleep 6
curl -sS http://127.0.0.1:3010/health
echo
echo "前端: $(grep -o 'index-[^\"]*\\.js' \"$WEB/index.html\" | head -1)"
echo "完成"
