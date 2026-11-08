#!/usr/bin/env bash
# =============================================================================
# process-intro.sh — обрада снимака за интро „Попиј воду са чесме“
#
#   ./scripts/process-intro.sh                  # демо: материјал са Google мапа
#   SOURCE=own ./scripts/process-intro.sh       # објава: сопствени снимци
#
# Ulaz:  raw/intro/*   (video: mp4 mov webm m4v · foto: jpg jpeg png webp heic)
#        Ime fajla određuje scenu:
#          *put* *walk* *setnja*              → ŠETNJA od česme do vrata (jedan kadar,
#                                               npr. snimak ekrana Street View-a) — najbolji intro
#          *vrata* *door* *ulaz* *entrance*   → scena 2 (mala vrata)
#          sve ostalo (cesma, fountain, trg…) → scena 1 (česma)
#        Više fotografija iste scene = sekvenca (abecedni red).
# Izlaz: public/intro/…  +  src/data/intro.json (manifest; Intro.astro se sam
#        prebacuje na video/fotografije kad postoje) + src/data/assets-demo.json
#
# Video:  trim najboljih ~3,5 s · stabilizacija (vidstab) · 16:9 i 9:16 ·
#         izoštravanje + blagi denoise · kolor-grejd sajta · zrno + vinjeta ·
#         H.264 (veryfast, crf 26) + VP9 WebM, bez zvuka · poster JPG/AVIF ·
#         cilj ≤ 2,5 MB po fajlu.
# Foto:   upscale (Real-ESRGAN ako postoji, inače Lanczos ×2) · isti grejd ·
#         AVIF/WebP/JPG 1920 px (desktop) i 1080×1920 (mobilni).
#
# Env:  CLIP_SECONDS=3.5  TRIM_START=<s> (inače automatski)  MAX_MB=2.5
#       WALK_SECONDS=3  (šetnja se ubrza na ovu dužinu; intro ukupno ≤ ~5 s)
#       SMOOTH=mci|blend|0 (izglađivanje skokova između Street View panorama; default mci za šetnju)
#       AUTOCROP=1 (odseca crne ivice / trake) · CROP=w:h:x:y (ručno, npr. bez menija pregledača)
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RAW="${RAW_DIR:-$ROOT/raw/intro}"
OUT="${OUT_DIR:-$ROOT/public/intro}"
DATA="${DATA_DIR:-$ROOT/src/data}"
SOURCE="${SOURCE:-google-maps-demo}"
CLIP_SECONDS="${CLIP_SECONDS:-3.5}"
WALK_SECONDS="${WALK_SECONDS:-3}"
SMOOTH="${SMOOTH:-mci}"
AUTOCROP="${AUTOCROP:-1}"
CROP="${CROP:-}"
MAX_MB="${MAX_MB:-2.5}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

command -v ffmpeg >/dev/null || { echo "✗ ffmpeg nije instaliran"; exit 1; }
mkdir -p "$OUT"

# --- Kolor-grejd sajta ------------------------------------------------------
# tople svetle zone, malo podignute crne, crvene ka --marble-red (#8E2A2A),
# zelene desaturisane ka --forest (#2F3B2C), blago zrno i vinjeta.
GRADE="eq=contrast=1.05:saturation=0.94:gamma=1.02,\
colortemperature=temperature=5600:mix=0.35,\
colorbalance=rs=0.02:bs=-0.03:rh=0.05:gh=0.015:bh=-0.05,\
huesaturation=colors=r:hue=-4:saturation=0.12:intensity=0.2,\
huesaturation=colors=g:saturation=-0.38,\
curves=all='0/0.045 0.25/0.24 0.5/0.52 0.8/0.83 1/0.97',\
hqdn3d=1.5:1.5:6:6,unsharp=5:5:0.8:5:5:0.0,\
noise=alls=5:allf=t,vignette=angle=PI/5"
# fotografije: isto, ali statično zrno
GRADE_STILL="${GRADE/noise=alls=5:allf=t/noise=alls=4}"

HAS_VIDSTAB=0
FILTERS="$(ffmpeg -hide_banner -filters 2>/dev/null || true)"; [[ "$FILTERS" == *vidstabdetect* ]] && HAS_VIDSTAB=1
ESRGAN="$(command -v realesrgan-ncnn-vulkan || true)"

