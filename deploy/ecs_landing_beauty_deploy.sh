#!/bin/bash
# 美业抖音落地页一键部署脚本
# 用法：在 ECS 上 cd /var/www/wework-saas && git pull && bash deploy/ecs_landing_beauty_deploy.sh
#
# 部署后访问地址：https://wework.syzs.top/landing-beauty.html
# 数据流向：用户填表 → /api/v1/leads/10010/submit → tenant_id=10010（杭州中数云科智慧科技有限公司）CRM

set -e

SRC="/var/www/wework-saas/docs/promo/product-landing-beauty.html"
FILENAME="landing-beauty.html"

echo "=== 美业抖音落地页部署 ==="
echo "源文件: $SRC"
echo ""

# 1. 校验源文件
if [ ! -f "$SRC" ]; then
  echo "❌ 源文件不存在，请先在 /var/www/wework-saas 执行 git pull"
  exit 1
fi

# 2. 自动检测 nginx 静态根目录（适配多套配置）
NGINX_ROOT=""
CANDIDATE_ROOTS=(
  "/var/www/wework-saas/frontend/dist"
  "/var/www/zhiflow/frontend/dist"
  "/var/www/wework"
)
for r in "${CANDIDATE_ROOTS[@]}"; do
  if [ -d "$r" ]; then
    # 进一步验证该目录是否被 nginx 实际服务（看是否有 index.html）
    if [ -f "$r/index.html" ] || [ -f "$r/index.htm" ]; then
      NGINX_ROOT="$r"
      break
    fi
  fi
done

# 如果没找到 index.html，用 grep 从 nginx 配置里查 root
if [ -z "$NGINX_ROOT" ]; then
  echo "⚠️  未在常见路径找到 nginx 静态根，尝试从 nginx 配置自动识别..."
  if command -v nginx >/dev/null 2>&1; then
    DETECTED=$(sudo nginx -T 2>/dev/null | grep -E "^\s*root\s+/" | grep -oE "/var/www/[^ ;]+" | head -1)
    if [ -n "$DETECTED" ] && [ -d "$DETECTED" ]; then
      NGINX_ROOT="$DETECTED"
    fi
  fi
fi

if [ -z "$NGINX_ROOT" ]; then
  echo "❌ 无法自动识别 nginx 静态根目录"
  echo "   请手动查找：sudo nginx -T 2>/dev/null | grep -E 'root\\s+/' | head -5"
  echo "   然后手动执行：sudo cp $SRC <你的nginx_root>/$FILENAME"
  exit 1
fi

DEST="$NGINX_ROOT/$FILENAME"
echo "📍 检测到 nginx 静态根目录: $NGINX_ROOT"
echo "📍 目标文件: $DEST"
echo ""

# 3. 复制并设置权限
sudo cp "$SRC" "$DEST"
sudo chmod 644 "$DEST"
echo "✅ 文件已复制并设置权限"

# 4. 校验 nginx 配置 + 重载
if command -v nginx >/dev/null 2>&1; then
  echo "🔍 nginx -t 配置校验..."
  if sudo nginx -t; then
    sudo nginx -s reload
    echo "✅ nginx 已重载"
  else
    echo "⚠️  nginx 配置校验失败，但文件已部署到位，请手动 nginx -t && nginx -s reload"
  fi
else
  echo "⚠️  未找到 nginx 命令，可能用 docker 部署。文件已复制到 $DEST"
  echo "   如是 Docker 部署，请手动重启 nginx 容器：docker restart <nginx_container>"
fi

echo ""
echo "🎉 部署完成！"
echo ""
echo "🌐 访问地址: https://wework.syzs.top/$FILENAME"
echo "📊 线索承接：表单提交后写入 tenant_id=10010（中数云科）的 CRM"
echo "   查看线索: https://wework.syzs.top/app/customers?source=抖音落地页"
echo ""
echo "📋 巨量引擎投流配置："
echo "   1. 巨量引擎后台 → 新建广告 → 落地页选「外部链接」"
echo "   2. 填入 URL: https://wework.syzs.top/$FILENAME?utm_source=douyin&utm_medium=infofeed"
echo "   3. 在「转化中心 → 落地页」创建转化，把转化ID填入 HTML 顶部 CONFIG.bdConvId"
