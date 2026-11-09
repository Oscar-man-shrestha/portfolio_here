# Builds public/og.png, the 1200x630 card that LinkedIn, Slack, WhatsApp, X and others show when someone shares a
# link to the site. Same look as the hero: ink background, the red sun, and Oscar's real hero cut-out (frame 0 of the
# hero clip, his photo, used as it is), with his name and role in the site's own fonts.
#
#   python3 tools/og/build.py
#
# Needs Python 3 with Pillow, and the internet (the fonts come from Google Fonts).
import io, json, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630
INK, PAPER, SIGNAL = (9, 9, 10), (236, 236, 230), (255, 46, 76)
content = json.load(open("lib/headturn.json"))


def google_ttf(family, axes):
    """A TrueType file of an OFL Google font at fixed axis values (Google serves TTF to non-browser clients)."""
    import re, urllib.parse, urllib.request
    url = f"https://fonts.googleapis.com/css2?family={urllib.parse.quote(family)}:{axes}"
    css = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/4.0"})).read().decode()
    m = re.search(r"src: url\((https://[^)]+)\) format\('(truetype|opentype)'\)", css)
    if not m:
        raise SystemExit(f"no TrueType file for {family} in {url}")
    return urllib.request.urlopen(m.group(1)).read()


# the site's own fonts (both SIL Open Font License 1.1), at the hero's settings
MONA = {w: google_ttf("Mona Sans", f"wdth,wght@125,{w}") for w in (800, 900)}
MONO = google_ttf("JetBrains Mono", "wght@500")
mona_font = lambda size, wght: ImageFont.truetype(io.BytesIO(MONA[wght]), size)
mono_font = lambda size: ImageFont.truetype(io.BytesIO(MONO), size)


src = open("lib/content.ts").read()
pick = lambda key: src.split(f'{key}: "', 1)[1].split('"', 1)[0]
name, role, base = pick("name"), pick("role"), pick("base")
disciplines = src.split("disciplines: [", 1)[1].split("]", 1)[0].replace('"', "").split(", ")

img = Image.new("RGB", (W, H), INK)
# the red sun, softly lit, behind the portrait
sun = Image.new("L", (W, H), 0)
ImageDraw.Draw(sun).ellipse((700, 70, 1160, 530), fill=255)
glow = sun.filter(ImageFilter.GaussianBlur(60))
img.paste(Image.new("RGB", (W, H), (120, 14, 30)), (0, 0), glow)
img.paste(Image.new("RGB", (W, H), SIGNAL), (0, 0), sun)

# Oscar's real hero cut-out, unchanged, standing on the bottom edge
portrait = Image.open(f"public{content['dir']}/d/00.webp").convert("RGBA")
ph = 600
portrait = portrait.resize((round(portrait.width * ph / portrait.height), ph), Image.LANCZOS)
img.paste(portrait, (930 - portrait.width // 2, H - ph), portrait)

d = ImageDraw.Draw(img)
d.text((64, 64), "PORTFOLIO // 2026", font=mono_font(20), fill=SIGNAL)
first, *rest = name.upper().split(" ")
d.text((58, 120), first[:3], font=mona_font(150, 900), fill=PAPER)
x = 58 + d.textlength(first[:3], font=mona_font(150, 900))
d.text((x, 120), first[3], font=mona_font(150, 900), fill=SIGNAL)  # the red "A", as in the hero
x += d.textlength(first[3], font=mona_font(150, 900))
d.text((x, 120), first[4:], font=mona_font(150, 900), fill=PAPER)
d.text((64, 292), " ".join(rest), font=mona_font(52, 800), fill=PAPER)
d.text((64, 380), role.upper(), font=mono_font(24), fill=PAPER)
d.text((64, 418), " / ".join(x.upper() for x in disciplines), font=mono_font(24), fill=(170, 172, 160))
d.line((64, 520, 560, 520), fill=(60, 62, 56), width=2)
d.text((64, 540), f"{base.upper()}  ·  GITHUB.COM/OSCAR-MAN-SHRESTHA", font=mono_font(18), fill=(150, 152, 142))
img.save("public/og.png", optimize=True)
print("wrote public/og.png", os.path.getsize("public/og.png") // 1024, "KB")
