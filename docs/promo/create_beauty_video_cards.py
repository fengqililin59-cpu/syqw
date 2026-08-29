from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 1080, 1920
FONT = "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/86ba2c91f017a3749571a82f2c6d890ac7ffb2fb.asset/AssetData/PingFang.ttc"
OUTPUT = Path(__file__).parent / "beauty_video_cards"
QR = Path("/Users/591464076qq.com/Pictures/企业微信二维码50789908-75c0-4eca-a314-79b44a6fdfc2_副本.png")

def font(size): return ImageFont.truetype(FONT, size, index=0)
def centered(draw, text, y, size, color):
    current = font(size); box = draw.textbbox((0, 0), text, font=current)
    draw.text(((WIDTH - (box[2] - box[0])) / 2, y), text, font=current, fill=color)
def header_card(name, lines):
    image = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0)); draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, WIDTH, 590), fill=(8, 26, 53, 228))
    for text, y, size, color in lines: centered(draw, text, y, size, color)
    image.save(OUTPUT / name)
def end_card():
    image = Image.new("RGBA", (WIDTH, HEIGHT), (8, 26, 53, 255)); draw = ImageDraw.Draw(image)
    centered(draw, "美业门店客户增长系统", 165, 64, "white"); centered(draw, "扫码咨询，领取门店私域方案", 290, 40, (97, 217, 255))
    qr = Image.open(QR).convert("RGBA"); qr.thumbnail((440, 440), Image.Resampling.LANCZOS)
    image.alpha_composite(qr, ((WIDTH - qr.width) // 2, 740))
    centered(draw, "咨询电话 13023668095", 1240, 44, "white"); centered(draw, "杭州中数云科智慧科技有限公司", 1740, 30, (165, 190, 214))
    image.convert("RGB").save(OUTPUT / "end.png", quality=96)

OUTPUT.mkdir(exist_ok=True)
header_card("pain.png", [("美业老板，你是否也遇到这些问题？", 105, 52, "white"), ("客户资料散落在员工微信里", 195, 38, (189, 231, 255))])
header_card("ai.png", [("不用再靠记忆跟进客户", 118, 66, "white"), ("AI 一键生成专业跟进话术", 230, 43, (97, 217, 255)), ("新人也能快速开口、持续跟进", 320, 34, (215, 231, 247))])
header_card("profile.png", [("客户画像、跟进记录，统一沉淀", 118, 57, "white"), ("咨询 · 到店 · 成交 · 复购", 235, 48, (97, 217, 255)), ("每一步都看得见、接得住", 325, 36, (215, 231, 247))])
header_card("enterprise.png", [("把客户留在企业，不留在个人微信", 125, 52, "white"), ("企微私域营销管家", 250, 58, (97, 217, 255))])
end_card()
