

python -m yt_dlp -x --audio-format mp3 --audio-quality 0 -o "https://www.youtube.com/watch?v=fYB2BOHv7Oc"


python -m yt_dlp -x --audio-format mp3 --audio-quality 0 -o "C:\Users\kunda\Documents\portfolio\pugachev-cobra\web\public\audio\%(title)s.%(ext)s" "https://www.youtube.com/watch?v=AbDKDEeXdT8"

python -m yt_dlp -x --audio-format mp3 --audio-quality 0 -o "C:\Users\kunda\Documents\portfolio\pugachev-cobra\web\public\audio\%(title)s.%(ext)s" "https://www.youtube.com/watch?v=ItJEVRh2c5Y"


python -m yt_dlp -f "bestvideo+bestaudio" -o "C:\Users\kunda\Documents\portfolio\pugachev-cobra\web\public\albums\%(title)s.%(ext)s" "https://www.youtube.com/watch?v=Pbs80p4-nGM&list=PLzS6MPXNCdetRsc26UkoVP7_VCr5IzjRu"


python -m yt_dlp -f "bestvideo+bestaudio" -o "C:\Users\kunda\Documents\portfolio\pugachev-cobra\web\public\albums\%(title)s.%(ext)s" "https://www.youtube.com/watch?v=RMjBriOtDPw&list=PLzS6MPXNCdetRsc26UkoVP7_VCr5IzjRu&index=2"


python -m yt_dlp -f "bestvideo+bestaudio" -o "C:\Users\kunda\Documents\portfolio\pugachev-cobra\web\public\albums\%(title)s.%(ext)s" "YOUTUBE_URL"
