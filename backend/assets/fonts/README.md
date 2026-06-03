# 账单 PDF 中文字体

服务端生成 PDF 需注册 TrueType/OpenType 字体。任选其一：

1. 设置环境变量 `BILLING_PDF_FONT_PATH` 指向 `.ttf` / `.otf` 文件
2. Linux 安装：`apt install fonts-noto-cjk` 后使用  
   `/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc`
3. 将 `NotoSansSC-Regular.otf` 放到本目录并命名为 `NotoSansSC-Regular.otf`

未配置时接口 `format=pdf` 返回 503，仍可使用 `format=html` 浏览器打印。

一键准备（从仓库根目录）：

```bash
chmod +x scripts/setup-billing-font.sh && ./scripts/setup-billing-font.sh
```
