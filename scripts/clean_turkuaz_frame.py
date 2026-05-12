"""
Turkuaz Premium çerçeve PNG'sinin alt-orta etiket alanını TAMAMEN şeffaflaştırır.
Kullanıcı bu sarı şeridi "PRO rozet" sanıyordu, kafa karıştırıcı.

Strateji: alt-orta dikdörtgen alanı koşulsuz temizle. Etiket halka çemberi ile
kesişiyorsa halkanın küçük bir kısmı da silinir — kabul edilebilir, sade halka olur.
"""
from PIL import Image
import os

SRC = r"C:\SopranoChat\.tmp_frame.png"
DST = r"C:\SopranoChat\.tmp_frame_clean.png"

img = Image.open(SRC).convert("RGBA")
w, h = img.size
pixels = img.load()

# Alt-orta etiket alanı — tamamen şeffaflaştır
TOP = int(h * 0.79)
BOTTOM = int(h * 0.97)
LEFT = int(w * 0.32)
RIGHT = int(w * 0.68)

# Halka merkezi ve dış yarıçapı — halkanın daire kısmını koru
cx, cy = w // 2, h // 2
ring_inner_r = int(0.42 * w)
ring_outer_r = int(0.48 * w)

changed = 0
for y in range(TOP, BOTTOM):
    for x in range(LEFT, RIGHT):
        dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
        # Sadece halkanın daire kısmı (inner..outer) DIŞINDA olan pixeller silinsin.
        # Bu da etiketin halka altında kalan dikdörtgen kısmıdır.
        if dist < ring_inner_r or dist > ring_outer_r:
            r, g, b, a = pixels[x, y]
            if a > 0:
                pixels[x, y] = (0, 0, 0, 0)
                changed += 1

img.save(DST)
print(f"Cleaned {changed} pixels. Saved to {DST}, size: {os.path.getsize(DST)} bytes")
