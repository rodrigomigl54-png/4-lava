#!/usr/bin/env python3
"""
enhance-menu.py — pojačava fotografije štampanog jelovnika radi čitanja.

Ulaz:  raw/menu/*.jpg|png|webp   (originali se NE menjaju)
Izlaz: raw/menu/enhanced/<ime>-gray.png      (grayscale, deskew, upscale, CLAHE, unsharp)
       raw/menu/enhanced/<ime>-thresh.png    (adaptive threshold varijanta)
       raw/menu/enhanced/<ime>-color.png     (upscale u boji, blago izoštreno)
       raw/menu/enhanced/report.json         (veličine i upozorenja)

Upotreba:  python3 scripts/enhance-menu.py [--scale 4]
Zahteva Pillow; OpenCV (opencv-python-headless) se koristi ako je instaliran.
Ako je instaliran `realesrgan-ncnn-vulkan`, koristi se za upscale umesto Lanczos-a.
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

try:
    import cv2
    import numpy as np
except ImportError:  # radi i bez OpenCV-a, samo jednostavnije
    cv2 = None
    np = None

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "raw" / "menu"
OUT = SRC / "enhanced"
MIN_READABLE_PX = 900  # ispod ove kraće ivice tekst jelovnika obično nije čitljiv


def upscale(img: Image.Image, scale: int, tmp: Path) -> Image.Image:
    esr = shutil.which("realesrgan-ncnn-vulkan")
    if esr:
        src = tmp / "_esr_in.png"
        dst = tmp / "_esr_out.png"
        img.save(src)
        try:
            subprocess.run([esr, "-i", str(src), "-o", str(dst), "-s", str(min(scale, 4))],
                           check=True, capture_output=True)
            return Image.open(dst).convert("RGB")
        except Exception:
            pass
    return img.resize((img.width * scale, img.height * scale), Image.LANCZOS)


def deskew(gray):
    """Ispravlja blagi nagib stranice (OpenCV)."""
    if cv2 is None:
        return gray
    inv = cv2.bitwise_not(gray)
    th = cv2.threshold(inv, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
    coords = np.column_stack(np.where(th > 0))
    if len(coords) < 50:
        return gray
    angle = cv2.minAreaRect(coords)[-1]
    if angle > 45:
        angle -= 90
    if abs(angle) < 0.3 or abs(angle) > 15:
        return gray
    h, w = gray.shape
    m = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(gray, m, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def process(path: Path, scale: int) -> dict:
    img = Image.open(path).convert("RGB")
    w, h = img.size
    big = upscale(img, scale, OUT)
    stem = path.stem

    color = big.filter(ImageFilter.UnsharpMask(radius=2, percent=120, threshold=2))
    color.save(OUT / f"{stem}-color.png")

    gray_pil = ImageOps.grayscale(big)
    if cv2 is not None:
        g = np.array(gray_pil)
        g = cv2.fastNlMeansDenoising(g, None, h=7)
        g = deskew(g)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        g = clahe.apply(g)
        blur = cv2.GaussianBlur(g, (0, 0), 2.0)
        g = cv2.addWeighted(g, 1.8, blur, -0.8, 0)
        cv2.imwrite(str(OUT / f"{stem}-gray.png"), g)
        th = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY, 31, 12)
        cv2.imwrite(str(OUT / f"{stem}-thresh.png"), th)
    else:
        g = ImageOps.autocontrast(gray_pil, cutoff=1)
        g = g.filter(ImageFilter.UnsharpMask(radius=2, percent=180, threshold=2))
        g.save(OUT / f"{stem}-gray.png")
        g.point(lambda p: 255 if p > 140 else 0).save(OUT / f"{stem}-thresh.png")

    warn = None
    if min(w, h) < MIN_READABLE_PX:
        warn = (f"Original je samo {w}×{h} px — premalo za pouzdano čitanje cena. "
                f"Potrebna je fotografija bar ~{MIN_READABLE_PX} px po kraćoj ivici.")
    return {"file": path.name, "width": w, "height": h, "scale": scale,
            "readable": warn is None, "warning": warn}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scale", type=int, default=4)
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in SRC.iterdir()
                   if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"})
    if not files:
        print("Nema slika u raw/menu/.")
        return 1
    report = [process(p, args.scale) for p in files]
    (OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    for r in report:
        flag = "OK " if r["readable"] else "MALO"
        print(f"[{flag}] {r['file']} {r['width']}×{r['height']}  {r['warning'] or ''}")
    if not all(r["readable"] for r in report):
        print("\nUPOZORENJE: neke fotografije su premale — pošaljite veće (originalne) slike.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
