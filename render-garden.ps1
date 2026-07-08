Set-Location "c:\Users\kunda\Documents\portfolio\pugachev-cobra"
New-Item -ItemType Directory -Force renders | Out-Null

$filterFile = "renders\garden-filter.txt"
$OUT = "renders/garden.mp4"

# 20 clips, each looped to exact duration, one stateless effect each
# Total: 11*11 + 9*12 = 121 + 108 = 229s (audio is 224s, -shortest trims)
# NO zoompan, NO fade, NO buffering filters — all effects are per-frame stateless
$filter = @'
[1:v]loop=loop=-1:size=32767:start=0,trim=duration=11,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,geq=r='min(255\,r(X\,Y)*2.0+40)':g='g(X\,Y)*0.35':b='b(X\,Y)*0.25',noise=alls=30:allf=t+u[v01];
[2:v]loop=loop=-1:size=32767:start=0,trim=duration=11,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,negate,eq=contrast=2.5:saturation=0:brightness=0.1[v02];
[3:v]loop=loop=-1:size=32767:start=0,trim=duration=11,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,geq=lum='lum(X+15*sin(2*3.14159*Y/120+T*3)\,Y)':cb='cb(X+15*sin(2*3.14159*Y/120+T*3)\,Y)':cr='cr(X+15*sin(2*3.14159*Y/120+T*3)\,Y)'[v03];
[4:v]loop=loop=-1:size=32767:start=0,trim=duration=11,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,chromashift=crh=30:crv=0:cbh=-30:cbv=0,noise=alls=50:allf=t+u[v04];
[5:v]loop=loop=-1:size=32767:start=0,trim=duration=11,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,hue=s=0.3,geq=r='min(255\,r(X\,Y)*1.2+20)':g='min(255\,g(X\,Y)*1.0+10)':b='max(0\,b(X\,Y)*0.7-10)',vignette=PI/3[v05];
[6:v]loop=loop=-1:size=32767:start=0,trim=duration=11,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,boxblur=luma_radius=18:luma_power=1[v06];
[7:v]loop=loop=-1:size=32767:start=0,trim=duration=11,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,hue=H=2*3.14159*t/11,eq=saturation=3:contrast=1.5[v07];
[8:v]loop=loop=-1:size=32767:start=0,trim=duration=11,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,vignette=PI/2.5,chromashift=crh=20:crv=0:cbh=-20:cbv=0[v08];
[9:v]loop=loop=-1:size=32767:start=0,trim=duration=11,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,chromashift=crh=50:crv=0:cbh=-50:cbv=0,eq=contrast=4:saturation=0,noise=alls=20:allf=t[v09];
[10:v]loop=loop=-1:size=32767:start=0,trim=duration=11,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,negate,eq=contrast=3:brightness=0.15:saturation=0[v10];
[11:v]loop=loop=-1:size=32767:start=0,trim=duration=11,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,hue=s=0,geq=lum='lum(X\,Y)*if(mod(Y\,2)\,0.3\,1)':cb=128:cr=128[v11];
[12:v]loop=loop=-1:size=32767:start=0,trim=duration=12,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,geq=lum='lum(X+20*sin(2*3.14159*Y/80+T*5)\,Y)':cb='cb(X+20*sin(2*3.14159*Y/80+T*5)\,Y)':cr='cr(X+20*sin(2*3.14159*Y/80+T*5)\,Y)'[v12];
[13:v]loop=loop=-1:size=32767:start=0,trim=duration=12,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,negate,boxblur=luma_radius=6:luma_power=1,chromashift=crh=20:crv=0:cbh=-20:cbv=0[v13];
[14:v]loop=loop=-1:size=32767:start=0,trim=duration=12,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,hue=H=3.14159*t/6,eq=saturation=4:contrast=1.6[v14];
[15:v]loop=loop=-1:size=32767:start=0,trim=duration=12,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,hue=s=0.3,geq=r='min(255\,r(X\,Y)*1.3+25)':g='min(255\,g(X\,Y)*1.1+10)':b='max(0\,b(X\,Y)*0.6-5)',chromashift=crh=10:crv=0:cbh=-10:cbv=0,noise=alls=15:allf=u[v15];
[16:v]loop=loop=-1:size=32767:start=0,trim=duration=12,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,geq=r='min(255\,r(X\,Y)*1.1+15)':g='min(255\,g(X\,Y)*1.0+5)':b='max(0\,b(X\,Y)*0.8-10)'[v16];
[17:v]loop=loop=-1:size=32767:start=0,trim=duration=12,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,geq=r='min(255\,r(X\,Y)*2.2+60)':g='g(X\,Y)*0.35':b='g(X\,Y)*0.2',noise=alls=35:allf=t+u,vignette=PI/2[v17];
[18:v]loop=loop=-1:size=32767:start=0,trim=duration=12,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,negate,chromashift=crh=45:crv=0:cbh=-45:cbv=0,eq=contrast=3.5:saturation=0[v18];
[19:v]loop=loop=-1:size=32767:start=0,trim=duration=12,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,geq=r='min(255\,r(X\,Y)*2.5)':g='g(X\,Y)*0.4':b='b(X\,Y)*0.2',noise=alls=45:allf=t+u[v19];
[20:v]loop=loop=-1:size=32767:start=0,trim=duration=12,setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,hue=H=3.14159*t/3,eq=saturation=5:contrast=1.8,chromashift=crh=35:crv=0:cbh=-35:cbv=0[v20];
[v01][v02][v03][v04][v05][v06][v07][v08][v09][v10][v11][v12][v13][v14][v15][v16][v17][v18][v19][v20]concat=n=20:v=1:a=0[vout]
'@

