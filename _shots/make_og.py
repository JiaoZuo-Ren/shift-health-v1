# -*- coding: utf-8 -*-
"""生成 Open Graph 分享缩略图 og-preview.png (1200x630)"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
im = Image.new('RGBA', (W, H))
draw = ImageDraw.Draw(im)

# 深绿渐变背景（与分享卡片同色系）
top = (22, 53, 42)   # #16352a
bot = (47, 133, 90)  # #2f855a
for y in range(H):
    t = y / (H - 1)
    c = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
    draw.line([(0, y), (W, y)], fill=c + (255,))


def load_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return None


font_title = load_font('C:/Windows/Fonts/msyhbd.ttc', 92) or load_font('C:/Windows/Fonts/msyh.ttc', 92)
font_sub = load_font('C:/Windows/Fonts/msyh.ttc', 42)
font_chip = load_font('C:/Windows/Fonts/msyh.ttc', 36)
font_foot = load_font('C:/Windows/Fonts/msyh.ttc', 30)


def tw(txt, f):
    try:
        return draw.textlength(txt, font=f)
    except AttributeError:
        b = f.getbbox(txt)
        return b[2] - b[0]


# 主标题
draw.text((84, 140), '今日活动建议', font=font_title, fill=(255, 255, 255))
# 副标题
draw.text((88, 292), '久坐人群的数据翻译 · 固定规则判断 · 不接 AI', font=font_sub, fill=(224, 238, 230))

# 四个指标小胶囊
chips = ['久坐', '睡眠', '心率', '步数']
cx = 88
chip_h = 92
for ch in chips:
    w = int(tw(ch, font_chip)) + 64
    draw.rounded_rectangle([cx, 404, cx + w, 404 + chip_h], radius=46, fill=(255, 255, 255, 46))
    draw.text((cx + 32, 404 + (chip_h - 52) // 2), ch, font=font_chip, fill=(255, 255, 255))
    cx += w + 26

# 底部小字
draw.text((88, 560), '输入今天的数据，告诉你今天该做什么、不该做什么', font=font_foot, fill=(200, 222, 210))

im.convert('RGB').save('C:/Users/21793/Desktop/shift-health/og-preview.png')
print('saved og-preview.png')
