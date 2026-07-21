# Isle of Man TT advert - 3-pass VFX overlay via ffmpeg filtergraph
#
# Layered onto the real TT event-summary video, scored with a neurofunk track.
# Follows the render-mbende.ps1 pattern: single -filter_complex pass, source audio
# dropped, music mapped, -shortest. The web/src/effects/camera/{distortion,hud}
# modules are used as visual INSPIRATION only - the looks are reproduced with
# ffmpeg filters here.
#
# Three passes on a 20s grid (12 blocks, T = 0,20,...,220):
#   Pass 1 measurement : T+0..T+2   telemetry HUD stamped with REAL vibrio numbers
#   Slot A             : T+5..T+10   (5s)
#   Slot B             : T+15..T+20  (5s)
# Slots alternate per block: even block -> A=distortion, B=camera;
#                            odd  block -> A=camera,     B=distortion.
# Which distortion look / camera skin is used rotates across blocks so no two
# blocks look identical. Gaps [2..5],[10..15],[block end] are clean footage.
#
# Pass 1 values come from out/tt_vibrio/vibrio_beats.json (run_vibrio pipeline).

Set-Location "c:\Users\kunda\Documents\portfolio\pugachev-cobra"

$VIDEO = "assets/isle-of-man/isle_of_man.webm"
$AUDIO = "assets/isle-of-man/billain-feed-for-speed.mp3"
$BEATS = "out/tt_vibrio/vibrio_beats.json"
$OUT   = "renders/isle-of-man.mp4"
# Colon escaped as 'C\:' — inside drawtext, ':' separates options even within
# single quotes, so an unescaped Windows drive path breaks the filtergraph.
$FONT  = "C\:/Windows/Fonts/cour.ttf"
$W = 1920; $H = 1080
$BLOCK = 20.0            # seconds per block
$NBLOCKS = 12           # 240s / 20s

New-Item -ItemType Directory -Force renders | Out-Null

# ---- Load vibrio beats (real measurements) --------------------------
# Keyed by window_index. Missing beats degrade gracefully to "--".
$beatByWin = @{}
if (Test-Path $BEATS) {
    $bj = Get-Content $BEATS -Raw | ConvertFrom-Json
    foreach ($b in $bj.beats) { $beatByWin[[int]$b.window_index] = $b }
    Write-Host "Loaded $($bj.beats.Count) vibrio beats from $BEATS"
} else {
    Write-Host "WARNING: $BEATS not found - measurement overlay will show placeholders."
}

# Pull a numeric field off a beat, formatted, or '--' if absent.
# Uses InvariantCulture so decimals are '.' not ',' - a locale comma (e.g. German
# Windows renders 0.04 as "0,04") would split the ffmpeg filtergraph on the comma.
$IC = [System.Globalization.CultureInfo]::InvariantCulture
function bval($b, $key, $fmt = "N1") {
    if ($null -eq $b) { return "--" }
    $v = $b.$key
    if ($null -eq $v) { return "--" }
    try { return ([double]$v).ToString($fmt, $IC) } catch { return "$v" }
}

# ---- Fade alpha (fade in 0.4s, hold, fade out 0.4s) -----------------
function fade($s, $dur) {
    $e = $s + $dur
    $fi = $s + 0.4
    $fo = $e - 0.4
    "if(between(t\,$s\,$e)\,if(lt(t\,$fi)\,(t-$s)/0.4\,if(gt(t\,$fo)\,($e-t)/0.4\,1))\,0)"
}

$f = @()

# ============================================================================
# Distortion looks (Wrecking Pendulum inspiration: bulge / RGB-split / ripple).
# Each returns filter stages gated to [s,e]. `variant` rotates the look.
# ============================================================================
function distortion_stages($s, $e, $variant) {
    $en = "enable='between(t,$s,$e)'"
    $out = @()
    switch ($variant % 3) {
        0 {
            # RGB-split + chroma shove - the "pendulum swing" smear
            $out += "chromashift=crh=40:crv=0:cbh=-40:cbv=0:$en"
            $out += "eq=contrast=1.4:saturation=1.6:$en"
        }
        1 {
            # Radial bulge - lens pinch, the wrecking-ball lens
            $out += "lenscorrection=k1=0.6:k2=0.3:$en"
            $out += "chromashift=crh=18:cbh=-18:$en"
        }
        2 {
            # Glitch ripple - noise burst + hard RGB tear + hue kick
            $out += "noise=alls=48:allf=t+u:$en"
            $out += "chromashift=crh=60:crv=8:cbh=-60:cbv=-8:$en"
            $out += "hue=H=3.14:$en"
        }
    }
    return $out
}

