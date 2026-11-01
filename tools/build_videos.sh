#!/usr/bin/env bash
# Build web-ready, muted H.264 videos and WebP posters for the PMC site.
# Usage: tools/build_videos.sh <assets_dir> <live_site_media_dir> <site_root>
set -euo pipefail
A="$1"; L="$2"; OUT="$3/assets/video"
mkdir -p "$OUT"
X264=(-c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -movflags +faststart -an)

poster() { # file seconds
  ffmpeg -v error -y -ss "$2" -i "$OUT/$1.mp4" -frames:v 1 -c:v libwebp -quality 72 "$OUT/$1.webp"
}

clip() { # name input start duration filter crf
  ffmpeg -v error -y -ss "$3" -t "$4" -i "$2" -vf "$5" "${X264[@]}" -crf "$6" "$OUT/$1.mp4"
}

LAND="scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,fps=30"
PORT="scale=540:960:force_original_aspect_ratio=increase,crop=540:960,fps=30"

# Hero montage: VMC coolant, two grinding shots, assembly line.
ffmpeg -v error -y \
  -ss 22.9 -t 3.3 -i "$A/IMG_2285.MOV" \
  -ss 13 -t 4 -i "$A/IMG_1854.MOV" \
  -ss 19 -t 4 -i "$A/IMG_1854.MOV" \
  -ss 14 -t 4 -i "$A/IMG_2173.MOV" \
  -filter_complex "\
[0:v]crop=900:506:0:930,scale=1280:720,fps=30,setsar=1,format=yuv420p[a];\
[1:v]$LAND,setsar=1,format=yuv420p[b];\
[2:v]$LAND,setsar=1,format=yuv420p[c];\
[3:v]$LAND,setsar=1,format=yuv420p[d];\
[a][b]xfade=transition=fade:duration=0.6:offset=2.7[ab];\
[ab][c]xfade=transition=fade:duration=0.6:offset=6.1[abc];\
[abc][d]xfade=transition=fade:duration=0.6:offset=9.5[v]" \
  -map "[v]" "${X264[@]}" -crf 28 "$OUT/hero.mp4"
poster hero 1.2

clip loop-fabrication  "$A/IMG_1854.MOV" 2 10 "$LAND" 28;  poster loop-fabrication 1
clip loop-assembly     "$A/IMG_2173.MOV" 10 12 "$LAND" 28; poster loop-assembly 4
clip fab-floor         "$A/IMG_1847.MOV" 0 9 "$LAND" 28;   poster fab-floor 2
clip fabrication-tour  "$A/Fabrication.mp4" 0 26 "$LAND" 27; poster fabrication-tour 15
clip reel-machining    "$A/IMG_2285.MOV" 0 27 "$PORT" 28;  poster reel-machining 23
clip reel-castings     "$A/IMG_2159.MOV" 0 7 "$PORT" 28;   poster reel-castings 1
clip reel-assemblies   "$A/IMG_2164.MOV" 0 6 "$PORT" 28;   poster reel-assemblies 1
clip diecast-facility  "$L/5a9cae560aa48d5b82367758e1ea284e.mp4" 0 28 "$LAND" 28; poster diecast-facility 3
clip project-drivetrain       "$L/9214f9171ef3dd3458db57e2d9c06757.mp4" 0 73 "$LAND" 29; poster project-drivetrain 8
clip project-drivetrain-bench "$L/ad442709324e2f98293f5b85d9893f7c.mp4" 0 21 "$LAND" 28; poster project-drivetrain-bench 5
clip project-powerfeed        "$L/fdfc8a95f8ef53e52e3144cbc25234c5.mp4" 0 45 "$LAND" 29; poster project-powerfeed 10
clip project-powerfeed-short  "$L/d2f00f7f500f1ffca2cb762f81fa7a6a.mp4" 0 8 "$LAND" 28;  poster project-powerfeed-short 2
ls -la "$OUT"
