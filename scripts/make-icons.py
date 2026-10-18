"""生成 Music++ / MusicPP 的 Android 图标与启动图（Pillow 实现）。"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android" / "app" / "src" / "main" / "res"
RESOURCES = ROOT / "resources"
RESOURCES.mkdir(exist_ok=True)

LIME_TOP = (255, 255, 255)
LIME_BOTTOM = (245, 245, 247)
INK = (250, 45, 72)


def vertical_gradient(size, top, bottom):
    img = Image.new("RGB", (1, size), top)
    px = img.load()
    for y in range(size):
        t = y / max(1, size - 1)
        px[0, y] = (
            int(top[0] + (bottom[0] - top[0]) * t),
            int(top[1] + (bottom[1] - top[1]) * t),
            int(top[2] + (bottom[2] - top[2]) * t),
        )
    return img.resize((size, size), Image.BILINEAR)


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def draw_glyph(img, scale=1.0, offset=(0, 0), color=INK, center=True):
    """在图像中央绘制 M 与 + 符号"""
    w, h = img.size
    d = ImageDraw.Draw(img)
    s = min(w, h) * 0.5 * scale
    cx, cy = w / 2 + offset[0], h / 2 + offset[1]
    left, right = cx - s / 2, cx + s / 2
    top, bottom = cy - s / 2, cy + s / 2
    stroke = max(2, int(s * 0.16))

    m_points = [
        (left, bottom),
        (left, top),
        (cx, cy + s * 0.1),
        (right - s * 0.28, top),
        (right - s * 0.28, bottom),
    ]
    d.line(m_points, fill=color, width=stroke, joint="curve")
    # 端点圆头
    for px, py in (m_points[0], m_points[-1], m_points[1]):
        r = stroke / 2
        d.ellipse((px - r, py - r, px + r, py + r), fill=color)

    # 右上角 +
    plus_x, plus_y = right + s * 0.04, top + s * 0.04
    half = s * 0.13
    bar = max(2, int(stroke * 0.62))
    d.line([(plus_x - half, plus_y), (plus_x + half, plus_y)], fill=color, width=bar)
    d.line([(plus_x, plus_y - half), (plus_x, plus_y + half)], fill=color, width=bar)
    return img


def make_icon(size, round_icon=False):
    grad = vertical_gradient(size, LIME_TOP, LIME_BOTTOM)
    if round_icon:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    else:
        mask = rounded_mask(size, int(size * 0.225))
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    icon.paste(grad, (0, 0), mask)
    draw_glyph(icon, scale=1.0)
    return icon


def make_foreground(size, round_icon=False):
    """自适应图标前景：透明底 + 居中符号（安全区内）"""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw_glyph(img, scale=0.72)
    return img


DENSITIES = {
    "mdpi": 1,
    "hdpi": 1.5,
    "xhdpi": 2,
    "xxhdpi": 3,
    "xxxhdpi": 4,
}

LEGACY = 48
ADAPTIVE = 108

if RES.exists():
    for density, factor in DENSITIES.items():
        folder = RES / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        size = int(LEGACY * factor)
        make_icon(size).save(folder / "ic_launcher.png")
        make_icon(size, round_icon=True).save(folder / "ic_launcher_round.png")
        fg_size = int(ADAPTIVE * factor)
        make_foreground(fg_size).save(folder / "ic_launcher_foreground.png")
    print("android mipmaps written ->", RES)
else:
    print("android res 不存在，跳过（先执行 npx cap add android）")

# 通用资源
make_icon(1024).save(RESOURCES / "icon.png")
make_icon(1024).save(RESOURCES / "icon-only.png")
make_icon(512, round_icon=True).save(RESOURCES / "icon-round.png")
print("resources written ->", RESOURCES)
