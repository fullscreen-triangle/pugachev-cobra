# Mbende documentary render — ffmpeg filtergraph
# Mutes video audio, replaces with phace-noise-cut.mp3
# Burns in 10 effect windows (3s each, every 15s from 0.03s)
# Burns in 9 text paragraphs from 20s (12s each, 4s gap)

Set-Location "c:\Users\kunda\Documents\portfolio\pugachev-cobra"

$VIDEO = "assets/mbende/mbende.mp4"
$AUDIO = "assets/mbende/phace-noise-cut.mp3"
$OUT   = "renders/mbende-v2.mp4"
$FONT  = "C:/Windows/Fonts/cour.ttf"
$W = 1920; $H = 1080

New-Item -ItemType Directory -Force renders | Out-Null

# ---- Effect windows (start, end) ------------------------------------
$effects = @(
    @(0.03,   3.03,  "vhs"),
    @(15.03,  18.03, "bw"),
    @(30.03,  33.03, "scanlines"),
    @(45.03,  48.03, "scanlines"),
    @(60.03,  63.03, "glitch"),
    @(75.03,  78.03, "invert"),
    @(90.03,  93.03, "posterize"),
    @(105.03, 108.03,"scanlines"),
    @(120.03, 123.03,"vhs"),
    @(135.03, 138.03,"bw")
)

# ---- Text paragraphs -------------------------------------------------
$paras = @(
    @{ fw="Mbende";        r1="is a popular dance style";              r2="practised by the Zezuru of Murehwa";           col="white" },
    @{ fw="Characterised"; r1="by acrobatic and sensual movements";    r2="the encounter is meant to feel good";          col="yellow" },
    @{ fw="The";           r1="dance was named Mbende before colonialism"; r2="wrapped as fertility - pleasure costs labour"; col="white" },
    @{ fw="Colonial";      r1="social pressure forced a name change";  r2="to Jerusarema - to remove sexual connotations"; col="red" },
    @{ fw="Couples";       r1="take turns dancing in the centre";      r2="a front flip is required for flair";           col="white" },
    @{ fw="Men";           r1="crouch, jerking their arms";            r2="vigorously kicking the ground - imitating a mole"; col="green" },
    @{ fw="Played";        r1="by a single polyrhythmic drummer";      r2="with clappers, triangles and women yodelling"; col="white" },
    @{ fw="Mbende";        r1="needs no footwork, no drummers";        r2="no songs or lyrics are involved";              col="yellow" },
    @{ fw="It";            r1="just has to be an encounter";           r2="sufficient to make one feel good";             col="white" }
)

# ---- Build enable expressions ----------------------------------------
function en($s, $e) { "between(t\,$s\,$e)" }

# ---- Build alpha fade expression for drawtext -----------------------
# fade in 0.5s, hold, fade out 0.4s within window [s, s+dur]
function fade($s, $dur) {
    $e = $s + $dur
    $fi = $s + 0.5
    $fo = $e - 0.4
    "if(between(t\,$s\,$e)\,if(lt(t\,$fi)\,(t-$s)/0.5\,if(gt(t\,$fo)\,($e-t)/0.4\,1))\,0)"
}

# ---- Assemble filter chain ------------------------------------------
$f = @()

# Step 1: effect filters — each only active in its window
foreach ($eff in $effects) {
    $s = $eff[0]; $e = $eff[1]; $kind = $eff[2]
    $en = "enable='between(t,$s,$e)'"
    switch ($kind) {
        "vhs" {
            $f += "noise=alls=35:allf=t+u:$en"
            $f += "chromashift=crh=6:cbh=-6:$en"
            $f += "eq=saturation=0.6:brightness=-0.06:$en"
        }
        "bw" {
            $f += "hue=s=0:$en"
        }
        "scanlines" {
            # darken every other pixel row
            $f += "geq=lum='lum(X\,Y)*if(mod(Y\,2)\,0.4\,1)':cb=128:cr=128:$en"
        }
        "glitch" {
            $f += "noise=alls=50:allf=t+u:$en"
            $f += "chromashift=crh=14:crv=4:cbh=-14:cbv=-4:$en"
            $f += "hue=H=3.14:$en"
        }
        "invert" {
            $f += "negate:$en"
        }
        "posterize" {
            $f += "elbg=codebook_length=8:$en"
        }
    }
}

# Step 2: text overlays
for ($i = 0; $i -lt 9; $i++) {
    $ts   = 20 + $i * 16       # text start
    $tdur = 12                  # text duration
    $te   = $ts + $tdur
    $p    = $paras[$i]
    $fw   = $p.fw -replace "'", ""
    $r1   = $p.r1 -replace "'", "" -replace ":", ""
    $r2   = $p.r2 -replace "'", "" -replace ":", ""

    # colour
    $fc = switch ($p.col) {
        "yellow" { "0xFFD700FF" }
        "red"    { "0xFF6666FF" }
        "green"  { "0xAAFFAAFF" }
        default  { "0xFFFFFFFF" }
    }
    $fc_dim = "0xFFFFFFCC"

    $alpha = fade $ts $tdur
    $en_expr = "between(t,$ts,$te)"

    # First word — motion trail: 3 ghost copies shifted left, then main
    foreach ($shift in @(28, 18, 9)) {
        $ghost_alpha = switch ($shift) { 28 { "0.08" } 18 { "0.18" } 9 { "0.30" } default { "0.08" } }
        $f += "drawtext=fontfile='$FONT':text='$fw':fontsize=74:fontcolor=$fc:x='(w-text_w)/2-$shift':y='h/2-130':alpha='$ghost_alpha*($alpha)':enable='$en_expr':shadowcolor=black:shadowx=2:shadowy=2"
    }
    # Main first word
    $f += "drawtext=fontfile='$FONT':text='$fw':fontsize=74:fontcolor=$fc:x='(w-text_w)/2':y='h/2-130':alpha='$alpha':enable='$en_expr':shadowcolor=black:shadowx=2:shadowy=2"

    # Body lines
    $f += "drawtext=fontfile='$FONT':text='$r1':fontsize=36:fontcolor=$fc_dim:x='(w-text_w)/2':y='h/2+10':alpha='$alpha':enable='$en_expr':shadowcolor=black:shadowx=1:shadowy=1"
    $f += "drawtext=fontfile='$FONT':text='$r2':fontsize=36:fontcolor=$fc_dim:x='(w-text_w)/2':y='h/2+58':alpha='$alpha':enable='$en_expr':shadowcolor=black:shadowx=1:shadowy=1"
}

# Join into one filter string
$filter_str = "[0:v]" + ($f -join ",") + "[vout]"

Write-Host "Rendering mbende-v2.mp4..."
Write-Host "Filter has $($f.Count) stages"

$ffargs = @(
    "-y",
    "-i", $VIDEO,
    "-i", $AUDIO,
    "-filter_complex", $filter_str,
    "-map", "[vout]",
    "-map", "1:a:0",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "18",
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
