#!/bin/bash
# ECS 落地页部署脚本
# 用法: 在 ECS 上执行此脚本，将最新的 product-landing.html 部署到 Nginx 静态目录

set -e

SRC="/var/www/wework-saas/docs/promo/product-landing.html"
DEST="/var/www/wework/landing.html"

echo "=== 部署落地页到 Nginx ==="
echo "源文件: $SRC"
echo "目标:   $DEST"

if [ ! -f "$SRC" ]; then
  echo "⚠️  源文件不存在，请先更新 wework-saas 仓库: cd /var/www/wework-saas && git pull"
  exit 1
fi

cp "$SRC" "$DEST"
echo "✅ 文件已复制"

# 确保 Nginx 可读
chmod 644 "$DEST"

# 重载 Nginx
nginx -t && nginx -s reload
echo "✅ Nginx 已重载"

echo ""
echo "🎉 部署完成！访问地址: https://wework.syzs.top/landing.html"
echo ""
echo "📋 用户填表后，在 CRM 客户列表查看线索: https://wework.syzs.top/app/customers"
echo "   来源标记为「落地页留资」，阶段为「新线索」"
