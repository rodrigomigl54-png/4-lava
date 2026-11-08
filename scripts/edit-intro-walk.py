#!/usr/bin/env python3
"""
edit-intro-walk.py — films the intro "walk" (fountain → street → small door) out of a
screen recording or phone video, like a slow drone/gimbal shot.

    python3 scripts/edit-intro-walk.py                          # uses scripts/intro-edit.json
    python3 scripts/edit-intro-walk.py --edl my-edit.json --preview

What it does
  1. cuts the shots listed in the edit list (EDL) — any direction (reverse is allowed),
     any speed — so e.g. a recording made door → fountain plays fountain → door;
  2. cleans every frame: removes the Google Maps pin and its label, white street-name
     text and other white UI near the bottom (OpenCV inpainting); the navigation arrows
     are kept out of frame by the virtual camera (they live in the bottom of the screen);
  3. moves a virtual camera over every shot (eased zoom/pan, small bank on turns) —
     the continuous motion is what makes it read as a drone/gimbal move;
  4. joins shots with motion-blurred whip-pans or soft dissolves;
  5. ends pushing into the open door with a warm glow;
  6. writes desktop 1920×1080 and mobile 1080×1920 masters, then grades / sharpens /
     encodes them with the same look as scripts/process-intro.sh (H.264 + VP9, ≤ 2.5 MB),
     posters, and records them as the "walk" in src/data/intro.json.

Requires: ffmpeg, Python 3, numpy, opencv-python-headless, Pillow.
"""
import argparse, json, math, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT_FPS = 30

# ---------------------------------------------------------------- helpers
def ease(t: float) -> float:
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)          # smoothstep

def lerp(a, b, t):
    return a + (b - a) * t

def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)

def probe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                          'stream=width,height,r_frame_rate:format=duration', '-of', 'json', str(path)],
                         capture_output=True, text=True, check=True).stdout
    j = json.loads(out)
    s = j['streams'][0]
    num, den = s['r_frame_rate'].split('/')
    return int(s['width']), int(s['height']), float(num) / float(den), float(j['format']['duration'])

def decode_range(path, t0, t1, w, h):
    """Decode [t0, t1] at source frame rate into a list of BGR frames."""
    a, b = min(t0, t1), max(t0, t1)
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', f'{max(0, a - 0.05):.3f}', '-i', str(path),
           '-t', f'{b - a + 0.1:.3f}', '-an', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    n = len(raw) // (w * h * 3)
    return [np.frombuffer(raw, np.uint8, w * h * 3, i * w * h * 3).reshape(h, w, 3).copy() for i in range(n)]

# ---------------------------------------------------------------- cleaning
def ui_mask(img, cfg):
    """Mask of on-screen UI to remove: red map pin + its white label, white text near the bottom."""
    h, w = img.shape[:2]
    b, g, r = [img[:, :, i].astype(np.int16) for i in range(3)]
    mask = np.zeros((h, w), np.uint8)

    # 1) Google Maps pin: saturated red disc (+ white rim and tail)
    red = ((r > 185) & (g < 85) & (b < 95)).astype(np.uint8)
    n, lab, stats, cent = cv2.connectedComponentsWithStats(red, 8)
    for i in range(1, n):
        x, y, cw, ch, area = stats[i]
        if area < 120 or area > 0.01 * w * h or not (0.6 < cw / max(ch, 1) < 1.6):
            continue
        cx, cy = cent[i]
        rad = max(cw, ch) / 2
        cv2.circle(mask, (int(cx), int(cy)), int(rad * 1.35), 255, -1)
        tail = np.array([[cx - rad * 0.8, cy + rad * 0.6], [cx + rad * 0.8, cy + rad * 0.6], [cx, cy + rad * 1.9]], np.int32)
        cv2.fillPoly(mask, [tail], 255)
    for i in range(1, n):                       # pin cut by the left/right edge of the screen
        x, y, cw, ch, area = stats[i]
        if area >= 120 and (x <= 1 or x + cw >= w - 1) and 0.03 * h > ch > 15:
            cv2.rectangle(mask, (x - ch, int(y - ch * 0.5)), (x + cw + ch, int(y + ch * 1.9)), 255, -1)

    # 1b) the pin's label: a pure-white rounded box (≥ 245) in the middle band of the screen —
    #     detected on its own, so it is removed even when the pin itself is off-screen
    mn = np.minimum(np.minimum(r, g), b)
    lab_white = (mn >= 245).astype(np.uint8)
    lab_white[: int(h * 0.25)] = 0
    lab_white[int(h * 0.7):] = 0
    n, lab, stats, _ = cv2.connectedComponentsWithStats(lab_white, 8)
    for i in range(1, n):
        x, y, cw, ch, area = stats[i]
        if 1500 <= area <= 0.03 * w * h and 1.2 <= cw / max(ch, 1) <= 5 and area / (cw * ch) > 0.45:
            cv2.rectangle(mask, (x - 8, y - 8), (x + cw + 8, y + ch + 8), 255, -1)
        elif 400 <= area and (x + cw >= w - 2) and area / (cw * ch) > 0.45:     # label cut by the right edge
            cv2.rectangle(mask, (x - 8, y - 8), (w, y + ch + 8), 255, -1)

    # 2) white UI text / chevrons in the lower part of the screen (street names, arrows' highlights)
    mx = np.maximum(np.maximum(r, g), b)
    white = ((mn > cfg.get('white_min', 232)) & (mx - mn < 22)).astype(np.uint8)
    white[: int(h * cfg.get('white_from_y', 0.55))] = 0
    if 'text_x_max' in cfg:                      # street names sit on one side in some shots
        white[:, int(w * cfg['text_x_max']):] = 0
    white = cv2.morphologyEx(white, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    # keep only text-like blobs (not big white areas such as a van's roof)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(white, 8)
    keep = np.zeros_like(white)
    for i in range(1, n):
        x, y, cw, ch, area = stats[i]
        fill = area / max(cw * ch, 1)
        if area >= 25 and fill < 0.75:
            keep[lab == i] = 1
    # street names have a thick dark outline + shadow: grow text masks more than the label
    keep = cv2.dilate(keep, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (cfg.get('text_grow', 19),) * 2))
    # include the dark outline / soft shadow around the pin and label
    mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    return mask, keep * 255

