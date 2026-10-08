#!/usr/bin/env bash
# Vérifie manifeste <-> quiz/*.js <-> médias (sans deps).
# Usage : depuis la racine du dépôt, ou via `make check`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MANIFEST="quiz/manifest.js"
ERRORS=0
WARNINGS=0
CHECKED=0

red() { printf '\033[31m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
info() { printf '%s\n' "$*"; }

err() { red "[X] $*"; ERRORS=$((ERRORS + 1)); }
warn() { yellow "[!] $*"; WARNINGS=$((WARNINGS + 1)); }
ok() { green "[OK] $*"; }

if [[ ! -f "$MANIFEST" ]]; then
  err "Manifeste manquant : $MANIFEST"
  exit 1
fi

# IDs du manifeste : chaînes "…" dans window.QUIZ_MANIFEST = [ … ]
mapfile -t MANIFEST_IDS < <(
  awk '
    /QUIZ_MANIFEST/ { in_m = 1 }
    in_m {
      while (match($0, /"[^"]+"/)) {
        s = substr($0, RSTART + 1, RLENGTH - 2)
        print s
        $0 = substr($0, RSTART + RLENGTH)
      }
    }
    in_m && /\]/ { exit }
  ' "$MANIFEST"
)

if [[ ${#MANIFEST_IDS[@]} -eq 0 ]]; then
  err "QUIZ_MANIFEST vide ou illisible dans $MANIFEST"
  exit 1
fi

info "> Vérification de ${#MANIFEST_IDS[@]} quiz (manifeste)"
info ""

# Chemins médias référencés (pour orphelins)
declare -A REFERENCED=()

check_quiz_file() {
  local id="$1"
  local file="quiz/${id}.js"
  local catalog_ok=1

  if [[ ! -f "$file" ]]; then
    err "[$id] fichier manquant : $file"
    return
  fi

  # Clé catalogue : QUIZ_CATALOG["…"]
  local keys
  keys="$(grep -oE 'QUIZ_CATALOG\["[^"]+"\]' "$file" | sed -E 's/QUIZ_CATALOG\["([^"]+)"\]/\1/' || true)"
  if [[ -z "$keys" ]]; then
    err "[$id] aucune clé QUIZ_CATALOG[\"…\"] dans $file"
    catalog_ok=0
  else
    local key_count
    key_count="$(printf '%s\n' "$keys" | grep -c . || true)"
    if [[ "$key_count" -ne 1 ]]; then
      err "[$id] attendu 1 clé QUIZ_CATALOG, trouvé $key_count"
      catalog_ok=0
    fi
    local catalog_key
    catalog_key="$(printf '%s\n' "$keys" | head -n1)"
    if [[ "$catalog_key" != "$id" ]]; then
      err "[$id] clé catalogue « $catalog_key » ≠ id manifeste « $id »"
      catalog_ok=0
    fi
  fi

  # Items : video / avatar / options / correctIndex (ordre doc README)
  local report
  report="$(awk -v id="$id" '
    function fail(msg) { bad++; printf "ERR|%s\n", msg }
    function soft(msg) { printf "WARN|%s\n", msg }
    function path_ok(p) { printf "REF|%s\n", p }

    BEGIN {
      item = 0
      bad = 0
      video = ""
      avatar = ""
      nopts = -1
      cidx = -999
      dup_opts = 0
      empty_opts = 0
      have = 0
    }

    function flush() {
      if (!have) return
      item++
      if (video == "") fail(sprintf("q%d: champ video manquant", item))
      else path_ok(video)
      if (avatar == "") fail(sprintf("q%d: champ avatar manquant", item))
      else path_ok(avatar)
      if (nopts < 0) fail(sprintf("q%d: champ options manquant", item))
      else if (nopts != 4) fail(sprintf("q%d: %d proposition(s) (exactement 4 requis)", item, nopts))
      if (empty_opts) fail(sprintf("q%d: label de proposition vide", item))
      if (dup_opts) soft(sprintf("q%d: propositions en doublon (labels identiques)", item))
      if (cidx == -999) fail(sprintf("q%d: champ correctIndex manquant", item))
      else if (nopts >= 0 && (cidx < 0 || cidx >= nopts))
        fail(sprintf("q%d: correctIndex=%d hors [0, %d)", item, cidx, nopts))
      video = ""
      avatar = ""
      nopts = -1
      cidx = -999
      dup_opts = 0
      empty_opts = 0
      have = 0
    }

    /video:[[:space:]]*"/ {
      if (match($0, /video:[[:space:]]*"([^"]+)"/, m)) {
        video = m[1]
        have = 1
      }
    }
    /avatar:[[:space:]]*"/ {
      if (match($0, /avatar:[[:space:]]*"([^"]+)"/, m)) {
        avatar = m[1]
        have = 1
      }
    }
    /options:[[:space:]]*\[/ {
      nopts = 0
      dup_opts = 0
      empty_opts = 0
      delete seen
      line = $0
      while (match(line, /"[^"]*"/)) {
        opt = substr(line, RSTART + 1, RLENGTH - 2)
        if (opt ~ /^[[:space:]]*$/) empty_opts = 1
        if (opt in seen) dup_opts = 1
        seen[opt] = 1
        nopts++
        line = substr(line, RSTART + RLENGTH)
      }
      # options multi-lignes (rare) : compter jusqu’à ]
      if ($0 !~ /\]/) {
        while ((getline nxt) > 0) {
          line = nxt
          while (match(line, /"[^"]*"/)) {
            opt = substr(line, RSTART + 1, RLENGTH - 2)
            if (opt ~ /^[[:space:]]*$/) empty_opts = 1
            if (opt in seen) dup_opts = 1
            seen[opt] = 1
            nopts++
            line = substr(line, RSTART + RLENGTH)
          }
          if (nxt ~ /\]/) break
        }
      }
      have = 1
    }
    /correctIndex:[[:space:]]*-?[0-9]+/ {
      if (match($0, /correctIndex:[[:space:]]*(-?[0-9]+)/, m)) {
        cidx = m[1] + 0
        have = 1
      }
    }
    /^[[:space:]]*\},?[[:space:]]*$/ { flush() }
    END {
      flush()
      if (item == 0) fail("aucune question dans data[]")
      printf "DONE|%d|%d\n", item, bad
    }
  ' "$file")"

  local line kind msg
  local file_errs=0
  local item_count=0
  local struct_bad=0
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    kind="${line%%|*}"
    msg="${line#*|}"
    case "$kind" in
      ERR) err "[$id] $msg"; file_errs=$((file_errs + 1)) ;;
      WARN) warn "[$id] $msg" ;;
      REF)
        REFERENCED["$msg"]=1
        if [[ ! -f "$msg" ]]; then
          err "[$id] média manquant : $msg"
          file_errs=$((file_errs + 1))
        fi
        ;;
      DONE)
        item_count="${msg%%|*}"
        struct_bad="${msg##*|}"
        ;;
    esac
  done <<< "$report"

  if [[ "$catalog_ok" -eq 1 && "$file_errs" -eq 0 && "$struct_bad" -eq 0 && "$item_count" -gt 0 ]]; then
    CHECKED=$((CHECKED + 1))
    ok "[$id] $item_count question(s) — clé catalogue OK"
  fi
}

