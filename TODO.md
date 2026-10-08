# TODO / idées plus tard

Idées utiles mais trop longues pour le moment. Pas un backlog priorisé — juste un carnet.

- [ ] Développer une commande Makefile `make new-quiz` (script bash interactif pour créer le `.js`, les dossiers `/videos/` et `/photos/`, et mettre à jour le manifeste).
- [ ] Développer une commande Makefile `make rename-media` (renommage auto des médias et update du `.js` avec saisie des leurres via CLI).
- [ ] Créer une intégration Twitch API pour permettre aux viewers de voter dans le chat en temps réel.
- [ ] Développer une version hébergée (Web App) jouable en ligne sans installation locale.

## Dettes conscientes (OK pour le live OBS)

Pas des bugs bloquants pour publier : choix assumés pour le contexte streamer / `file:///`. À revoir surtout si version web hébergée.

- [ ] **Élargir les tests** — Aujourd’hui seuls les purs (`QuizUtils` via `make test`) sont couverts. Tester DOM / `localStorage` en JS nu (sans Jest ni outil lourd) est fastidieux ; les tests actuels suffisent à prouver le concept unitaire. Pistes : checklist smoke manuelle live, ou tests DOM seulement si web app.
- [ ] **Durcir la validation des données restaurées** — Filet déjà léger (`try/catch`, types de base, `normalizeSavedPhase`). Pas critique en local (pas de threat modèle « user hostile ») ; la corruption réelle vient plutôt d’un vieux schéma / JSON partiel. À renforcer surtout pour une prod web.
- [ ] **Affiner les raccourcis clavier globaux** — `preventDefault` sur Space / Entrée / seek / mute est voulu pour le plein écran OBS. Point d’ergonomie fin (focus dans un champ, site web classique) : peu gênant ici ; à revoir si version hébergée.
- [ ] **Validation du schéma des données restaurées :** Renforcer les contrôles sur les valeurs issues du `localStorage` (ex: s'assurer que `currentIndex` n'est pas un nombre décimal, valider la structure complète du récapitulatif) avant de les réinjecter dans l'état de l'application, afin d'abandonner proprement les données corrompues.
- [ ] **Amélioration continue de l'A11y (Accessibilité) :** Ajouter des annonces dynamiques (ex: via `aria-live`) pour informer vocalement un utilisateur lors de la validation d'une réponse (ok/ko) et gérer de manière plus stricte le focus à l'ouverture des panneaux (récapitulatif, écran de fin).

## Contact

Tu veux utiliser le projet et il te manque une fonctionnalité ? Contacte l’auteur par e-mail via l’adresse indiquée sur son [profil GitHub](https://github.com/camille-bennazar).