[System.IO.File]::WriteAllText(
    (Join-Path (Get-Location) $filterFile),
    $filter,
    (New-Object System.Text.UTF8Encoding $false)
)

Write-Host "Filter written. Running ffmpeg..."

$inputs = @(
    "-i", "assets/garden/billain-bilocation.mp3",
    "-stream_loop", "-1", "-i", "assets/garden/bosch-hell.mkv",
    "-stream_loop", "-1", "-i", "assets/garden/central-panel.mkv",
    "-stream_loop", "-1", "-i", "assets/garden/bosch-01.mkv",
    "-stream_loop", "-1", "-i", "assets/garden/bosch-fire.mkv",
    "-stream_loop", "-1", "-i", "assets/garden/bosch-03.mkv",
    "-stream_loop", "-1", "-i", "assets/garden/bosch-owl.mkv",
    "-stream_loop", "-1", "-i", "assets/garden/bosch-monks.mkv",
    "-stream_loop", "-1", "-i", "assets/garden/bosch-02.mkv",
    "-stream_loop", "-1", "-i", "assets/garden/bosch-trip.mkv",
    "-stream_loop", "-1", "-i", "assets/garden/bosch-04.mkv",
    "-stream_loop", "-1", "-i", "assets/garden/owl-in-your-face.mkv",
    "-stream_loop", "-1", "-i", "assets/garden/bosch-11.mkv",
    "-stream_loop", "-1", "-i", "assets/garden/bosch-05.mkv",
    "-stream_loop", "-1", "-i", "assets/garden/bosch-06.mkv",
    "-stream_loop", "-1", "-i", "assets/garden/bosch-07.mkv",
    "-stream_loop", "-1", "-i", "assets/garden/verse.mkv",
    "-stream_loop", "-1", "-i", "assets/garden/bosch-08.mkv",
    "-stream_loop", "-1", "-i", "assets/garden/bosch-09.mkv",
    "-stream_loop", "-1", "-i", "assets/garden/bosch-12.mkv",
    "-stream_loop", "-1", "-i", "assets/garden/bosch-13.mkv"
)

$ffargs = $inputs + @(
    "-/filter_complex", $filterFile,
    "-map", "[vout]",
    "-map", "0:a:0",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "18",
    "-c:a", "aac",
    "-b:a", "192k",
    "-shortest",
    "-y",
    $OUT
)

& ffmpeg @ffargs

if ($LASTEXITCODE -eq 0) {
    $size = [math]::Round((Get-Item $OUT).Length / 1MB, 1)
    Write-Host "Done: $OUT ($size MB)"
} else {
    Write-Host "ffmpeg failed - exit $LASTEXITCODE"
}