# ============================================================================
# Camera looks (HUD inspiration: REC badge, timecode, grid, reticle, CCTV).
# drawtext/drawbox/drawgrid gated to [s,e]. `variant` rotates the skin.
# ============================================================================
function camera_stages($s, $e, $variant) {
    $en = "enable='between(t,$s,$e)'"
    $a  = fade $s ($e - $s)
    $out = @()
    switch ($variant % 3) {
        0 {
            # Broadcast: rule-of-thirds grid + REC badge + running timecode
            $out += "drawgrid=w=iw/3:h=ih/3:t=2:color=white@0.35:$en"
            $out += "drawtext=fontfile='$FONT':text='REC':fontsize=44:fontcolor=0xFF3B30FF:x=90:y=70:alpha='$a':enable='between(t,$s,$e)':shadowcolor=black:shadowx=2:shadowy=2"
            $out += "drawbox=x=54:y=78:w=26:h=26:color=0xFF3B30FF:t=fill:enable='between(t,$s,$e)'"
            # HH:MM:SS:FF timecode driven off t
            $out += "drawtext=fontfile='$FONT':text='%{pts\:hms}':fontsize=34:fontcolor=white:x=w-tw-90:y=70:alpha='$a':enable='between(t,$s,$e)':shadowcolor=black:shadowx=2:shadowy=2"
        }
        1 {
            # Action cam: centre focus reticle + corner ticks
            $out += "drawbox=x=(iw-260)/2:y=(ih-260)/2:w=260:h=260:color=white@0.6:t=3:enable='between(t,$s,$e)'"
            $out += "drawbox=x=(iw-8)/2:y=(ih-8)/2:w=8:h=8:color=0x00FF66FF:t=fill:enable='between(t,$s,$e)'"
            # drawtext uses W/H (main dims) + w/h (text dims); iw/ih are NOT valid here.
            $out += "drawtext=fontfile='$FONT':text='AF':fontsize=30:fontcolor=0x00FF66FF:x=(W-260)/2:y=(H-260)/2-40:alpha='$a':enable='between(t,$s,$e)'"
            $out += "vignette=PI/4:enable='between(t,$s,$e)'"
        }
        2 {
            # CCTV: desaturate + scanline + timecode + blinking dot
            $out += "eq=saturation=0.25:contrast=1.2:$en"
            $out += "drawtext=fontfile='$FONT':text='CAM 04  %{pts\:hms}':fontsize=32:fontcolor=0xC8C8C8FF:x=80:y=h-70:alpha='$a':enable='between(t,$s,$e)'"
            # blink: dot visible on even half-seconds
            $out += "drawbox=x=w-80:y=70:w=24:h=24:color=0xFF3B30FF:t=fill:enable='between(t,$s,$e)*lt(mod(t\,1)\,0.5)'"
        }
    }
    return $out
}

# ============================================================================
# Pass 1 - measurement telemetry HUD, stamped with real vibrio numbers.
# ============================================================================
function measurement_stages($s, $e, $beat) {
    $a = fade $s ($e - $s)
    $en = "between(t,$s,$e)"
    # Real vibrio values (accuracy irrelevant - these ARE the vfx)
    # F-format (fixed-point) not N - N adds a thousands separator ',' that would
    # split the filtergraph. InvariantCulture keeps the decimal point a '.'.
    $flow   = bval $beat "optical_flow.mean_flow_magnitude" "F2"
    $energy = bval $beat "motion_energy.motion_energy"      "F1"
    $events = bval $beat "neuromorphic.total_events"        "F0"
    $kmh    = bval $beat "speed_kmh"                        "F1"
    $tex    = bval $beat "texture_analysis.muscle_tension"  "F1"

    # sanitise ':' which would break the filtergraph; keep as spaced labels
    $lines = @(
        "FLOW  $flow",
        "ENERGY  $energy",
        "EVENTS  $events",
        "SPD  $kmh KMH",
        "TENS  $tex"
    )
    $out = @()
    # translucent backing panel
    $out += "drawbox=x=70:y=h/2-140:w=430:h=270:color=black@0.45:t=fill:enable='$en'"
    $out += "drawtext=fontfile='$FONT':text='VIBRIO TELEMETRY':fontsize=30:fontcolor=0x00E5FFFF:x=90:y=h/2-130:alpha='$a':enable='$en':shadowcolor=black:shadowx=2:shadowy=2"
    $yy = 0
    foreach ($ln in $lines) {
        $y = "h/2-80+$($yy*44)"
        # $($y) not $y: — a bare $var followed by ':' is parsed as a $scope:name
        # reference (like $env:PATH), which silently drops the rest of the string.
        $out += "drawtext=fontfile='$FONT':text='$ln':fontsize=34:fontcolor=0xE8E8E8FF:x=90:y=$($y):alpha='$a':enable='$en':shadowcolor=black:shadowx=1:shadowy=1"
        $yy++
    }
    return $out
}

# ============================================================================
# Assemble all blocks.
# ============================================================================
for ($blk = 0; $blk -lt $NBLOCKS; $blk++) {
    $T = $blk * $BLOCK

    # Pass 1: measurement window [T, T+2]
    $beat = if ($beatByWin.ContainsKey($blk)) { $beatByWin[$blk] } else { $null }
    $f += measurement_stages $T ($T + 2) $beat

    # Slots: even block -> A=distortion, B=camera; odd -> swapped
    $slotA_s = $T + 5;  $slotA_e = $T + 10
    $slotB_s = $T + 15; $slotB_e = $T + 20

    if ($blk % 2 -eq 0) {
        $f += distortion_stages $slotA_s $slotA_e $blk
        $f += camera_stages     $slotB_s $slotB_e $blk
    } else {
        $f += camera_stages     $slotA_s $slotA_e $blk
        $f += distortion_stages $slotB_s $slotB_e $blk
    }
}

# Scale source to 1080p first, then apply everything.
$filter_str = "[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1," + ($f -join ",") + "[vout]"

# Write the filtergraph to a file and feed ffmpeg via -/filter_complex. Passing a
# long filtergraph as a splatted argument gets mangled by PowerShell 5.1's native-
# command arg handling (single quotes stripped, so a Windows path 'C:/...' breaks
# on its ':'). A script file is read verbatim by ffmpeg — no shell/splat parsing.
$filterFile = Join-Path $env:TEMP "iom_filter.txt"
[System.IO.File]::WriteAllText($filterFile, $filter_str, (New-Object System.Text.UTF8Encoding $false))

Write-Host "Rendering isle-of-man.mp4..."
Write-Host "Filter has $($f.Count) stages across $NBLOCKS blocks"
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
