from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 1080, 1920
FONT = "/System/Library/AssetsV2/com_apple_MobileAsset_Font8/86ba2c91f017a3749571a82f2c6d890ac7ffb2fb.asset/AssetData/PingFang.ttc"
QR = Path("/Users/591464076qq.com/Pictures/企业微信二维码50789908-75c0-4eca-a314-79b44a6fdfc2_副本.png")
ROOT = Path(__file__).parent / "five_pain_cards"

VIDEOS = [
    ("01_沉睡客唤醒", "沉睡客唤醒", "90 天没到店的顾客，怎么重新约回来？", "回复「睡客」领取《沉睡客唤醒 SOP》", "识别沉睡顾客，定时提醒回访", "AI 一键生成唤醒话术", "不再让老顾客悄悄流失"),
    ("02_员工离职交接", "离职客户交接", "员工离职，顾客资料还在她手机里吗？", "回复「交接」领取《客户交接 SOP》", "客户资料与跟进记录，统一沉淀", "离职交接不再靠翻聊天记录", "把客户资产真正留在门店"),
    ("03_新客七天转化", "新客七天转化", "新客加了微信后，三天不回就丢了吗？", "回复「新客」领取《新客 7 天转化 SOP》", "新客分层跟进，关键节点不遗漏", "AI 生成首聊与邀约话术", "让每一个咨询都有下一步"),
    ("04_到店后复购", "到店后复购", "顾客做完项目后，谁在持续跟进？", "回复「复购」领取《到店后复购 SOP》", "到店记录、需求与下次回访一目了然", "AI 帮员工持续跟进", "把一次到店变成长期复购"),
    ("05_预约到店", "预约到店", "顾客说“改天来”，如何真正约到店？", "回复「预约」领取《预约到店 SOP》", "高意向顾客自动进入重点跟进", "AI 生成到店邀约话术", "让意向不再停在聊天框里"),
]

def get_font(size): return ImageFont.truetype(FONT, size, index=0)
def write_center(draw, text, y, size, color):
    f = get_font(size); b = draw.textbbox((0, 0), text, font=f)
    draw.text(((WIDTH - (b[2] - b[0])) / 2, y), text, font=f, fill=color)
def header(path, rows):
    image = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0)); draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, WIDTH, 590), fill=(8, 26, 53, 228))
    for row in rows: write_center(draw, *row)
    image.save(path)
def end(path, title, cta):
    image = Image.new("RGBA", (WIDTH, HEIGHT), (8, 26, 53, 255)); draw = ImageDraw.Draw(image)
    write_center(draw, title, 165, 64, "white"); write_center(draw, cta, 290, 38, (97, 217, 255))
    qr = Image.open(QR).convert("RGBA"); qr.thumbnail((440, 440), Image.Resampling.LANCZOS)
    image.alpha_composite(qr, ((WIDTH - qr.width) // 2, 740))
    write_center(draw, "咨询电话 13023668095", 1240, 44, "white")
    write_center(draw, "杭州中数云科智慧科技有限公司", 1740, 30, (165, 190, 214))
    image.convert("RGB").save(path, quality=96)

for folder, title, hook, cta, ai_title, ai_subtitle, ai_note in VIDEOS:
    output = ROOT / folder; output.mkdir(parents=True, exist_ok=True)
    header(output / "pain.png", [(hook, 105, 49, "white"), ("扫码添加企微，免费领取门店 SOP", 205, 36, (189, 231, 255))])
    header(output / "ai.png", [(ai_title, 118, 54, "white"), (ai_subtitle, 230, 40, (97, 217, 255)), (ai_note, 320, 34, (215, 231, 247))])
    header(output / "profile.png", [("客户画像、跟进记录，统一沉淀", 118, 57, "white"), ("咨询 · 到店 · 成交 · 复购", 235, 48, (97, 217, 255)), ("每一步都看得见、接得住", 325, 36, (215, 231, 247))])
    header(output / "enterprise.png", [("把客户留在企业，不留在个人微信", 125, 52, "white"), ("企微私域营销管家", 250, 58, (97, 217, 255))])
    end(output / "end.png", title, cta)