def clean(img, cfg, extra=None):
    """Remove UI: texture-aware inpainting (FSR) for the pin/label on the facade,
    fast inpainting for street names on the asphalt."""
    m_facade, m_text = ui_mask(img, cfg)
    if extra is not None:
        m_facade = cv2.bitwise_or(m_facade, extra)
    out = img.copy()
    if m_text.any():
        small = cv2.resize(out, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
        ms = cv2.resize(m_text, (small.shape[1], small.shape[0]), interpolation=cv2.INTER_NEAREST)
        filled = cv2.resize(cv2.inpaint(small, ms, 9, cv2.INPAINT_TELEA), (img.shape[1], img.shape[0]), interpolation=cv2.INTER_CUBIC)
        soft = cv2.GaussianBlur(m_text, (0, 0), 3).astype(np.float32)[..., None] / 255.0
        out = (out * (1 - soft) + filled * soft).astype(np.uint8)
    if not m_facade.any():
        return out
    n, lab, stats, _ = cv2.connectedComponentsWithStats((m_facade > 0).astype(np.uint8), 8)
    H, W = img.shape[:2]
    has_xphoto = hasattr(cv2, 'xphoto') and hasattr(cv2.xphoto, 'inpaint')
    for i in range(1, n):
        x, y, cw, ch, area = stats[i]
        pad = int(max(cw, ch) * 0.5) + 20
        x0, y0, x1, y1 = max(0, x - pad), max(0, y - pad), min(W, x + cw + pad), min(H, y + ch + pad)
        patch = out[y0:y1, x0:x1].copy()
        pm = (lab[y0:y1, x0:x1] == i).astype(np.uint8) * 255
        if has_xphoto:
            # FSR at half size (quality ≈ full, ~4× faster), composited back inside the mask
            sc = cfg.get('fsr_scale', 1.0)
            ps = cv2.resize(patch, None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA)
            pms = cv2.resize(pm, (ps.shape[1], ps.shape[0]), interpolation=cv2.INTER_NEAREST)
            d = np.zeros_like(ps)
            cv2.xphoto.inpaint(ps, 255 - pms, d, cv2.xphoto.INPAINT_FSR_FAST)
            dst = cv2.resize(d, (patch.shape[1], patch.shape[0]), interpolation=cv2.INTER_CUBIC)
        else:
            dst = cv2.inpaint(patch, pm, 7, cv2.INPAINT_TELEA)
        soft = cv2.GaussianBlur(pm, (0, 0), 2).astype(np.float32)[..., None] / 255.0
        out[y0:y1, x0:x1] = (patch * (1 - soft) + dst * soft).astype(np.uint8)
    return out

def track_boxes(frames, t_first, fps, erase):
    """For each erase item {t, box:[x0,y0,x1,y1] normalised}, follow the object through the
    shot's source frames with template matching; returns {frame_index: [pixel boxes]}."""
    out = {}
    if not erase or not frames:
        return out
    H, W = frames[0].shape[:2]
    gray = [cv2.cvtColor(f, cv2.COLOR_BGR2GRAY) for f in frames]
    for e in erase:
        k0 = min(len(frames) - 1, max(0, round((e['t'] - t_first) * fps)))
        x0, y0, x1, y1 = [int(v * (W if i % 2 == 0 else H)) for i, v in enumerate(e['box'])]
        tpl = gray[k0][y0:y1, x0:x1]
        bw, bh = x1 - x0, y1 - y0
        for direction in (1, -1):
            px, py = x0, y0
            k = k0
            while 0 <= k < len(frames):
                if k != k0:
                    sx0, sy0 = max(0, px - bw), max(0, py - bh // 2)
                    sx1, sy1 = min(W, px + 2 * bw), min(H, py + bh + bh // 2)
                    region = gray[k][sy0:sy1, sx0:sx1]
                    if region.shape[0] < bh or region.shape[1] < bw:
                        break
                    res = cv2.matchTemplate(region, tpl, cv2.TM_CCOEFF_NORMED)
                    _, score, _, loc = cv2.minMaxLoc(res)
                    if score < 0.35:
                        break
                    px, py = sx0 + loc[0], sy0 + loc[1]
                    tpl = gray[k][py:py + bh, px:px + bw]       # adapt to slow changes
                out.setdefault(k, []).append((px, py, bw, bh))
                k += direction
    return out

# ---------------------------------------------------------------- virtual camera
def camera_crop(img, cam, aspect, limit_y):
    """cam = dict(cx, cy, z, roll) in normalised source coords; returns the cropped view."""
    h, w = img.shape[:2]
    ah = h * limit_y                                 # usable height (UI arrows below are excluded)
    # largest rect with this aspect inside the usable area
    bw, bh = (w, w / aspect) if w / aspect <= ah else (ah * aspect, ah)
    cw, ch = bw / cam['z'], bh / cam['z']
    cx = min(max(cam['cx'] * w, cw / 2), w - cw / 2)
    cy = min(max(cam['cy'] * h, ch / 2), ah - ch / 2)
    if abs(cam.get('roll', 0)) > 0.01:
        M = cv2.getRotationMatrix2D((cx, cy), cam['roll'], 1.0)
        img = cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    x0, y0 = cx - cw / 2, cy - ch / 2
    return img, (x0, y0, cw, ch)

def render(img, rect, size):
    x0, y0, cw, ch = rect
    W, H = size
    # sub-pixel accurate crop + Lanczos resize via an affine warp
    M = np.array([[W / cw, 0, -x0 * W / cw], [0, H / ch, -y0 * H / ch]], np.float32)
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT)

def motion_blur(img, length, angle=0.0):
    if length < 2:
        return img
    k = np.zeros((length, length), np.float32)
    k[length // 2, :] = 1.0 / length
    if angle:
        k = cv2.warpAffine(k, cv2.getRotationMatrix2D((length / 2, length / 2), angle, 1), (length, length))
        k /= max(k.sum(), 1e-6)
    return cv2.filter2D(img, -1, k)

def warm_glow(img, cx, cy, strength):
    if strength <= 0:
        return img
    H, W = img.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xx - cx * W) / (W * 0.45)) ** 2 + ((yy - cy * H) / (H * 0.55)) ** 2)
    g = np.clip(1 - d, 0, 1) ** 1.6 * strength
    warm = np.array([110, 196, 255], np.float32)           # BGR warm light
    out = img.astype(np.float32)
    out = out + (warm - out) * g[..., None] * 0.85           # light spill
    out = out + 255 * (strength ** 3) * 0.6                  # final bloom toward white-warm
    return np.clip(out, 0, 255).astype(np.uint8)

