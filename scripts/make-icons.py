# Builds the 20 Year Capsule wax-seal mark and the full icon set.
#
# Drawn as geometry rather than generated as an image: the brand hex values come out exact, the
# output is reproducible, and every size is downsampled from one 4096px master instead of being
# re-imagined at each size.
#
# OPTICAL SIZING. Two cuts of the same mark, because one drawing cannot serve both ends:
#
#   display  — wax body + a lighter pressed ring + modest numerals. The ring is what makes it
#              read as wax rather than a red sticker, and it has room to breathe at 180px+.
#   tiny     — no ring, numerals enlarged to fill the wax. Tested at 16px: with the ring, "20"
#              mushes into an unreadable smear; without it, it still reads. The ring was the
#              problem, not the type size.
#
# 16px is the browser tab. If it fails there it fails where people see it most.

import math, os, struct, io as _io
from PIL import Image, ImageDraw, ImageFont

PAPER = (244, 241, 232)   # #f4f1e8
INK   = (18, 16, 12)      # #12100c
SEAL  = (164, 31, 19)     # #a41f13
SEAL2 = (200, 52, 31)     # #c8341f

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(ROOT, "public")
SCR  = os.environ.get("ICON_PREVIEW_DIR", OUT)
M    = 4096

# A bold serif with heavy numerals. First one present wins.
FONT = next(
    (p for p in (
        r"C:\Windows\Fonts\cambriab.ttf",
        r"C:\Windows\Fonts\georgiab.ttf",
        r"C:\Windows\Fonts\constanb.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
    ) if os.path.exists(p)),
    None,
)
if FONT is None:
    raise SystemExit("No bold serif font found - set FONT manually.")


def wax_polygon(cx, cy, r, points=720, wobble=0.007):
    """A circle with a gentle irregular edge, the way pressed wax spreads.

    Deterministic — fixed harmonics, no RNG — so regenerating produces identical output and the
    favicon cannot silently change shape between builds. The wobble is deliberately small: at
    0.018 it read as an amoeba, and any bulge gets sliced off by the circular avatar crop.
    """
    pts = []
    for i in range(points):
        a = 2 * math.pi * i / points
        d = (math.sin(a * 3 + 0.7) * 1.00
             + math.sin(a * 5 + 2.1) * 0.55
             + math.sin(a * 7 + 4.3) * 0.30
             + math.sin(a * 11 + 1.2) * 0.15)
        rr = r * (1 + wobble * d)
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return pts


def render(ring=True, diameter=0.76, text=0.32):
    img = Image.new("RGB", (M, M), PAPER)
    d = ImageDraw.Draw(img)
    c = M / 2
    r = M * diameter / 2

    d.polygon(wax_polygon(c, c, r), fill=SEAL)

    if ring:
        # Same wobble as the outer edge so the curves stay parallel. With different values the
        # ring drifts toward the rim on one side and reads as a printing error.
        rg = wax_polygon(c, c, r * 0.84)
        d.line(rg + [rg[0]], fill=SEAL2, width=int(M * 0.016), joint="curve")

    # Cream on red, not a tonal deboss: a tonal deboss disappears entirely below about 48px.
    f = ImageFont.truetype(FONT, int(M * text))
    b = d.textbbox((0, 0), "20", font=f)
    d.text((c - (b[2] - b[0]) / 2 - b[0], c - (b[3] - b[1]) / 2 - b[1]), "20", font=f, fill=PAPER)
    return img


display = render(ring=True,  diameter=0.76, text=0.32)
tiny    = render(ring=False, diameter=0.86, text=0.50)

os.makedirs(OUT, exist_ok=True)
made = []


def save(img, name, size):
    p = os.path.join(OUT, name)
    img.resize((size, size), Image.LANCZOS).save(p)
    made.append((name, os.path.getsize(p)))


save(display, "profile-1024.png", 1024)   # social avatars
save(display, "apple-touch-icon.png", 180)  # iOS home screen; must be opaque
save(display, "icon-192.png", 192)
save(display, "icon-512.png", 512)


def build_ico(path, entries):
    """Write a multi-resolution .ico with a DIFFERENT image per size.

    Pillow's own ICO writer resizes a single source, so it cannot do optical sizing. The format
    is simple enough to emit directly, and PNG-compressed entries are valid in ICO (Vista+),
    which every browser in use today understands.
    """
    blobs = []
    for size, img in entries:
        buf = _io.BytesIO()
        img.resize((size, size), Image.LANCZOS).save(buf, format="PNG", optimize=True)
        blobs.append((size, buf.getvalue()))

    header = struct.pack("<HHH", 0, 1, len(blobs))
    offset = 6 + 16 * len(blobs)
    directory, data = b"", b""
    for size, blob in blobs:
        directory += struct.pack("<BBBBHHII",
                                 size if size < 256 else 0, size if size < 256 else 0,
                                 0, 0, 1, 32, len(blob), offset)
        offset += len(blob)
        data += blob
    with open(path, "wb") as fh:
        fh.write(header + directory + data)


ico = os.path.join(OUT, "favicon.ico")
build_ico(ico, [(16, tiny), (32, tiny), (48, tiny),
                (64, display), (128, display), (256, display)])
made.append(("favicon.ico", os.path.getsize(ico)))

# Vector favicon. Modern browsers prefer this and scale it to whatever they need, so it uses the
# tiny cut — the one that survives 16px — rather than the ringed display cut.
pts = wax_polygon(32, 32, 32 * 0.86, points=96)
path_d = "M " + " L ".join(f"{x:.2f},{y:.2f}" for x, y in pts) + " Z"
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#f4f1e8"/>
  <path d="{path_d}" fill="#a41f13"/>
  <text x="32" y="32" fill="#f4f1e8" font-family="Georgia, 'Times New Roman', serif"
        font-weight="700" font-size="34" text-anchor="middle"
        dominant-baseline="central">20</text>
</svg>
'''
with open(os.path.join(OUT, "favicon.svg"), "w", encoding="utf-8", newline="\n") as fh:
    fh.write(svg)
made.append(("favicon.svg", os.path.getsize(os.path.join(OUT, "favicon.svg"))))

for n, s in made:
    print(f"  {n:<24} {s/1024:7.1f} KB")

# Contact sheet at the sizes people actually see, blown back up with nearest-neighbour so the
# real pixels are visible rather than smoothed over.
sheet = Image.new("RGB", (760, 200), PAPER)
dr = ImageDraw.Draw(sheet)
lf = ImageFont.truetype(FONT, 20)
x = 20
for s in (16, 32, 48, 64, 128):
    src = tiny if s <= 48 else display
    sheet.paste(src.resize((s, s), Image.LANCZOS).resize((128, 128), Image.NEAREST), (x, 20))
    dr.text((x, 158), f"{s}px", fill=INK, font=lf)
    x += 148
sheet.save(os.path.join(SCR, "icon-legibility-preview.png"))
print("\n  legibility preview ->", os.path.join(SCR, "icon-legibility-preview.png"))
