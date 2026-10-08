# Doc technique

Notes pour lire / modifier le code. Le [README](../README.md) reste la porte d’entrée utilisateur.

## Contraintes

- **Zéro build et lancement direct** : HTML + CSS + JS classiques, ouverture en double-clic ou source navigateur OBS sans serveur local.
- Pas de bundler, pas de modules ES natifs (`import`/`export`) — chargement séquentiel de scripts. Les ES modules fonctionnent sans bundler via `http(s)://`, mais depuis `file:///` les `import` entre fichiers sont souvent bloqués (CORS / `origin: null`, notamment Chromium). Un serveur local, un bundle unique ou une config navigateur permissives résoudraient ça, au prix de la promesse « fichier local, zéro config ».
- Les quiz perso et médias hors sample sont hors git ; le manifeste versionné charge les samples par défaut (clone prêt ; démo GitHub Pages prévue).

## Structure

```
index.html
Makefile / mise.toml
scripts/check-quiz.sh  intégrité manifeste <-> quiz <-> médias (`make check`)
scripts/normalize-audio.sh  normalisation EBU R128 sûre (`make normalize-audio`)
tests/unit.js          tests des fonctions pures (`make test`)
css/                 tokens + modules (@import via main.css)
js/
  boot.js            lit QUIZ_MANIFEST (déjà chargé) -> quiz/<id>.js -> store…events
  shared/toast.js
  shared/utils.js    fonctions pures partagées navigateur / tests
  player/player.js   chrome YT-like, volume, soft-end, preload
  quiz/
    store.js         localStorage / sessionStorage
    ui-core.js       refs DOM + open/close panneaux
    ui-panels.js     picker, récap, règles, score
    ui-round.js      avatar, compteur, reset chrome round
    game-round.js    round (shuffle, choix, validation)
    game-flow.js     catalogue, navigation, restore -> App.game
    events.js        clavier / DOM + boot partie
quiz/
  manifest.js        liste versionnée (samples)
  sample-*.js
photos/ sample-*/ · videos/ sample-*/
```

## Ordre de chargement

1. `js/shared/toast.js` -> `window.showQuizToast`
2. `js/shared/utils.js` -> `window.QuizUtils`
3. `js/player/player.js` -> `window.QuizPlayer`
4. `quiz/manifest.js` -> `window.QUIZ_MANIFEST`
5. `js/boot.js` charge ensuite, dans l’ordre :
   - chaque `quiz/<id>.js` du manifeste -> `window.QUIZ_CATALOG`
   - `store` -> `ui-core` -> `ui-panels` -> `ui-round` -> `game-round` -> `game-flow` -> `events`

Namespaces publics : `QUIZ_MANIFEST`, `QUIZ_CATALOG`, `QuizApp` (`store`, `ui`, `uiCore`, `els`, `state`, `game`, `PANEL_CLOSE_MS`), `QuizPlayer`, `QuizUtils`, `showQuizToast`.

`PANEL_CLOSE_MS` (220) : délai avant `hidden=true` à la fermeture d’un panneau — aligné sur `--transition-fade` (0,22s).

## Commentaires JS / JSDoc

Pas de générateur ni de dépendance npm : les blocs `/** … */` servent à l’IDE (hover) et à la lecture humaine.

- **En-tête de module** : rôle, ce qu’il expose, dépendances / ordre de chargement.
- **JSDoc** (`@param`, `@returns`, `@typedef`) surtout sur la surface pure / partagée non triviale (`QuizUtils`, `showQuizToast`, `App.store`, `App.uiCore.openPanel` / `closePanel`, contrat quiz). `QuizPlayer` et `App.game` : documenter les entrées non évidentes (`setVideoSources`, `bind`, `loadQuizById`) ; le reste peut rester en prose courte d’en-tête de fonction.
- **Pas** de commentaire narratif ligne-à-ligne ; garder les notes métier (soft-end, copie runtime, contrat 4 options).
- **Langue** : français pour la prose ; identifiants et valeurs de code en anglais (`waiting`, `is-open`, etc.). Jargon technique stable OK (`soft-end`, `chrome`, `fade`).

### Double surface API