# ---------------------------------------------------------------- main edit
def build(edl, src, outdir, preview=False):
    w, h, fps, dur = probe(src)
    limit_y = edl.get('limit_y', 0.76)
    sizes = {'desktop': (1920, 1080), 'mobile': (1080, 1920)}
    if preview:
        sizes = {'desktop': (960, 540), 'mobile': (540, 960)}
    clean_cfg = edl.get('clean', {})
    shots = edl['shots']

    # render every shot into a list of output frames per format
    frames = {k: [] for k in sizes}
    shot_bounds = []
    for si, sh in enumerate(shots):
        t0, t1 = sh['src']
        speed = sh.get('speed', 1.0)
        n = max(2, round(abs(t1 - t0) / speed * OUT_FPS))
        print(f'  shot {si + 1}/{len(shots)}: {t0:.2f}→{t1:.2f}s ×{speed} → {n} frames  ({sh.get("note", "")})')
        src_frames = decode_range(src, t0, t1, w, h)
        a = min(t0, t1)
        boxes = track_boxes(src_frames, max(0, a - 0.05), fps, sh.get('erase'))
        if sh.get('erase'):
            print(f'    tracked {len(sh["erase"])} object(s) through {len(boxes)} frames')
        cache = {}
        start_idx = {k: len(v) for k, v in frames.items()}
        for k in range(n):
            p = k / (n - 1)
            t = lerp(t0, t1, p)
            fi = min(len(src_frames) - 1, max(0, round((t - max(0, a - 0.05)) * fps)))
            if fi not in cache:
                extra = None
                if fi in boxes:
                    extra = np.zeros(src_frames[fi].shape[:2], np.uint8)
                    for (bx, by, bw2, bh2) in boxes[fi]:
                        pad = int(bw2 * 0.25)
                        cv2.rectangle(extra, (bx - pad, by - pad), (bx + bw2 + pad, by + bh2 + pad), 255, -1)
                cache = {fi: clean(src_frames[fi], {**clean_cfg, **sh.get('clean', {})}, extra)}
            img = cache[fi]
            e = ease(p) if sh.get('ease', True) else p
            c0, c1 = sh['cam'][0], sh['cam'][1]
            cam = {key: lerp(c0.get(key, 0.0), c1.get(key, 0.0), e) for key in ('cx', 'cy', 'z', 'roll')}
            for fmt, size in sizes.items():
                camf = dict(cam)
                ov = sh.get(fmt)                                  # per-format framing override
                if ov:
                    camf.update({key: lerp(ov[0].get(key, cam[key]), ov[1].get(key, cam[key]), e) for key in ov[0]})
                rimg, rect = camera_crop(img, camf, size[0] / size[1], sh.get('limit_y', limit_y))
                out = render(rimg, rect, size)
                if sh.get('glow') and p > sh['glow'].get('from', 0.6):
                    gp = (p - sh['glow']['from']) / (1 - sh['glow']['from'])
                    out = warm_glow(out, sh['glow']['x'], sh['glow']['y'], ease(gp))
                frames[fmt].append(out)
        shot_bounds.append({k: (start_idx[k], len(frames[k])) for k in frames})
        del src_frames, cache

    # transitions at the cut after each shot
    for si, sh in enumerate(shots[:-1]):
        tr = sh.get('out', {'type': 'cut'})
        for fmt in frames:
            fr = frames[fmt]
            cut = shot_bounds[si][fmt][1]
            L = tr.get('frames', 6)
            if tr['type'] == 'whip':
                ang = tr.get('angle', 0)
                for j in range(-L, L):
                    idx = cut + j
                    if 0 <= idx < len(fr):
                        strength = 1 - abs(j + 0.5) / L
                        fr[idx] = motion_blur(fr[idx], int(5 + strength * fr[idx].shape[1] * 0.08), ang)
                # brief cross-blend right at the cut
                for j in range(3):
                    if cut - 1 - j >= 0 and cut + j < len(fr):
                        al = 0.5 - j * 0.15
                        fr[cut + j] = cv2.addWeighted(fr[cut + j], 1 - al, fr[cut - 1 - j], al, 0)
            elif tr['type'] == 'dissolve':
                for j in range(L):
                    if cut - L + j >= 0 and cut + j < len(fr):
                        al = (j + 1) / (L + 1)
                        fr[cut + j] = cv2.addWeighted(fr[cut - L + j], 1 - al, fr[cut + j], al, 0)

    # write lossless-ish masters
    outdir.mkdir(parents=True, exist_ok=True)
    masters = {}
    for fmt, fr in frames.items():
        W, H = sizes[fmt]
        path = outdir / f'walk-master-{fmt}.mp4'
        p = subprocess.Popen(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24',
                              '-s', f'{W}x{H}', '-r', str(OUT_FPS), '-i', '-', '-c:v', 'libx264', '-crf', '10',
                              '-preset', 'medium', '-pix_fmt', 'yuv420p', str(path)], stdin=subprocess.PIPE)
        for f in fr:
            p.stdin.write(f.tobytes())
        p.stdin.close(); p.wait()
        masters[fmt] = path
        print(f'  master {fmt}: {len(fr)} frames = {len(fr) / OUT_FPS:.2f}s → {path.name}')
    return masters

