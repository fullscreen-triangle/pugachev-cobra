Set-Location "c:\Users\kunda\Documents\portfolio\pugachev-cobra"
New-Item -ItemType Directory -Force renders\garden_segments | Out-Null

$clips = @(
    @{ src="assets/garden/bosch-hell.mkv";      dur=11; fx="geq=r='min(255\,r(X\,Y)*2.0+40)':g='g(X\,Y)*0.35':b='b(X\,Y)*0.25',noise=alls=30:allf=t+u" },
    @{ src="assets/garden/central-panel.mkv";   dur=11; fx="negate,eq=contrast=2.5:saturation=0:brightness=0.1" },
    @{ src="assets/garden/bosch-01.mkv";        dur=11; fx="chromashift=crh=30:crv=0:cbh=-30:cbv=0,noise=alls=50:allf=t+u" },
    @{ src="assets/garden/bosch-fire.mkv";      dur=11; fx="hue=s=0.3,geq=r='min(255\,r(X\,Y)*1.2+20)':g='min(255\,g(X\,Y)*1.0+10)':b='max(0\,b(X\,Y)*0.7-10)',vignette=PI/3" },
    @{ src="assets/garden/bosch-03.mkv";        dur=11; fx="boxblur=luma_radius=18:luma_power=1" },
    @{ src="assets/garden/bosch-owl.mkv";       dur=11; fx="hue=H=2*3.14159*t/11,eq=saturation=3:contrast=1.5" },
    @{ src="assets/garden/bosch-monks.mkv";     dur=11; fx="vignette=PI/2.5,chromashift=crh=20:crv=0:cbh=-20:cbv=0" },
    @{ src="assets/garden/bosch-02.mkv";        dur=11; fx="chromashift=crh=50:crv=0:cbh=-50:cbv=0,eq=contrast=4:saturation=0" },
    @{ src="assets/garden/bosch-trip.mkv";      dur=11; fx="negate,eq=contrast=3:brightness=0.15:saturation=0" },
    @{ src="assets/garden/bosch-04.mkv";        dur=11; fx="hue=s=0,geq=lum='lum(X\,Y)*if(mod(Y\,2)\,0.3\,1)':cb=128:cr=128" },
    @{ src="assets/garden/owl-in-your-face.mkv";dur=11; fx="negate,chromashift=crh=30:crv=0:cbh=-30:cbv=0" },
    @{ src="assets/garden/bosch-11.mkv";        dur=12; fx="hue=H=3.14159*t/6,eq=saturation=4:contrast=1.6" },
    @{ src="assets/garden/bosch-05.mkv";        dur=12; fx="hue=s=0.3,geq=r='min(255\,r(X\,Y)*1.3+25)':g='min(255\,g(X\,Y)*1.1+10)':b='max(0\,b(X\,Y)*0.6-5)'" },
    @{ src="assets/garden/bosch-06.mkv";        dur=12; fx="geq=r='min(255\,r(X\,Y)*1.1+15)':g='min(255\,g(X\,Y)*1.0+5)':b='max(0\,b(X\,Y)*0.8-10)'" },
    @{ src="assets/garden/bosch-07.mkv";        dur=12; fx="geq=r='min(255\,r(X\,Y)*2.2+60)':g='g(X\,Y)*0.35':b='g(X\,Y)*0.2',noise=alls=35:allf=t+u" },
    @{ src="assets/garden/verse.mkv";           dur=12; fx="negate,chromashift=crh=45:crv=0:cbh=-45:cbv=0,eq=contrast=3.5:saturation=0" },
    @{ src="assets/garden/bosch-08.mkv";        dur=12; fx="hue=H=3.14159*t/3,eq=saturation=5:contrast=1.8" },
    @{ src="assets/garden/bosch-09.mkv";        dur=12; fx="geq=r='min(255\,r(X\,Y)*2.5)':g='g(X\,Y)*0.4':b='b(X\,Y)*0.2',noise=alls=45:allf=t+u" },
    @{ src="assets/garden/bosch-12.mkv";        dur=12; fx="chromashift=crh=35:crv=0:cbh=-35:cbv=0,noise=alls=25:allf=t" },
    @{ src="assets/garden/bosch-13.mkv";        dur=12; fx="negate,eq=contrast=2.8:saturation=0,noise=alls=15:allf=u" }
)

# Step 1: render each clip independently
$segFiles = @()
for ($i = 0; $i -lt $clips.Count; $i++) {
    $c = $clips[$i]
    $out = "renders\garden_segments\seg{0:D2}.mp4" -f $i
    $segFiles += $out
    if (Test-Path $out) { Write-Host "skip $out"; continue }
    Write-Host "Segment $i / $($clips.Count-1): $($c.src)"
    $vf = "scale=1920:1080,setsar=1,$($c.fx)"
    & ffmpeg -stream_loop -1 -i $c.src -t $c.dur -vf $vf -an -c:v libx264 -preset fast -crf 20 -y $out 2>&1 | Select-String "error|Error|invalid" | Write-Host
    if ($LASTEXITCODE -ne 0) { Write-Host "FAILED segment $i"; exit 1 }
}

# Step 2: concat all segments
$concatList = "renders\garden_segments\concat.txt"
$concatContent = ($segFiles | ForEach-Object { "file '$(Resolve-Path $_)'" }) -join "`n"
[System.IO.File]::WriteAllText((Join-Path (Get-Location) $concatList), $concatContent, (New-Object System.Text.UTF8Encoding $false))

Write-Host "Concatenating..."
& ffmpeg -f concat -safe 0 -i $concatList -i "assets/garden/billain-bilocation.mp3" -map 0:v -map 1:a -c:v libx264 -preset fast -crf 18 -r 25 -c:a aac -b:a 192k -shortest -y "renders/garden.mp4"

if ($LASTEXITCODE -eq 0) {
    $size = [math]::Round((Get-Item "renders/garden.mp4").Length / 1MB, 1)
    Write-Host "Done: renders/garden.mp4 ($size MB)"
} else {
    Write-Host "Concat failed - exit $LASTEXITCODE"
}