scene_of() {
  local n; n="$(basename "$1" | tr '[:upper:]' '[:lower:]')"
  case "$n" in
    *put*|*walk*|*setnja*|*šetnja*|*fountain-to-door*) echo walk ;;
    *vrata*|*door*|*ulaz*|*entrance*) echo door ;;
    *) echo fountain ;;
  esac
}
duration_of() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1" 2>/dev/null | cut -d. -f1-2; }
size_mb() { python3 -c "import os,sys;print(round(os.path.getsize(sys.argv[1])/1048576,2))" "$1"; }

# --- Odsecanje interfejsa / crnih traka --------------------------------------
pre_crop() {
  local f="$1"
  if [ -n "$CROP" ]; then echo "crop=$CROP,"; return; fi
  [ "$AUTOCROP" = 1 ] || { echo ""; return; }
  local c
  c="$(ffmpeg -hide_banner -i "$f" -t 4 -vf cropdetect=limit=24:round=2:reset=0 -f null - 2>&1 | grep -o 'crop=[0-9:]*' | sort | uniq -c | sort -nr | head -1 | awk '{print $2}')"
  [ -n "$c" ] && echo "$c," || echo ""
}

# --- Automatski izbor najmirnijeg segmenta (najmanje rezova/trzaja) ----------
best_start() {
  local f="$1" dur="$2"
  [ -n "${TRIM_START:-}" ] && { echo "$TRIM_START"; return; }
  python3 - "$f" "$dur" "$CLIP_SECONDS" <<'PY'
import subprocess, sys
f, dur, clip = sys.argv[1], float(sys.argv[2] or 0), float(sys.argv[3])
if dur <= clip + 0.5:
    print(0); sys.exit()
# scene-change score per frame → pick the window with the lowest total motion
out = subprocess.run(['ffmpeg','-hide_banner','-i',f,'-vf',"select='gte(scene,0)',metadata=print:file=-",'-an','-f','null','-'],
                     capture_output=True, text=True).stdout
pts, sc = [], []
for line in out.splitlines():
    if 'pts_time:' in line: pts.append(float(line.split('pts_time:')[1].split()[0]))
    if 'scene_score=' in line: sc.append(float(line.split('=')[1]))
best, best_t = None, 0.3
t = 0.3
while t + clip <= dur - 0.2:
    s = sum(v for p, v in zip(pts, sc) if t <= p < t + clip)
    if best is None or s < best: best, best_t = s, t
    t += 0.25
print(round(best_t, 2))
PY
}