def grade_filter():
    """Reuse the exact colour grade from process-intro.sh so all intro media match."""
    sh = (ROOT / 'scripts' / 'process-intro.sh').read_text()
    m = re.search(r'GRADE="(.+?)"\n', sh, re.S)
    g = m.group(1).replace('\\\n', '')
    return g

def size_mb(p):
    return os.path.getsize(p) / 1048576

def encode(masters, public_dir, max_mb=2.5):
    grade = grade_filter()
    out = {}
    for fmt, m in masters.items():
        base = public_dir / f'walk-1-{fmt}'
        vf = f'{grade},format=yuv420p'
        crf = 23 if fmt == 'desktop' else 24
        for _ in range(6):
            run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(m), '-vf', vf, '-an', '-c:v', 'libx264',
                 '-preset', 'slow', '-crf', str(crf), '-movflags', '+faststart', f'{base}.mp4'])
            if size_mb(f'{base}.mp4') <= max_mb:
                break
            crf += 2
        vcrf = 34
        for _ in range(6):
            run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(m), '-vf', vf, '-an', '-c:v', 'libvpx-vp9',
                 '-b:v', '0', '-crf', str(vcrf), '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2', f'{base}.webm'])
            if size_mb(f'{base}.webm') <= max_mb:
                break
            vcrf += 3
        run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', f'{base}.mp4', '-frames:v', '1', '-q:v', '2', f'{base}-poster.jpg'])
        Image.open(f'{base}-poster.jpg').save(f'{base}-poster.avif', quality=60)
        print(f'  {fmt}: mp4 {size_mb(f"{base}.mp4"):.2f} MB (crf {crf}) · webm {size_mb(f"{base}.webm"):.2f} MB')
        rel = '/intro/' + base.name
        out[fmt] = {'mp4': f'{rel}.mp4', 'webm': f'{rel}.webm', 'poster': f'{rel}-poster.jpg', 'posterAvif': f'{rel}-poster.avif'}
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--edl', default=str(ROOT / 'scripts' / 'intro-edit.json'))
    ap.add_argument('--preview', action='store_true', help='half-size masters only, no encoding')
    args = ap.parse_args()
    edl = json.loads(Path(args.edl).read_text())
    src = ROOT / edl['source']
    if not src.exists():
        sys.exit(f'✗ source not found: {src}  (put the recording there — raw/ is not in git)')
    print(f'• editing {src.relative_to(ROOT)} ({len(edl["shots"])} shots)')
    work = Path(tempfile.mkdtemp(prefix='k4l-walk-'))
    try:
        masters = build(edl, src, work if not args.preview else ROOT / 'raw' / 'intro' / 'preview', args.preview)
        if args.preview:
            print('✓ preview masters in raw/intro/preview/')
            return
        public = ROOT / 'public' / 'intro'
        public.mkdir(parents=True, exist_ok=True)
        walk = encode(masters, public)
        walk['raw'] = edl['source']
        walk['editor'] = 'scripts/edit-intro-walk.py'
        man_path = ROOT / 'src' / 'data' / 'intro.json'
        man = json.loads(man_path.read_text())
        man['walk'] = {'video': walk, 'stills': []}
        man['source'] = edl.get('sourceKind', 'google-maps-demo')
        json.dump(man, open(man_path, 'w'), ensure_ascii=False, indent=2)
        ad_path = ROOT / 'src' / 'data' / 'assets-demo.json'
        ad = json.loads(ad_path.read_text())
        ad['assets'] = [a for a in ad['assets'] if a.get('file') != edl['source']]
        if edl.get('sourceKind', 'google-maps-demo') == 'google-maps-demo':
            ad['assets'].append({'file': edl['source'], 'output': 'public/intro/walk-1-*', 'use': 'intro – walk fountain → door (screen recording of Street View, edited)',
                                 'source': 'google-maps-demo', 'replaceBeforeLaunch': True})
        json.dump(ad, open(ad_path, 'w'), ensure_ascii=False, indent=2)
        print('✓ public/intro/walk-1-* + src/data/intro.json (walk)')
    finally:
        shutil.rmtree(work, ignore_errors=True)

if __name__ == '__main__':
    main()