for id in "${MANIFEST_IDS[@]}"; do
  check_quiz_file "$id"
done

# Quiz présents dans quiz/ mais absents du manifeste
info ""
info "> Quiz hors manifeste"
shopt -s nullglob
for f in quiz/*.js; do
  base="$(basename "$f" .js)"
  case "$base" in
    manifest) continue ;;
  esac
  listed=0
  for id in "${MANIFEST_IDS[@]}"; do
    if [[ "$id" == "$base" ]]; then listed=1; break; fi
  done
  if [[ "$listed" -eq 0 ]]; then
    warn "quiz/${base}.js non listé dans le manifeste (non chargé)"
  fi
done
shopt -u nullglob

# Orphelins : fichiers dans photos/<id>/ et videos/<id>/ non référencés
info ""
info "> Médias orphelins (dossiers des quiz du manifeste)"
for id in "${MANIFEST_IDS[@]}"; do
  for dir in "photos/$id" "videos/$id"; do
    [[ -d "$dir" ]] || continue
    while IFS= read -r -d '' f; do
      # chemin relatif depuis ROOT
      rel="$f"
      if [[ -z "${REFERENCED[$rel]+x}" ]]; then
        warn "[$id] orphelin (non référencé) : $rel"
      fi
    done < <(find "$dir" -type f -print0 2>/dev/null)
  done
done

info ""
if [[ "$ERRORS" -eq 0 ]]; then
  green "[OK] Check OK — $CHECKED quiz, $WARNINGS avertissement(s)"
  exit 0
else
  red "[FAIL] Check échoué — $ERRORS erreur(s), $WARNINGS avertissement(s)"
  exit 1
fi
