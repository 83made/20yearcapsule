# Builds the icon set from the capsule logo.
#
#   python scripts/make-icons.py
#   ICON_PREVIEW_DIR=/some/dir python scripts/make-icons.py   # also writes a legibility sheet
#
# Source of truth is assets/logo-capsule.png: a time capsule half buried in soil with "20" on its
# body, on a transparent background. Everything in public/ is derived from it, so the logo has one
# home and the icons cannot drift away from it. Do not hand-edit the outputs.
#
# WHY TRANSPARENT MATTERS. The first cut of this logo came enclosed in a pale disc. Dropping the
# disc makes the mark free-standing, and because the padding went with it the "20" grew from 22%
# to 30% of the mark's height — about 11.9px on a 40px feed avatar rather than 8.6px. The capsule
# body is painted cream rather than left transparent, so the mark still reads on a dark backdrop.
#
# WHY THE CROP IS MEASURED, NOT CHOSEN. The crop comes from the alpha channel: the bounding box of
# everything visible, squared around its centre with a little air. Cropping harder was tried and
# rejected — at 0.62 of the frame the "20" gets bigger, but the dome and carry handle fall outside
# and the thing reads as a barrel. The silhouette is what identifies this mark at small sizes, so
# the silhouette is what gets protected.
#
# The "20" is still not crisply legible at feed size. That is inherent to the illustration and no
# crop fixes it. A pale cylinder standing in dark soil is a distinctive enough shape to carry an
# avatar on its own.

import io
import os
import struct

import numpy as np
from PIL import Image, ImageDraw, ImageFont

PAPER = (244, 241, 232)   # #f4f1e8, the site background
INK   = (18, 16, 12)      # #12100c

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(ROOT, "assets", "logo-capsule.png")
OUT  = os.path.join(ROOT, "public")
PREVIEW = os.environ.get("ICON_PREVIEW_DIR")

AIR = 1.06   # breathing room around the artwork so it is not jammed against the edges


def square_crop(im, cx, cy, half, fill):
    """Square crop centred on (cx, cy), padded rather than clipped if it runs off the canvas."""
    w, h = im.size
    box = (max(0, cx - half), max(0, cy - half), min(w, cx + half), min(h, cy + half))
    out = Image.new("RGBA", (2 * half, 2 * half), fill)
    out.paste(im.crop(box), (max(0, half - cx), max(0, half - cy)))
    return out


src = Image.open(SRC).convert("RGBA")
alpha = np.asarray(src)[:, :, 3]
ys, xs = np.where(alpha > 8)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
half = int(max(x1 - x0, y1 - y0) / 2 * AIR)

mark_rgba = square_crop(src, cx, cy, half, (0, 0, 0, 0))          # transparent
mark = Image.new("RGBA", mark_rgba.size, PAPER + (255,))
mark.alpha_composite(mark_rgba)
mark = mark.convert("RGB")                                        # on brand cream

print(f"  artwork {x1-x0}x{y1-y0} at ({cx},{cy}) -> square crop {2*half}px\n")

os.makedirs(OUT, exist_ok=True)
made = []


def save(img, name, size, quantize=False):
    """quantize: the logo is flat line art, so a 256-colour palette is visually identical at a
    fraction of the size. Used only where the file is big enough for it to matter."""
    p = os.path.join(OUT, name)
    out = img.resize((size, size), Image.LANCZOS)
    if quantize:
        out = out.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.NONE)
    out.save(p, optimize=True)
    made.append((name, os.path.getsize(p)))


save(mark, "profile-1024.png", 1024, quantize=True)   # social avatars
save(mark, "apple-touch-icon.png", 180)               # iOS home screen; must be opaque
save(mark, "icon-192.png", 192)
save(mark, "icon-512.png", 512, quantize=True)
save(mark, "favicon-32.png", 32)
save(mark, "favicon-16.png", 16)

def save_transparent(name, size, colors=128):
    """Transparent PNG, palette-quantised.

    The logo is flat line art in roughly 74 distinct colours, so an octree palette is visually
    lossless — measured at 1.59/255 mean channel difference — while cutting a 900px export from
    472KB to 44KB. That matters for the hero image, which loads above the fold. Octree is used
    because it is the only Pillow method that handles an alpha channel.
    """
    p = os.path.join(OUT, name)
    img = mark_rgba.resize((size, size), Image.LANCZOS)
    img.quantize(colors=colors, method=Image.FASTOCTREE).save(p, optimize=True)
    made.append((name, os.path.getsize(p)))


save_transparent("logo-hero.png", 900)            # the hero illustration
save_transparent("logo-mark-1024.png", 1024, 256)  # transparent master: video, merch, print


def build_ico(path, sizes):
    """Write the .ico with PNG-compressed entries.

    Pillow stores ICO frames as uncompressed BMP, which made this file 104KB. Browsers fetch
    /favicon.ico on essentially every visit, so that was 104KB of waste on a page whose entire
    bundle is smaller. PNG-compressed entries are valid in ICO on Vista and later, which covers
    every browser in use. Only 16/32/48 are carried: the larger slots exist for Windows desktop
    shortcuts, which nobody is going to make of this.
    """
    blobs = []
    for size in sizes:
        buf = io.BytesIO()
        mark.resize((size, size), Image.LANCZOS).save(buf, format="PNG", optimize=True)
        blobs.append((size, buf.getvalue()))

    offset = 6 + 16 * len(blobs)
    directory, data = b"", b""
    for size, blob in blobs:
        directory += struct.pack("<BBBBHHII", size, size, 0, 0, 1, 32, len(blob), offset)
        offset += len(blob)
        data += blob
    with open(path, "wb") as fh:
        fh.write(struct.pack("<HHH", 0, 1, len(blobs)) + directory + data)


ico = os.path.join(OUT, "favicon.ico")
build_ico(ico, (16, 32, 48))
made.append(("favicon.ico", os.path.getsize(ico)))

for n, s in sorted(made):
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
    out = os.path.join(PREVIEW, "icon-legibility-preview.png")
    sheet.save(out)
    print("\n  legibility preview ->", out)