`QuizUtils` est la source pure (tests Node + logique partagée) :
`normalizeSavedPhase`, `scoreFromHistory`, `encodeMediaPath`, `hasValidOptionIndex`,
`isValidOptionLabel`, `hasValidOptions`, `resolveOptionLabel`.

Wrapper de commodité qui lie l’état app :

- `App.store.scoreFromHistory()` -> délègue à `QuizUtils.scoreFromHistory(App.state.answerHistory)`

L’encodage des chemins médias (`QuizUtils.encodeMediaPath`) reste uniquement sur `QuizUtils` (lecteur en interne, UI avatar en externe).

## Persistence

| Clé | Stockage | Module | Rôle |
|-----|----------|--------|------|
| `qui-est-ce-active-quiz` | localStorage | `store.js` | Dernier quiz choisi |
| `qui-est-ce-progress_<id>` | localStorage | `store.js` | Progression (`currentIndex`, `phase`, `selectedChoice`, `options` + `correctIndex` après shuffle) |
| `qui-est-ce-recap_<id>` | sessionStorage | `store.js` | Historique réponses |
| `qui-est-ce-session` | sessionStorage | `store.js` | Flag session ; absent -> wipe **tous** les `progress_*` / `recap_*` (`ensureFreshSession`) |
| `qui-est-ce-volume` | localStorage | `player.js` | Volume / mute |

Phase `playing` restaurée -> `waiting` (la vidéo ne reprend pas seule).

Hard-refresh (**Ctrl+F5** / **Ctrl+Shift+R**, aussi **Cmd** sur macOS) : wipe progression + récap du **quiz actif** seulement (`clearProgress` + `clearRecap`), puis reload navigateur. Distinct du wipe session ci-dessus (tous les quiz).

## Conventions produit (volontaires)

- **Visibilité UI** : une seule classe d’ouverture `is-open` (récap, picker, fin, règles, debrief, toast). Attribut `hidden` pour `display:none` (récap, picker, fin, toast ; aussi toggles runtime sur `actionsRow`, `placeholder`, `btnBigPlay`). Overlays règles/debrief sans `hidden`. `is-hidden` = fade label/hint du picker uniquement. Fermetures : `ui.closeRecap|closeQuizPicker|closeEndPanel({ instant, onDone })` alignées sur `uiCore.closePanel`.
- **Avatar dès le round** : l’image (`avatar`) s’affiche au chargement de la question via `setAvatar`. `setWaitingLabels` pose le **titre du quiz** (`App.state.quizTitle`) et le nom de chaîne « Extrait mystère » ; seule l’identité (titre vidéo + chaîne) est révélée après validation dans `applyValidatedUI`. Ce n’est pas un spoiler accidentel — chrome façon YouTube (photo visible, identité texte révélée après). **A11y** : `alt` reste vide pendant le round ; la réponse n’y est posée qu’avec les labels dans `applyValidatedUI` (sinon un lecteur d’écran spoile avant les autres).
- **4 propositions figées** : chaque question a exactement 4 options (labels string non vides). Raccourcis clavier `1–4` (phase `playing` uniquement), delays CSS `nth-child(2..4)`, textes d’aide. Runtime (`assertQuizItem` / `QuizUtils.hasValidOptions` + `hasValidOptionIndex`) et `make check` refusent tout autre cardinal ; ne pas viser 3 ou 5 choix sans revoir UI + clavier + CSS + validation.
- **Sélecteur de quiz (Ctrl+Alt+S)** : toggle ouvrir/fermer tant que le placeholder lecteur est visible — écran d’attente **et** écran de fin. Fermetures aussi via Échap (focus `<select>`) ou blur du `<select>`. Confirmation (état mémoire, pas relecture storage) si `currentIndex > 0`, `answerHistory.length > 0`, ou phase `playing|validated|finished` — y compris après l’écran de fin. Sur Q0 en `waiting` sans historique : pas de confirm.
- **Soft-end / preload** (`player.js`) : le soft-end coupe un peu avant la vraie `duration` (fade volume puis pause) pour éviter un black frame / freeze codec en fin d’extrait. `preloadRound` précharge le prochain MP4 dans un `<video>` hors écran.
- **Validation d’item (`assertQuizItem`)** : item absent, `video` manquante, options invalides (≠ 4 labels string non vides après trim) ou `correctIndex` hors bornes (`hasValidOptionIndex`) -> toast error + round annulé (`return false`). Un `avatar` manquant ne hard-fail pas ici : `setAvatar` émet un toast warn et garde l’image mystère ; `make check` reste plus strict (fichier `avatar` doit exister). `QuizUtils.resolveOptionLabel` reste le filet d’affichage (« réponse inconnue ») pour les chemins hors assert (ex. données restaurées) ; le score ne marque une bonne réponse que si l’index est valide.
- **Shuffle** : Fisher–Yates avec suivi de `correctIndex` (pas `indexOf`) — résistant aux labels dupliqués. `make check` avertit si des propositions ont le même texte.