process_video() {
  local f="$1" scene="$2" i="$3"
  local base="$OUT/$scene-$i" dur start src="$f" pre
  dur="$(duration_of "$f")"; pre="$(pre_crop "$f")"
  if [ "$scene" = walk ]; then
    # whole walk, sped up to WALK_SECONDS, panorama jumps smoothed
    local speed smooth=""
    speed="$(python3 -c "d=float('${dur:-0}' or 0);print(round(min(1.0, $WALK_SECONDS/d),4) if d else 1)")"
    case "$SMOOTH" in
      mci)   smooth=",minterpolate=fps=30:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1" ;;
      blend) smooth=",minterpolate=fps=30:mi_mode=blend" ;;
    esac
    echo "  ▸ šetnja $(basename "$f") → ${dur}s → ${WALK_SECONDS}s (×$(python3 -c "print(round(1/$speed,2))"), izglađivanje: $SMOOTH)"
    ffmpeg -hide_banner -loglevel error -y -i "$f" -an -vf "${pre}setpts=${speed}*PTS${smooth}" -c:v libx264 -crf 12 -preset veryfast "$TMP/trim.mp4"
  else
    start="$(best_start "$f" "${dur:-0}")"
    echo "  ▸ video $(basename "$f") → $scene (start ${start}s, ${CLIP_SECONDS}s)"
    ffmpeg -hide_banner -loglevel error -y -ss "$start" -t "$CLIP_SECONDS" -i "$f" -an -vf "${pre%,}" -c:v libx264 -crf 12 -preset veryfast "$TMP/trim.mp4" 2>/dev/null \
      || ffmpeg -hide_banner -loglevel error -y -ss "$start" -t "$CLIP_SECONDS" -i "$f" -an -c:v libx264 -crf 12 -preset veryfast "$TMP/trim.mp4"
  fi
  src="$TMP/trim.mp4"
  if [ "$HAS_VIDSTAB" = 1 ]; then
    ffmpeg -hide_banner -loglevel error -y -i "$src" -vf vidstabdetect=shakiness=5:accuracy=15:result="$TMP/t.trf" -f null - \
      && ffmpeg -hide_banner -loglevel error -y -i "$src" -vf vidstabtransform=input="$TMP/t.trf":smoothing=18:zoom=2,unsharp=5:5:0.5 -an -c:v libx264 -crf 12 -preset veryfast "$TMP/stab.mp4" \
      && src="$TMP/stab.mp4"
  fi
  for fmt in desktop mobile; do
    local crop w h crf=26 vcrf=36
    if [ $fmt = desktop ]; then w=1920; h=1080;  crop="crop='min(iw,ih*16/9)':'min(ih,iw*9/16)',scale=${w}:${h}:flags=lanczos"
    else                      w=720;  h=1280; crop="crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=${w}:${h}:flags=lanczos"; fi
    local vf="$crop,$GRADE,format=yuv420p"
    for attempt in 1 2 3 4 5; do
      ffmpeg -hide_banner -loglevel error -y -i "$src" -vf "$vf" -an -c:v libx264 -preset veryfast -crf $crf -movflags +faststart "$base-$fmt.mp4"
      [ "$(python3 -c "print(1 if $(size_mb "$base-$fmt.mp4") <= $MAX_MB else 0)")" = 1 ] && break
      crf=$((crf + 3))
    done
    for attempt in 1 2 3 4 5; do
      ffmpeg -hide_banner -loglevel error -y -i "$src" -vf "$vf" -an -c:v libvpx-vp9 -b:v 0 -crf $vcrf -row-mt 1 -deadline good -cpu-used 4 "$base-$fmt.webm"
      [ "$(python3 -c "print(1 if $(size_mb "$base-$fmt.webm") <= $MAX_MB else 0)")" = 1 ] && break
      vcrf=$((vcrf + 4))
    done
    ffmpeg -hide_banner -loglevel error -y -i "$base-$fmt.mp4" -frames:v 1 -q:v 3 "$base-$fmt-poster.jpg"
    python3 -c "from PIL import Image;Image.open('$base-$fmt-poster.jpg').save('$base-$fmt-poster.avif',quality=55)"
    echo "    $fmt: mp4 $(size_mb "$base-$fmt.mp4") MB · webm $(size_mb "$base-$fmt.webm") MB"
  done
}

process_photo() {
  local f="$1" scene="$2" i="$3"
  local base="$OUT/$scene-$i" src="$f" w
  echo "  ▸ foto  $(basename "$f") → $scene"
  w="$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$f")"
  if [ "${w:-0}" -lt 1800 ]; then
    if [ -n "$ESRGAN" ]; then "$ESRGAN" -i "$f" -o "$TMP/up.png" -s 2 >/dev/null 2>&1 && src="$TMP/up.png"
    else ffmpeg -hide_banner -loglevel error -y -i "$f" -vf "scale=iw*2:ih*2:flags=lanczos" "$TMP/up.png" && src="$TMP/up.png"; fi
  fi
  ffmpeg -hide_banner -loglevel error -y -i "$src" -vf "scale='if(gt(iw,1920),1920,iw)':-2:flags=lanczos,$GRADE_STILL" -frames:v 1 "$TMP/d.png"
  ffmpeg -hide_banner -loglevel error -y -i "$src" -vf "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=1080:1920:flags=lanczos,$GRADE_STILL" -frames:v 1 "$TMP/m.png"
  python3 - "$TMP/d.png" "$TMP/m.png" "$base" <<'PY'
