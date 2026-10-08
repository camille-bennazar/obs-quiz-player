# obs-quiz-player

Moteur de quiz vidéo interactif au style **vieux YouTube (~2010)** : on écoute un extrait, on choisit parmi 4 propositions.

Conçu pour le **stream en direct** — ouverture dans un navigateur (sur un second écran), capture de la fenêtre dans OBS Studio. Aucun serveur, aucun build, 100 % compatible avec le protocole `file:///`.

Licence : [MIT](LICENSE) · Doc technique : [`docs/dev.md`](docs/dev.md) · Auteur : **Camille Bennazar**

Démo en ligne : [camille-bennazar.github.io/obs-quiz-player](https://camille-bennazar.github.io/obs-quiz-player/)

---

## Contexte

Outil conçu à l’origine pour animer un live Twitch (just chatting / gaming) : un quiz d’environ 22 extraits, joué en direct, et réutilisable pour d’autres sessions avec de nouveaux contenus.

Habituellement, l’équipe s’appuyait sur la suite Google. Google Slides montrait vite ses limites pour intégrer des flux vidéo courts et offrait peu de personnalisation. L’objectif était d’obtenir une interface dédiée, légère, entièrement navigable au clavier, et capturable proprement dans OBS Studio.

> **Note de conception :** Ce lecteur est une interface *Desktop-first*, conçue pour être ouverte dans un navigateur web et capturée au format 16:9 dans OBS Studio. La zone utile se plafonne à **1280px** de large (`min(100%, 1280px)`), fluide en dessous, sans imposer un canvas fixe type 1920×1080. Par souci de légèreté et de pertinence d’usage, le responsive design pour mobile n’a pas été implémenté.

- **Rôle :** développement complet de l’application + intégration des vidéos du live. Une partie des médias a été produite par un autre membre de l’équipe (gestion de projet).
- **Retours :** retours très positifs après le live. Demande d’ajouter un score et un récapitulatif en fin de partie, intégrés ensuite (non prévus initialement pour privilégier une ambiance chill plutôt que compétitive).

---

## Démarrage rapide

1. Clone le dépôt :

   ```bash
   git clone https://github.com/camille-bennazar/obs-quiz-player.git
   ```

2. Ouvre `index.html` dans ton navigateur (double-clic ou glisser-déposer).
3. Dans OBS Studio : ajoute une source **Capture de fenêtre** (ou capture d’écran) pointant vers la fenêtre du navigateur.

> **Pourquoi ouvrir dans le navigateur ?**
> Ouvrir la page directement dans un navigateur (ex. sur un second écran) permet au streamer de piloter l’ensemble du jeu au clavier naturellement, tout en envoyant un flux vidéo 16:9 propre dans OBS.

Deux quiz de démonstration (**Quiz Gaming** et **Quiz YouTubeurs**) sont préconfigurés dans `quiz/manifest.js` : le projet fonctionne immédiatement dès le clone.

### Fonctionnement en direct

- **Sélecteur de quiz :** sur l’écran d’attente et en fin de partie, le nom du quiz s’affiche discrètement avec le rappel `Ctrl+Alt+S`. Ce raccourci ouvre ou ferme le sélecteur. Fermetures possibles : `Ctrl+Alt+S`, `Échap` (focus sur le menu), ou perte de focus (`blur`).
- **Sécurité de progression :** changer de quiz demande une confirmation dès qu’on a dépassé la première question, qu’un récapitulatif existe, ou que la phase est active (`playing` / `validated` / `finished`). Sur la question initiale en attente sans historique, le changement est silencieux.
- **Affichage :** le bandeau supérieur affiche le score et le nombre de questions restantes.
- **Accessibilité & spoilers :** pendant un round, l’avatar est visible immédiatement (chrome façon YouTube) et le titre indique le quiz en cours. Le nom de chaîne reste « Extrait mystère » jusqu’à validation, et l’attribut `alt` de l’image reste neutre pendant la lecture pour éviter tout spoiler aux lecteurs d’écran.

---

## Samples

Le dépôt public ne contient **pas** d’extraits vidéo ni d’avatars protégés (respect du droit d’auteur et optimisation de la taille du dépôt). Deux séries d’échantillons légers sont fournies :

| Quiz | Fichier | Médias associés |
| --- | --- | --- |
| Quiz Gaming | [`quiz/sample-1.js`](quiz/sample-1.js) | `photos/sample-1/`, `videos/sample-1/` |
| Quiz YouTubeurs | [`quiz/sample-2.js`](quiz/sample-2.js) | `photos/sample-2/`, `videos/sample-2/` |

Les quiz personnels et médias hors sample restent ignorés par Git (voir [`.gitignore`](.gitignore)).

---

## Ajouter un quiz

1. Crée un nouveau fichier `quiz/mon-quiz.js` :

   ```js
   window.QUIZ_CATALOG = window.QUIZ_CATALOG || {};
   window.QUIZ_CATALOG["mon-quiz"] = {
     title: "Mon quiz",
     data: [
       {
         video: "videos/mon-quiz/1.mp4",
         avatar: "photos/mon-quiz/1.webp",
         options: ["Bonne réponse", "Leurre 1", "Leurre 2", "Leurre 3"],
         correctIndex: 0
       }
     ]
   };
   ```

2. Déclare `"mon-quiz"` dans [`quiz/manifest.js`](quiz/manifest.js) — aucune modification de `index.html` requise.
3. Dépose tes médias dans `photos/mon-quiz/` et `videos/mon-quiz/`.

---

## Médias & outillage DevOps (optionnel)

Le projet intègre un outillage complet via **`make`** pour valider l’intégrité, normaliser le son et optimiser les médias.

L’outil [`mise`](https://mise.jdx.dev/) sert uniquement à installer FFmpeg localement (`mise install`) si nécessaire. `zip` reste un paquet système standard.

| Commande | Action |
| --- | --- |
| `make check` | Valide la cohérence manifeste ↔ quiz ↔ médias (Bash + GNU Awk / Grep / Find) |
| `make test` | Vérification d’intégrité, syntaxe JS et tests unitaires (Node.js) |
| `make normalize-audio` | Aligne les MP4 à −16 LUFS / −1,5 dBTP (EBU R128) avec backup auto |
| `make compress-videos` | Convertit et compresse les vidéos en `.mp4` H.264 (CRF 26) |
| `make compress-images` | Convertit et optimise les images en `.webp` |
| `make media` | Exécute `compress-videos` + `compress-images` |
| `make package` | Lance `check` puis assemble l’archive runtime (`quiz-stream-ready.zip`) |
| `make clean` | Supprime les archives `.zip` générées |
| `make help` | Affiche l’aide des cibles |

- **Sauvegarde automatique (`media-originals/`) :** `make media` sauvegarde chaque fichier source dans `media-originals/` (`cp -n`, sans écrasement), convertit vers le format cible, puis supprime la source si l’extension change (ex. `.mov` → `.mp4`). Un fichier déjà au format cible est réencodé sur place.
- **Normalisation audio EBU R128 :** `make normalize-audio` mesure la piste en deux passes. Le traitement est ignoré si la sonie se situe déjà dans ±0,5 LU de −16 LUFS avec un True Peak ≤ −1,5 dBTP. Les fichiers ajustés ont leur son réencodé sans toucher au flux vidéo (`-c:v copy`). L’original reste intact si FFmpeg échoue.

Détails d’architecture et de conception : voir [`docs/dev.md`](docs/dev.md).

---

## Contrôles clavier

| Touche | Action |
| --- | --- |
| `Espace` | Lancer l’extrait (`waiting`) · Pause / lecture (`playing` / `validated`) · Rejouer depuis le début après soft-end · sans effet en fin de partie (`finished`) |
| `←` ou `J` | Reculer de 5 s (round actif) |
| `→` ou `L` | Avancer de 5 s (round actif) |
| `R` | Rejouer l’extrait depuis le début (round actif) |
| `M` | Activer / couper le son (muet) |
| `1` à `4` | Sélectionner une proposition (phase `playing`) |
| `Entrée` | Lancer (attente) · Valider (si proposition active) · Question suivante · Recommencer |
| `Ctrl+Alt+S` | Ouvrir / fermer le sélecteur de quiz (attente et fin) |
| `Échap` | Fermer le sélecteur (lorsque le focus est sur le menu) |

*« Round actif » = phases `playing` ou `validated`.*

### Réinitialisation d’état

- **Quiz actif :** `Ctrl+F5` ou `Ctrl+Shift+R` (`Cmd` sur macOS) efface la progression et le récapitulatif du quiz en cours, puis recharge la page.
- **Nouvelle session :** à l’ouverture d’un nouvel onglet ou fenêtre (clé `sessionStorage` absente), la progression et les récapitulatifs de l’ensemble des quiz sont remis à zéro.

---

## Crédits & contact

Développé par **Camille Bennazar**, avec l’aide et les retours de l’équipe de modération.

- **Feuille de route & évolutions :** [`TODO.md`](TODO.md)
- **Contact :** via l’adresse e-mail indiquée sur mon [profil GitHub](https://github.com/camille-bennazar).
