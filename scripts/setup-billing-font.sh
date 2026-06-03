#!/usr/bin/env bash
# 下载或指引配置账单 PDF 中文字体（不提交大二进制到 git）。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/backend/assets/fonts/NotoSansSC-Regular.otf"
mkdir -p "$(dirname "$DEST")"

if [[ -f "$DEST" ]]; then
  echo "OK: 字体已存在 $DEST"
  echo "可选：在 backend/.env 设置 BILLING_PDF_FONT_PATH=$DEST"
  exit 0
fi

NOTO_URL="https://github.com/notofonts/noto-cjk/raw/main/Sans/OTF/SimplifiedChinese/NotoSansSC-Regular.otf"

if command -v curl >/dev/null 2>&1; then
  echo "正在下载 Noto Sans SC Regular …"
  if curl -fsSL --retry 2 -o "$DEST" "$NOTO_URL"; then
    echo "OK: 已保存到 $DEST"
    echo "建议在 backend/.env 添加：BILLING_PDF_FONT_PATH=$DEST"
    exit 0
  fi
  rm -f "$DEST"
fi

echo "未能自动下载字体。请任选其一："
echo "  1) 手动下载 $NOTO_URL 并保存为 $DEST"
echo "  2) Linux: apt install fonts-noto-cjk，.env 设 BILLING_PDF_FONT_PATH=/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
echo "  3) macOS: .env 设 BILLING_PDF_FONT_PATH=/System/Library/Fonts/PingFang.ttc"
echo "详见 backend/assets/fonts/README.md"
exit 1
