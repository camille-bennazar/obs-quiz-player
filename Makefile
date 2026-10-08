.PHONY: help check test normalize-audio compress-videos compress-images media clean package

BACKUP_ROOT := media-originals

help:
	@echo "------------------------------------------------------------"
	@echo " Outils Médias & Packaging - obs-quiz-player"
	@echo "------------------------------------------------------------"
	@echo "Commandes disponibles :"
	@echo "  make check           : Vérifie manifeste <-> quiz <-> médias (bash + GNU awk)"
	@echo "  make test            : Lance check, valide la syntaxe JS et les tests unitaires"
	@echo "  make normalize-audio : Aligne les MP4 à -16 LUFS / -1,5 dBTP (vidéo copiée)"
	@echo "  make compress-videos : Convertit (.mov, .mkv, .avi, etc.) -> .mp4 + compresse"
	@echo "  make compress-images : Convertit (.png, .jpg, .jpeg, etc.) -> .webp + optimise"
	@echo "  make media           : Lance la conversion de toutes les vidéos et photos"
	@echo "  make package         : make check, puis archive runtime minimale pour le streamer"
	@echo "  make clean           : Supprime les archives .zip générées"
	@echo ""
	@echo "Dépendance : ffmpeg (système, ou mise install) pour media / compress-* / normalize-audio."
	@echo "make check : bash + GNU awk / grep / find (pas de npm)."
	@echo "make test : Node.js."
	@echo "Les originaux sont copiés (cp -n) dans $(BACKUP_ROOT)/ avant media / normalize-audio."
	@echo "------------------------------------------------------------"

check:
	@bash scripts/check-quiz.sh

test: check
	@echo "> Vérification de la syntaxe JavaScript"
	@bash -c 'shopt -s globstar nullglob; for file in js/**/*.js quiz/*.js tests/*.js; do node --check "$$file" || exit 1; done'
	@node tests/unit.js

normalize-audio:
	@BACKUP_ROOT="$(BACKUP_ROOT)" bash scripts/normalize-audio.sh

compress-videos:
	@echo "> Traitement des vidéos (conversion universelle -> MP4 H.264 / AAC)..."
	@echo "  Originaux sauvegardés dans $(BACKUP_ROOT)/ (si absents)"
	@bash -c 'set -euo pipefail; BACKUP_ROOT="$(BACKUP_ROOT)"; \
	mapfile -d "" files < <(find videos -mindepth 2 -type f \( -iname "*.mp4" -o -iname "*.mov" -o -iname "*.mkv" -o -iname "*.webm" -o -iname "*.avi" -o -iname "*.m4v" \) -print0); \
	for f in "$${files[@]}"; do \
		[ -n "$$f" ] || continue; \
		dir=$$(dirname "$$f"); \
		base=$$(basename "$$f"); \
		name="$${base%.*}"; \
		target="$$dir/$$name.mp4"; \
		mkdir -p "$$BACKUP_ROOT/$$dir"; \
		cp -n "$$f" "$$BACKUP_ROOT/$$f"; \
		echo "[*] Conversion : $$f -> $$target"; \
		if [ "$$f" != "$$target" ]; then \
			ffmpeg -nostdin -y -i "$$f" -vcodec libx264 -crf 26 -preset fast -c:a aac -b:a 128k "$$target"; \
			rm -f "$$f"; \
		else \
			ffmpeg -nostdin -y -i "$$f" -vcodec libx264 -crf 26 -preset fast -c:a aac -b:a 128k "$$dir/$${name}_tmp.mp4"; \
			mv "$$dir/$${name}_tmp.mp4" "$$target"; \
		fi; \
	done'
	@echo "[OK] Toutes les vidéos sont converties en .mp4 optimisé !"

compress-images:
	@echo "> Traitement des photos (conversion universelle -> WebP)..."
	@echo "  Originaux sauvegardés dans $(BACKUP_ROOT)/ (si absents)"
	@bash -c 'set -euo pipefail; BACKUP_ROOT="$(BACKUP_ROOT)"; \
	mapfile -d "" files < <(find photos -mindepth 2 -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.bmp" -o -iname "*.webp" \) -print0); \
	for f in "$${files[@]}"; do \
		[ -n "$$f" ] || continue; \
		dir=$$(dirname "$$f"); \
		base=$$(basename "$$f"); \
		name="$${base%.*}"; \
		target="$$dir/$$name.webp"; \
		mkdir -p "$$BACKUP_ROOT/$$dir"; \
		cp -n "$$f" "$$BACKUP_ROOT/$$f"; \
		echo "[*] Conversion : $$f -> $$target"; \
		if [ "$$f" != "$$target" ]; then \
			ffmpeg -nostdin -y -i "$$f" -c:v libwebp -quality 80 "$$target"; \
			rm -f "$$f"; \
		else \
			ffmpeg -nostdin -y -i "$$f" -c:v libwebp -quality 80 "$$dir/$${name}_tmp.webp"; \
			mv "$$dir/$${name}_tmp.webp" "$$target"; \
		fi; \
	done'
	@echo "[OK] Toutes les images sont converties en .webp optimisé !"

media: compress-videos compress-images
	@echo "Tous les médias (vidéos + images) sont prêts !"

package: check
	@echo "> Création du package runtime pour le direct..."
	@zip -r -q quiz-stream-ready.zip index.html css/ js/ quiz/ photos/ videos/ -x "*.DS_Store*" "*__MACOSX*"
	@echo "[OK] Archive prête pour le live : quiz-stream-ready.zip"

clean:
	@rm -f *.zip
	@echo "[OK] Nettoyage effectué."
