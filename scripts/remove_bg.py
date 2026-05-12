from PIL import Image
import os

src = r"C:\Users\yogun\.gemini\antigravity\brain\08c26219-009e-4d97-9b38-a00a224fd075\frame_v4_purple_1778443771010.png"
dst = r"c:\SopranoChat\assets\avatar_frames\premium\PurpleViolet.png"

BLACK_THRESHOLD = 30
FADE_THRESHOLD = 60

img = Image.open(src).convert("RGBA")
pixels = img.load()
w, h = img.size

for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        lum = 0.299 * r + 0.587 * g + 0.114 * b
        if lum < BLACK_THRESHOLD:
            pixels[x, y] = (r, g, b, 0)
        elif lum < FADE_THRESHOLD:
            ratio = (lum - BLACK_THRESHOLD) / (FADE_THRESHOLD - BLACK_THRESHOLD)
            pixels[x, y] = (r, g, b, int(ratio * a))

img.save(dst, "PNG")
print(f"[OK] PurpleViolet.png - {w}x{h} - {os.path.getsize(dst)/1024:.0f} KB")
