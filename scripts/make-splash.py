"""生成 Android 启动图（深色背景 + 居中图标），覆盖 drawable-* 下的 splash.png。"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android" / "app" / "src" / "main" / "res"
BG = (255, 255, 255)
LIME_TOP = (255, 255, 255)
LIME_BOTTOM = (245, 245, 247)
INK = (250, 45, 72)

if not RES.exists():
    print("android res 不存在，跳过")
    raise SystemExit(0)


def vertical_gradient(size, top, bottom):
    img = Image.new("RGB", (1, size), top)
    px = img.load()
    for y in range(size):
        t = y / max(1, size - 1)
        px[0, y] = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return img.resize((size, size), Image.BILINEAR)


def app_icon(size):
    grad = vertical_gradient(size, LIME_TOP, LIME_BOTTOM)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.225), fill=255)
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    icon.paste(grad, (0, 0), mask)

    d = ImageDraw.Draw(icon)
    s = size * 0.5
    cx = cy = size / 2
    left, right = cx - s / 2, cx + s / 2
    top, bottom = cy - s / 2, cy + s / 2
    stroke = max(2, int(s * 0.16))
    pts = [
        (left, bottom),
        (left, top),
        (cx, cy + s * 0.1),
        (right - s * 0.28, top),
        (right - s * 0.28, bottom),
    ]
    d.line(pts, fill=INK, width=stroke, joint="curve")
    for px, py in (pts[0], pts[-1], pts[1]):
        r = stroke / 2
        d.ellipse((px - r, py - r, px + r, py + r), fill=INK)
    plus_x, plus_y = right + s * 0.04, top + s * 0.04
    half = s * 0.13
    bar = max(2, int(stroke * 0.62))
    d.line([(plus_x - half, plus_y), (plus_x + half, plus_y)], fill=INK, width=bar)
    d.line([(plus_x, plus_y - half), (plus_x, plus_y + half)], fill=INK, width=bar)
    return icon


def make_splash(w, h):
    """透明背景 + 居中图标：底色交给 Android 主题（自动适配明暗）"""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    icon_size = int(min(w, h) * 0.24)
    icon = app_icon(icon_size)
    img.alpha_composite(icon, (int((w - icon_size) / 2), int(h * 0.44)))
    return img


# 标准 drawable
(RES / "drawable").mkdir(parents=True, exist_ok=True)
make_splash(480, 320).save(RES / "drawable" / "splash.png")

SIZES = {
    "drawable-port-mdpi": (320, 480),
    "drawable-port-hdpi": (480, 800),
    "drawable-port-xhdpi": (720, 1280),
    "drawable-port-xxhdpi": (960, 1600),
    "drawable-port-xxxhdpi": (1280, 1920),
    "drawable-land-mdpi": (480, 320),
    "drawable-land-hdpi": (800, 480),
    "drawable-land-xhdpi": (1280, 720),
    "drawable-land-xxhdpi": (1600, 960),
    "drawable-land-xxxhdpi": (1920, 1280),
}

for folder, (w, h) in SIZES.items():
    target = RES / folder
    target.mkdir(parents=True, exist_ok=True)
    make_splash(w, h).save(target / "splash.png")

print("splash 已生成", len(SIZES) + 1, "张")
