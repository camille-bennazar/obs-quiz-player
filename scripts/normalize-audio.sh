#!/usr/bin/env bash
# Aligne le volume des MP4 à -16 LUFS en deux passes, sans réencoder la vidéo.
set -euo pipefail
export LC_ALL=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BACKUP_ROOT="${BACKUP_ROOT:-media-originals}"
TARGET_I="-16"
TARGET_TP="-1.5"
TARGET_LRA="11"
NORMALIZED=0
SKIPPED=0
ERRORS=0

green() { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
red() { printf '\033[31m%s\033[0m\n' "$*"; }

json_value() {
  local key="$1"
  awk -v key="\"$key\"" '
    index($0, key) {
      sub(/^[^:]*:[[:space:]]*"/, "")
      sub(/".*$/, "")
      print
      exit
    }
  '
}

is_number() {
  [[ "$1" =~ ^-?[0-9]+([.][0-9]+)?$ ]]
}

already_at_target() {
  local loudness="$1"
  local true_peak="$2"
  awk -v i="$loudness" -v tp="$true_peak" '
    BEGIN {
      # Tolérance de 0,5 LU ; les crêtes doivent respecter la cible.
      exit !((i >= -16.5 && i <= -15.5) && tp <= -1.5)
    }
  '
}

normalize_file() {
  local file="$1"
  local tmp="${file%.mp4}.normalize-tmp.mp4"
  local analysis input_i input_tp input_lra input_thresh target_offset

  if ! ffprobe -v error -select_streams a:0 \
    -show_entries stream=index -of csv=p=0 "$file" | grep -q .; then
    yellow "[!] Sans piste audio, ignoré : $file"
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  printf '> Mesure : %s\n' "$file"
  if ! analysis="$(
    ffmpeg -nostdin -hide_banner -nostats -i "$file" -map 0:a:0 \
      -af "loudnorm=I=${TARGET_I}:TP=${TARGET_TP}:LRA=${TARGET_LRA}:print_format=json" \
      -f null - 2>&1
  )"; then
    red "[X] Mesure impossible : $file"
    ERRORS=$((ERRORS + 1))
    return
  fi

  input_i="$(printf '%s\n' "$analysis" | json_value input_i)"
  input_tp="$(printf '%s\n' "$analysis" | json_value input_tp)"
  input_lra="$(printf '%s\n' "$analysis" | json_value input_lra)"
  input_thresh="$(printf '%s\n' "$analysis" | json_value input_thresh)"
  target_offset="$(printf '%s\n' "$analysis" | json_value target_offset)"

  if ! is_number "$input_i" || ! is_number "$input_tp" ||
     ! is_number "$input_lra" || ! is_number "$input_thresh" ||
     ! is_number "$target_offset"; then
    yellow "[!] Piste silencieuse ou mesure inexploitable, ignorée : $file"
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  if already_at_target "$input_i" "$input_tp"; then
    green "[OK] Déjà au niveau cible (${input_i} LUFS) : $file"
    SKIPPED=$((SKIPPED + 1))
    return
  fi

  mkdir -p "$BACKUP_ROOT/$(dirname "$file")"
  cp -n "$file" "$BACKUP_ROOT/$file"
  rm -f "$tmp"

  printf '[*] Normalisation : %s LUFS -> %s LUFS\n' "$input_i" "$TARGET_I"
  if ffmpeg -nostdin -hide_banner -loglevel error -y -i "$file" \
    -map 0:v:0 -map 0:a:0 -map_metadata 0 -map_chapters 0 \
    -c:v copy -c:a aac -b:a 192k -ar 48000 \
    -af "loudnorm=I=${TARGET_I}:TP=${TARGET_TP}:LRA=${TARGET_LRA}:measured_I=${input_i}:measured_TP=${input_tp}:measured_LRA=${input_lra}:measured_thresh=${input_thresh}:offset=${target_offset}:linear=true:print_format=summary" \
    -movflags +faststart "$tmp" &&
     ffprobe -v error -select_streams v:0 -show_entries stream=index -of csv=p=0 "$tmp" | grep -q . &&
     ffprobe -v error -select_streams a:0 -show_entries stream=index -of csv=p=0 "$tmp" | grep -q .; then
    mv "$tmp" "$file"
    green "[OK] Normalisé : $file"
    NORMALIZED=$((NORMALIZED + 1))
  else
    rm -f "$tmp"
    red "[X] Échec, original conservé : $file"
    ERRORS=$((ERRORS + 1))
  fi
}

if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
  red "[X] ffmpeg et ffprobe sont requis (installe-les avec « mise install »)."
  exit 1
fi

printf '> Normalisation audio à %s LUFS / %s dBTP\n\n' "$TARGET_I" "$TARGET_TP"
while IFS= read -r -d '' file; do
  normalize_file "$file"
done < <(find videos -mindepth 2 -type f -iname '*.mp4' -print0)

printf '\n'
if [[ "$ERRORS" -gt 0 ]]; then
  red "[FAIL] Terminé — $NORMALIZED normalisée(s), $SKIPPED ignorée(s), $ERRORS erreur(s)"
  exit 1
fi
green "[OK] Terminé — $NORMALIZED normalisée(s), $SKIPPED déjà conforme(s) ou ignorée(s)"
