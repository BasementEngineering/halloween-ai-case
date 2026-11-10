"""Warden III launcher icon and splash: the containment hexagon from public/standby/emblem.svg,
in the app's red, glowing on near-black.

    python scripts/make-icon.py            (from app/, needs Pillow: pip install pillow)
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

RED = (255, 42, 42)
BG = (11, 11, 14)
SS = 4  # supersampling


def hexagon(cx, cy, r):
    return [(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))) for a in range(-90, 270, 60)]


def draw_emblem(size, scale):
    """Red emblem lines on a transparent layer; `scale` = emblem radius as a share of the size."""
    S = size * SS
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    c = S / 2
    R = S * scale
    w = max(2, round(R * 0.075))
    d.polygon(hexagon(c, c, R), outline=RED, width=w)
    inner = hexagon(c, c, R * 0.78)
    d.polygon(inner, outline=RED + (150,), width=max(1, w // 3))
    eye = R * 0.40
    d.ellipse([c - eye, c - eye, c + eye, c + eye], outline=RED, width=w)
    pupil = R * 0.13
    d.ellipse([c - pupil, c - pupil, c + pupil, c + pupil], fill=RED)
    for angle in (-90, 30, 150):  # spokes from the eye to the inner hexagon
        a = math.radians(angle)
        d.line([(c + eye * math.cos(a), c + eye * math.sin(a)), (c + R * 0.70 * math.cos(a), c + R * 0.70 * math.sin(a))], fill=RED, width=w)
    return layer


def render(size, scale, background=True, shape="square"):
    lines = draw_emblem(size, scale)
    glow = lines.filter(ImageFilter.GaussianBlur(size * SS * 0.03))
    img = Image.new("RGBA", lines.size, BG + (255,) if background else (0, 0, 0, 0))
    if background:  # faint red vignette in the middle
        vignette = Image.new("RGBA", lines.size, (0, 0, 0, 0))
        S = lines.size[0]
        ImageDraw.Draw(vignette).ellipse([S * 0.15, S * 0.15, S * 0.85, S * 0.85], fill=(90, 13, 13, 120))
        img = Image.alpha_composite(img, vignette.filter(ImageFilter.GaussianBlur(S * 0.12)))
    img = Image.alpha_composite(img, glow)
    img = Image.alpha_composite(img, glow)
    img = Image.alpha_composite(img, lines)
    if shape != "square":
        S = lines.size[0]
        mask = Image.new("L", lines.size, 0)
        if shape == "round":
            ImageDraw.Draw(mask).ellipse([0, 0, S - 1, S - 1], fill=255)
        else:  # rounded square for the legacy icon
            ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=S * 0.18, fill=255)
        img.putalpha(mask)
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    res = os.path.join(os.path.dirname(__file__), "..", "android", "app", "src", "main", "res")
    legacy = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for density, px in legacy.items():
        folder = os.path.join(res, f"mipmap-{density}")
        render(px, 0.34, shape="rounded").save(os.path.join(folder, "ic_launcher.png"))
        render(px, 0.34, shape="round").save(os.path.join(folder, "ic_launcher_round.png"))
        # Adaptive foreground: 108dp canvas, the launcher shows the middle 66-72dp.
        render(px * 108 // 48, 0.22, background=False).save(os.path.join(folder, "ic_launcher_foreground.png"))
    # Splash screens: the emblem centred on the dark background, sizes kept from Capacitor.
    for folder in sorted(os.listdir(res)):
        path = os.path.join(res, folder, "splash.png")
        if not os.path.exists(path):
            continue
        w, h = Image.open(path).size
        side = min(w, h) // 2
        mark = render(side, 0.36, background=False)
        out = Image.new("RGB", (w, h), BG)
        out.paste(mark, ((w - side) // 2, (h - side) // 2), mark)
        out.save(path)
    print("icons and splash screens written")