import sys
from PIL import Image
d, m, base = sys.argv[1:4]
for src, tag in ((d, 'desktop'), (m, 'mobile')):
    im = Image.open(src).convert('RGB')
    im.save(f'{base}-{tag}.avif', quality=52)
    im.save(f'{base}-{tag}.webp', quality=74, method=6)
    im.save(f'{base}-{tag}.jpg', quality=80, optimize=True, progressive=True)
PY
}

# --- Glavna petlja ----------------------------------------------------------
shopt -s nullglob nocaseglob
files=("$RAW"/*.{mp4,mov,webm,m4v,jpg,jpeg,png,webp,heic})
shopt -u nocaseglob
rm -f "$OUT"/fountain-* "$OUT"/door-* "$OUT"/walk-*
declare -A count=([fountain]=0 [door]=0 [walk]=0)
processed=()
if [ ${#files[@]} -eq 0 ]; then
  echo "• raw/intro/ je prazan — intro koristi ilustrovanu česmu (SVG)."
else
  echo "• Obrada ${#files[@]} fajl(ova) iz raw/intro/  (izvor: $SOURCE, vidstab: $HAS_VIDSTAB)"
  IFS=$'\n' sorted=($(printf '%s\n' "${files[@]}" | sort)); unset IFS
  for f in "${sorted[@]}"; do
    scene="$(scene_of "$f")"; count[$scene]=$((count[$scene] + 1)); i="${count[$scene]}"
    case "${f,,}" in
      *.mp4|*.mov|*.webm|*.m4v) process_video "$f" "$scene" "$i"; kind=video ;;
      *) process_photo "$f" "$scene" "$i"; kind=photo ;;
    esac
    processed+=("$scene|$i|$kind|$(basename "$f")")
  done
fi

# --- Manifest za Intro.astro + spisak demo materijala ------------------------
python3 - "$OUT" "$DATA" "$SOURCE" "${processed[@]+"${processed[@]}"}" <<'PY'
import json, os, sys, datetime
out, data, source, *rows = sys.argv[1:]
web = '/intro'
def scene(name):
    vids, stills = [], []
    for r in rows:
        s, i, kind, raw = r.split('|')
        if s != name: continue
        p = f'{web}/{s}-{i}'
        if kind == 'video':
            vids.append({k: {'mp4': f'{p}-{k}.mp4', 'webm': f'{p}-{k}.webm', 'poster': f'{p}-{k}-poster.jpg', 'posterAvif': f'{p}-{k}-poster.avif'} for k in ('desktop', 'mobile')} | {'raw': raw})
        else:
            stills.append({k: {'avif': f'{p}-{k}.avif', 'webp': f'{p}-{k}.webp', 'jpg': f'{p}-{k}.jpg'} for k in ('desktop', 'mobile')} | {'raw': raw})
    return {'video': vids[0] if vids else None, 'stills': stills}
manifest = {'generated': datetime.date.today().isoformat(), 'source': source if rows else None,
            'walk': scene('walk'), 'fountain': scene('fountain'), 'door': scene('door')}
json.dump(manifest, open(os.path.join(data, 'intro.json'), 'w'), ensure_ascii=False, indent=2)

ad_path = os.path.join(data, 'assets-demo.json')
ad = json.load(open(ad_path))
ad['assets'] = [a for a in ad['assets'] if not a.get('file', '').startswith('raw/intro/')]
if source == 'google-maps-demo':
    for r in rows:
        s, i, kind, raw = r.split('|')
        ad['assets'].append({'file': f'raw/intro/{raw}', 'output': f'public/intro/{s}-{i}-*', 'use': f'intro – scene "{s}" ({kind})',
                             'source': 'google-maps-demo', 'replaceBeforeLaunch': True})
json.dump(ad, open(ad_path, 'w'), ensure_ascii=False, indent=2)
print(f"✓ šetnja: {'da' if manifest['walk']['video'] else 'ne'}")
print(f"✓ src/data/intro.json  (česma: {len(manifest['fountain']['stills'])} foto, video: {'da' if manifest['fountain']['video'] else 'ne'} · vrata: {len(manifest['door']['stills'])} foto, video: {'da' if manifest['door']['video'] else 'ne'})")
PY
echo "✓ Gotovo. Pokrenite  npm run build  (ili npm run dev) da vidite intro."
