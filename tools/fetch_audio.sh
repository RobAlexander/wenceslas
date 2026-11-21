#!/bin/sh
# Downloads the third-party source audio into audio/source/ (not shipped, not in git).
# Each pack goes in its own directory. Run tools/build_sounds.py afterwards.
set -eu
cd "$(dirname "$0")/.."

fetch() {  # fetch NAME URL
  dir="audio/source/$1"
  if [ -d "$dir" ] && [ -n "$(ls -A "$dir" 2>/dev/null)" ]; then echo "$1: already downloaded"; return; fi
  mkdir -p "$dir"
  curl -fsS --max-time 120 -A "wenceslas-game-dev-script" -o "audio/source/$1.zip" "$2"
  unzip -q -o "audio/source/$1.zip" -d "$dir"
  echo "$1: downloaded"
}

# "50 RPG sound effects" by Kenney Vleugels, CC0, hosted on OpenGameArt.
# https://opengameart.org/content/50-rpg-sound-effects
fetch rpg-sounds-kenney https://opengameart.org/sites/default/files/RPGsounds_Kenney.zip
