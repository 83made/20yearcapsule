# Builds the icon set from the capsule logo.
#
# Source is the commissioned illustration at assets/logo-capsule.png: a time capsule half buried
# in soil, "20" on its body. Everything below is derived from it, so the logo has one home.
#
# WHY IT IS CROPPED. The original carries a band of empty cream around the artwork, which is
# right for a poster and wasteful for an avatar rendered at about 40px in a feed. The crop is
# measured from the drawing itself — the bounding box of every dark and red pixel, squared off
# around its centre with a little air — rather than a guessed ratio.
#
# Cropping harder was tried and rejected. At 0.62 of the frame the "20" gets noticeably bigger,
# but the dome and the carry handle fall outside the frame and the thing stops reading as a
# capsule at all; it becomes a barrel. The silhouette is what identifies this mark at small
# sizes, not the numerals, so the silhouette is what gets protected.
#
# Accept that the "20" is not legible at feed size. That is inherent to the illustration, and the
# fix is not a tighter crop, it is that a pale cylinder standing in dark soil is a distinctive
# enough shape to work as an avatar on its own.
#
# The canvas is also renormalised to the exact brand cream. The generator returned (250,247,237)
# and the site is (244,241,232) — invisible alone, obvious when the avatar sits beside the page.

import io
import os
import struct
import numpy as np
from PIL import Image, ImageDraw, ImageFont

PAPER = (244, 241, 232)   # #f4f1e8
INK   = (18, 16, 12)      # #12100c

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, "assets", "logo-capsule.png")
OUT  = os.path.join(ROOT, "public")
PREVIEW = os.environ.get("ICON_PREVIEW_DIR")

AIR = 1.06   # a little breathing room around the artwork, so it is not jammed to the edges


def load_normalised():
    im = Image.open(SRC).convert("RGB")
    a = np.asarray(im).astype(int)
    corner = a[:40, :40].reshape(-1, 3).mean(0)
    a[np.abs(a - corner).sum(2) < 12] = PAPER      # snap the canvas to brand cream
    return Image.fromarray(a.astype(np.uint8)), a


def artwork_box(a):
    """Bounding box of the drawing, ignoring the pale disc it sits on.

    Dark linework plus the red numerals. The disc is background: including it would just
    re-measure the canvas and defeat the point.
    """
    ink = (a.sum(2) < 330) | ((a[:, :, 0] > 110) & (a[:, :, 1] < 95) & (a[:, :, 2] < 85))
    ys, xs = np.where(ink)
    return xs.min(), ys.min(), xs.max(), ys.max()


def square_crop(im, cx, cy, half):
    w, h = im.size
    box = (max(0, cx - half), max(0, cy - half), min(w, cx + half), min(h, cy + half))
    out = Image.new("RGB", (2 * half, 2 * half), PAPER)
    out.paste(im.crop(box), (max(0, half - cx), max(0, half - cy)))
    return out


im, arr = load_normalised()
x0, y0, x1, y1 = artwork_box(arr)
cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
half = int(max(x1 - x0, y1 - y0) / 2 * AIR)
mark = square_crop(im, cx, cy, half)
print(f"  artwork {x1-x0}x{y1-y0} at ({cx},{cy}) -> square crop {2*half}px\n")

os.makedirs(OUT, exist_ok=True)
made = []


def save(name, size, quantize=False):
    """quantize: the logo is flat cream/black/red line art, so a 256-colour palette is visually
    identical and roughly a fifth the size. Only used where the file is large enough to matter."""
    p = os.path.join(OUT, name)
    img = mark.resize((size, size), Image.LANCZOS)
    if quantize:
        img = img.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.NONE)
    img.save(p, optimize=True)
    made.append((name, os.path.getsize(p)))


save("profile-1024.png", 1024, quantize=True)   # social avatars
save("apple-touch-icon.png", 180)   # iOS home screen; must be opaque
save("icon-192.png", 192)
save("icon-512.png", 512, quantize=True)

def build_ico(path, sizes):
    """Write the .ico with PNG-compressed entries.

    Pillow stores ICO frames as uncompressed BMP, which made this file 104KB. Browsers fetch
    /favicon.ico on essentially every visit, so that is 104KB of pure waste on a page whose whole
    bundle is smaller. PNG-compressed entries are valid in ICO on Vista and later, which covers
    every browser in use. Only 16/32/48 are included: the larger slots existed for Windows
    desktop shortcuts, which is not a thing anyone will do with this.
    """
    blobs = []
    for size in sizes:
        buf = io.BytesIO()
        mark.resize((size, size), Image.LANCZOS).save(buf, format="PNG", optimize=True)
        blobs.append((size, buf.getvalue()))

    offset = 6 + 16 * len(blobs)
    directory = b""
    data = b""
    for size, blob in blobs:
        directory += struct.pack("<BBBBHHII", size, size, 0, 0, 1, 32, len(blob), offset)
        offset += len(blob)
        data += blob
    with open(path, "wb") as fh:
        fh.write(struct.pack("<HHH", 0, 1, len(blobs)) + directory + data)


ico = os.path.join(OUT, "favicon.ico")
build_ico(ico, (16, 32, 48))
made.append(("favicon.ico", os.path.getsize(ico)))

# A raster favicon is referenced as PNG rather than SVG: the logo is an illustration with fine
# linework, and there is no faithful vector of it. Better an honest PNG than a bad trace.
save("favicon-32.png", 32)
save("favicon-16.png", 16)

for n, s in made:
    print(f"  {n:<24} {s/1024:7.1f} KB")

if PREVIEW:
    sizes = (16, 32, 48, 64, 128)
    cell = 128
    sheet = Image.new("RGB", (20 + len(sizes) * (cell + 16), 200), PAPER)
    d = ImageDraw.Draw(sheet)
    f = ImageFont.truetype(r"C:\Windows\Fonts\cambriab.ttf", 20)
    x = 20
    for s in sizes:
        sheet.paste(mark.resize((s, s), Image.LANCZOS).resize((cell, cell), Image.NEAREST), (x, 20))
        d.text((x, 158), f"{s}px", fill=INK, font=f)
        x += cell + 16
    p = os.path.join(PREVIEW, "icon-legibility-preview.png")
    sheet.save(p)
    print("\n  legibility preview ->", p)
