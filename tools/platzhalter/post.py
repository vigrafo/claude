import sys, os, numpy as np
from PIL import Image, ImageFilter
D = sys.argv[1]; os.makedirs(D + '/webp', exist_ok=True)
names = sorted(f[:-4] for f in os.listdir(D + '/png'))
rng = np.random.default_rng(1)
for n in names:
    im = Image.open(D + '/png/' + n + '.png').convert('RGB')
    im = im.filter(ImageFilter.GaussianBlur(0.6))
    a = np.asarray(im).astype(np.float32) / 255
    H, W, _ = a.shape
    blau = any(k in n for k in ('rohr', 'notdienst', 'kanal', 'wartung'))
    # Grading: warm bzw. neutral-kühl, matte Tiefen
    if blau:
        a = a * np.array([0.97, 1.0, 1.04])
    else:
        a = a * np.array([1.03, 1.0, 0.95])
    a = 0.04 + a * 0.93
    # feine Körnung + grobe Betonstruktur
    g = rng.normal(0, 0.022, (H, W, 1))
    t = Image.fromarray((rng.random((H // 8, W // 8)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(3))
    t = (np.asarray(t).astype(np.float32) / 255 - .5)[..., None] * 0.05
    a = a + g + t
    # Vignette
    y, x = np.mgrid[0:H, 0:W]
    v = 1 - 0.28 * (((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2) / 2
    a = a * v[..., None]
    out = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    out.save(D + '/webp/' + n + '.webp', 'WEBP', quality=78, method=6)
# Übersicht
th = []
for n in names:
    im = Image.open(D + '/webp/' + n + '.webp'); im.thumbnail((400, 260)); th.append(im)
cols = 6; rows = (len(th) + cols - 1) // cols
sheet = Image.new('RGB', (cols * 410, rows * 270), '#ffffff')
for i, im in enumerate(th):
    sheet.paste(im, ((i % cols) * 410 + 5, (i // cols) * 270 + 5))
sheet.save(D + '/uebersicht.jpg', quality=85)
print(sum(os.path.getsize(D + '/webp/' + f) for f in os.listdir(D + '/webp')) // 1024, 'KB gesamt')