## Médias & packaging

- **Makefile** : les commandes (`make check`, `make media`, `make package`, …).
- **mise** : optionnel, install de `ffmpeg` uniquement (`mise install`). Pas de doublon de tâches. `ffmpeg = "latest"` dans `mise.toml` : outil local pour le Makefile médias uniquement, hors runtime du quiz packagé (pas de service réseau, pas embarqué dans le zip streamer). On privilégie les correctifs récents plutôt qu’un pin figé ; les entrées média sont les nôtres. En environnement verrouillé / CI, préférer une version explicite.

```bash
make check            # avant un live : chemins, correctIndex, orphelins
make test             # check + syntaxe JS + fonctions pures (Node.js)
make normalize-audio  # MP4 à -16 LUFS / -1,5 dBTP, vidéo copiée sans réencodage
mise install          # si besoin de ffmpeg
make compress-videos  # -> .mp4 (rm source si extension change)
make compress-images  # -> .webp (rm source si extension change)
make media            # compress-videos + compress-images (destructif hors backup)
make package          # lance check, puis zip runtime minimale (streamer)
make clean            # supprime les .zip générés
make help             # liste des cibles
```

`make check` (`scripts/check-quiz.sh`) : bash + **GNU awk** (`gawk` / `match(..., m)`), grep et find — aucune dépendance npm. Vérifie id manifeste <-> `quiz/<id>.js` <-> clé `QUIZ_CATALOG`, existence des `video`/`avatar`, exactement 4 options (labels string non vides), `correctIndex` dans les bornes. Erreurs -> exit ≠ 0. Avertissements seulement (pas de fail) : labels dupliqués, quiz hors manifeste, médias orphelins dans `photos/<id>/` et `videos/<id>/`. `make package` dépend de `check` : pas d’archive si la vérif échoue.

`make package` produit `quiz-stream-ready.zip` avec uniquement le runtime : `index.html`, `css/`, `js/`, `quiz/`, `photos/`, `videos/` (exclut aussi `*.DS_Store*` / `*__MACOSX*`). Pas de Makefile, README, docs, scripts ni LICENSE.

`make media` et `make normalize-audio` copient les originaux dans `media-originals/` (`cp -n`, pas d’écrasement si le backup existe déjà). `make media` / `compress-*` écrivent ensuite `.mp4` / `.webp` dans `photos/` et `videos/`, puis **suppriment la source** quand l’extension change (ex. `.mov` → `.mp4`, `.png` → `.webp`) ; un fichier déjà au format cible est réencodé sur place (pas de `rm`). `zip` reste un binaire système.

`make normalize-audio` effectue une mesure `loudnorm` en deux passes. Skip si
loudness déjà dans ±0,5 LU de −16 LUFS **et** true peak ≤ −1,5 dBTP ; aussi
ignorés : fichiers sans piste audio ou mesure inexploitable. Avant remplacement,
le MP4 est sauvegardé dans `media-originals/`, écrit dans un fichier temporaire,
puis contrôlé avec `ffprobe`. Seule la piste AAC est réencodée (`-c:v copy`).

## Pourquoi ce découpage

Les fichiers > ~300 lignes ont été coupés par responsabilité (UI panneaux vs chrome round, round vs flux de partie), toujours en IIFE + namespaces globaux pour rester `file:///`-safe. Le lecteur reste un seul module : état volume / soft-end trop couplé pour un découpage utile sans complexifier.
