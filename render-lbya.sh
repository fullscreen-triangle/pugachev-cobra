#!/usr/bin/env bash
# Renders "Leave Before You Arrive" to MP4 using ffmpeg directly.
# Run from the project root: bash render-lbya.sh

set -e

SEQ="assets/leave-before-you-arrive/sequence"
AUDIO="assets/leave-before-you-arrive/merikan-face-off-clip.mp3"
TMPDIR="$(mktemp -d)"
OUT="renders/leave-before-you-arrive-$(date +%s).mp4"

mkdir -p renders

echo "==> Temp dir: $TMPDIR"

# ---- Step 1: normalise each clip to 30fps 1920x1080 h264, no audio ----

clips=(
  "01_gibbon-01.mp4"
  "02_beamon-01.mp4"
  "03_powell-01.mp4"
  "04_zoom-climb-01.mp4"
  "05_powell-last1s.mp4"
  "06_beamon-01-last1s.mp4"
  "07_lufthansa-jump-02.mp4"
  "08_beamon-02.mp4"
  "09_lufthansa-jump.mp4"
  "10_powell-01-full.mp4"
  "11_longjump-4to7.mp4"
  "12_beamon-02-full.mp4"
  "13_zoom-climb-02.mp4"
)

CONCAT_LIST="$TMPDIR/concat.txt"
> "$CONCAT_LIST"

for clip in "${clips[@]}"; do
  name="${clip%.mp4}"
  norm="$TMPDIR/${name}_norm.mp4"
  echo "  encoding $clip ..."
  ffmpeg -y -i "$SEQ/$clip" \
    -vf "fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1" \
    -c:v libx264 -preset fast -crf 18 -an \
    "$norm" 2>/dev/null
  echo "file '$norm'" >> "$CONCAT_LIST"
done

# ---- Step 2: concatenate all normalised clips -------------------------

echo "==> Concatenating ..."
CONCAT_OUT="$TMPDIR/concat.mp4"
ffmpeg -y -f concat -safe 0 -i "$CONCAT_LIST" -c copy "$CONCAT_OUT" 2>/dev/null

# ---- Step 3: mix in audio, trim to video length ----------------------

echo "==> Mixing audio ..."
ffmpeg -y \
  -i "$CONCAT_OUT" \
  -i "$AUDIO" \
  -map 0:v:0 -map 1:a:0 \
  -c:v copy -c:a aac -b:a 192k \
  -shortest \
  "$OUT"

echo ""
echo "Done: $OUT"

# ---- Cleanup ----------------------------------------------------------
rm -rf "$TMPDIR"
