# Resilient-Wheels advert - ffmpeg base pass (segments 1,2,4,5; detection overlay
# for phase 3 is composited separately in Remotion). ASCII-only (PowerShell 5.1).
#
# Video 95.4s 1920x1080 25fps. Spec segments scaled x0.867 to fit:
#   0    - 8.7s  : ramp to MAX glitch
#   8.7 - 26s    : transition to thermal vision, max distortion at end
#   26  - 52s    : object-detection boxes (CLEAN base here; boxes added in Remotion)
#   52  - 78s    : edges of detected items -> wireframe (ramp)
#   78  - 95.4s  : progressively flip upside down (0 -> 180deg)
#
# Follows render-isle-of-man.ps1 conventions: filtergraph written to a file and fed
# via -/filter_complex (avoids PowerShell splat mangling); source audio dropped,
# music mapped, -shortest.

Set-Location "c:\Users\kunda\Documents\portfolio\pugachev-cobra"

$VIDEO = "assets/resiliant-wheels/2nd generation of resilient wheels.mkv"
$AUDIO = "assets/resiliant-wheels/icicle-imanu-preamble.mp3"
$OUT   = "renders/wheels-base.mp4"
$W = 1920; $H = 1080

New-Item -ItemType Directory -Force renders | Out-Null

# Segment boundaries (seconds), spec x0.867
$g_end  = 8.7     # glitch end
$t_end  = 26.0    # thermal end
$d_end  = 52.0    # detection end (clean base)
$w_end  = 78.0    # wireframe end
# flip runs w_end -> EOF (95.4)

$f = @()

# ---- Segment 1: ramp to MAX glitch [0, g_end] ------------------------------
# noise + chromashift + hue, strength ramping 0->1 over the segment. Amount is
# baked via enable-gated stacking; ramp approximated by scaling with (t/g_end).
# chromashift offset grows with time; noise is gated on.
$f += "noise=alls=40:allf=t+u:enable='between(t,0,$g_end)'"
# chroma split that widens over the segment: use two gated bands for a coarse ramp
$f += "chromashift=crh=10:cbh=-10:enable='between(t,0,$([math]::Round($g_end*0.5,2)))'"
$f += "chromashift=crh=40:crv=6:cbh=-40:cbv=-6:enable='between(t,$([math]::Round($g_end*0.5,2)),$g_end)'"
$f += "hue=H=3.14:enable='between(t,$([math]::Round($g_end*0.66,2)),$g_end)'"

# ---- Segment 2: thermal vision, max at end [g_end, t_end] -------------------
# pseudocolor magma over grayscale. Ramp the "distortion" by adding growing noise
# and a late chroma tear near the end. Base thermal is on for the whole segment.
# pseudocolor maps luma to a heat LUT directly - do NOT pre-convert to gray
# (format=gray collapses the frame and the colormap comes out monochrome).
$f += "pseudocolor=preset=magma:enable='between(t,$g_end,$t_end)'"
$f += "noise=alls=25:allf=t:enable='between(t,$([math]::Round($t_end-6,2)),$t_end)'"
$f += "chromashift=crh=30:cbh=-30:enable='between(t,$([math]::Round($t_end-3,2)),$t_end)'"

# ---- Segment 3: detection [t_end, d_end] : CLEAN base (Remotion adds boxes) --
# nothing here.

# ---- Segment 4: wireframe ramp [d_end, w_end] ------------------------------
# edgedetect colormix; ramp by starting subtle then full. Two gated stages.
$f += "edgedetect=low=0.1:high=0.3:mode=colormix:enable='between(t,$d_end,$([math]::Round(($d_end+$w_end)/2,2)))'"
$f += "edgedetect=low=0.06:high=0.5:mode=wires:enable='between(t,$([math]::Round(($d_end+$w_end)/2,2)),$w_end)'"

# ---- Segment 5: progressive flip to upside down [w_end, EOF] ----------------
# rotate from 0 to PI as t goes w_end -> EOF. rotate angle expr uses t directly.
# angle = PI * clamp((t-w_end)/(EOF-w_end),0,1); EOF ~= 95.4
$eof = 95.4
$span = $eof - $w_end
$f += "rotate='PI*min(max((t-$w_end)/$span\,0)\,1)':fillcolor=black:enable='between(t,$w_end,$eof)'"

# Base scale + assemble
$filter_str = "[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1," + ($f -join ",") + "[vout]"

$filterFile = Join-Path $env:TEMP "wheels_filter.txt"
[System.IO.File]::WriteAllText($filterFile, $filter_str, (New-Object System.Text.UTF8Encoding $false))

Write-Host "Rendering wheels-base.mp4..."
Write-Host "Filter has $($f.Count) stages"
Write-Host "Filtergraph -> $filterFile"

$ffargs = @(
    "-y",
    "-i", $VIDEO,
    "-i", $AUDIO,
    "-/filter_complex", $filterFile,
    "-map", "[vout]",
    "-map", "1:a:0",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "20",
    "-r", "25",
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
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
