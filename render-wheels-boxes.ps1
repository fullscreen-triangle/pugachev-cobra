# Resilient-Wheels advert - detection-box overlay pass (phase 3, 26-52s).
# Second pass over renders/wheels-base.mp4: draws UNLABELED boxes from the generic
# YOLO detection (out/wheels_det.json) as the "machine vision" effect. Kept separate
# from the base filtergraph so neither graph blows memory (the base already OOM'd
# when overloaded). ASCII-only, filter file via -/filter_complex.
#
# Boxes are normalised [0,1] in the JSON; drawbox wants pixels, so x*W etc. Each box
# is gated to its sample frame's time +/- the sample interval so it holds briefly.

Set-Location "c:\Users\kunda\Documents\portfolio\pugachev-cobra"

$BASE  = "renders/wheels-base.mp4"
$DET   = "out/wheels_det.json"
$OUT   = "renders/wheels.mp4"
$W = 1920; $H = 1080

$DET_START = 26.0    # detection phase begins
$DET_END   = 52.0    # detection phase ends
$FADE_END  = 78.0    # boxes fade out through the wireframe phase

if (-not (Test-Path $BASE)) { Write-Host "ERROR: $BASE not found - render base first"; exit 1 }

$dj = Get-Content $DET -Raw | ConvertFrom-Json
$fps = [double]$dj.meta.fps
$sample = [int]$dj.meta.sample_every
$hold = ($sample / $fps)   # seconds a sampled box persists

$f = @()
$nbox = 0
foreach ($fr in $dj.frames) {
    $t = [double]$fr.t_ms / 1000.0
    if ($t -lt $DET_START -or $t -gt $FADE_END) { continue }
    if ($fr.boxes.Count -eq 0) { continue }
    # box visible from its sample time until the next sample (hold), clamped.
    $ts = [math]::Round($t, 3)
    $te = [math]::Round($t + $hold, 3)
    # green in the detection phase, dimmer as it enters the wireframe fade.
    $col = if ($t -le $DET_END) { "0x00FF66FF" } else { "0x00FF6688" }
    foreach ($b in $fr.boxes) {
        $x = [math]::Round([double]$b.x * $W)
        $y = [math]::Round([double]$b.y * $H)
        $bw = [math]::Round([double]$b.w * $W)
        $bh = [math]::Round([double]$b.h * $H)
        if ($bw -le 1 -or $bh -le 1) { continue }
        $f += "drawbox=x=${x}:y=${y}:w=${bw}:h=${bh}:color=${col}:t=3:enable='between(t,$ts,$te)'"
        $nbox++
    }
}

Write-Host "Detection boxes: $nbox drawbox stages"

if ($nbox -eq 0) {
    Write-Host "No boxes in window - copying base to $OUT"
    Copy-Item $BASE $OUT -Force
    exit 0
}

$filter_str = "[0:v]" + ($f -join ",") + "[vout]"
$filterFile = Join-Path $env:TEMP "wheels_boxes_filter.txt"
[System.IO.File]::WriteAllText($filterFile, $filter_str, (New-Object System.Text.UTF8Encoding $false))

Write-Host "Filtergraph -> $filterFile"

# Copy audio from base (already muxed); just re-encode video with boxes burned in.
$ffargs = @(
    "-y",
    "-threads", "2", "-filter_threads", "2",
    "-i", $BASE,
    "-/filter_complex", $filterFile,
    "-map", "[vout]",
    "-map", "0:a:0",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "20",
    "-c:a", "copy",
    $OUT
)

& ffmpeg @ffargs

if ($LASTEXITCODE -eq 0) {
    $size = [math]::Round((Get-Item $OUT).Length / 1MB, 1)
    Write-Host ""
    Write-Host "Done: $OUT ($size MB)"
} else {
    Write-Host "ffmpeg failed with exit code $LASTEXITCODE"
}
