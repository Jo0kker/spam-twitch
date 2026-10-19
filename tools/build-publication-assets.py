"""Deterministic Twitch store exports from the companion's existing S/lime identity."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'publication' / 'assets'
OUT.mkdir(parents=True, exist_ok=True)
SCALE = 4
INK, LIME, WHITE, MUTED = '#101713', '#c8f56d', '#f1f2e8', '#aebba9'
FONT = Path('C:/Windows/Fonts/seguisb.ttf')
REGULAR = Path('C:/Windows/Fonts/segoeui.ttf')

def font(size, bold=True):
    return ImageFont.truetype(str(FONT if bold else REGULAR), round(size * SCALE))

def mark(size):
    image = Image.new('RGBA', (size * SCALE, size * SCALE), INK)
    d = ImageDraw.Draw(image)
    p = lambda n: round(n * size * SCALE / 100)
    d.rounded_rectangle((p(12), p(9), p(88), p(91)), radius=p(18), fill=LIME)
    f = font(size * .70)
    d.text((p(50), p(46)), 'S', font=f, anchor='mm', fill=INK)
    return image

def save(image, name, size):
    path = OUT / name
    image.convert('RGB').resize(size, Image.Resampling.LANCZOS).save(path, 'PNG')
    return {'file': name, 'width': size[0], 'height': size[1], 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}

exports = []
exports.append(save(mark(100), 'logo-100.png', (100, 100)))
exports.append(save(mark(100), 'taskbar-24.png', (24, 24)))
discovery = Image.new('RGB', (300 * SCALE, 200 * SCALE), INK)
d = ImageDraw.Draw(discovery)
q = lambda n: round(n * SCALE)
for x, y, angle in [(211, 33, -10), (233, 39, 8)]:
    card = Image.new('RGBA', (q(65), q(92)))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle((q(2), q(2), q(62), q(88)), radius=q(8), fill='#213126', outline='#51643c', width=q(1))
    rotated = card.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    discovery.paste(rotated, (q(x), q(y)), rotated)
small = mark(45)
discovery.paste(small, (q(20), q(18)), small)
d = ImageDraw.Draw(discovery)
d.text((q(20), q(83)), 'SPAM', font=font(35), fill=WHITE)
d.text((q(21), q(125)), 'CARD INSPECTOR', font=font(15), fill=LIME)
d.text((q(21), q(158)), 'Les capacités au survol', font=font(13, False), fill=MUTED)
exports.append(save(discovery, 'discovery-300x200.png', (300, 200)))
manifest = {
    'source': 'Original companion S mark and approved lime/dark palette; rendered deterministically, no game artwork or Twitch logo.',
    'generator': 'tools/build-publication-assets.py',
    'exports': exports,
    'screenshot': 'A separate genuine live screenshot is required; these exports are not gameplay screenshots.'
}
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')
print(json.dumps(exports, indent=2))
