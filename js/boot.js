/**
 * Charge dynamiquement chaque quiz listé dans window.QUIZ_MANIFEST,
 * puis store → ui-* → game-* → events.
 * Point d’entrée scripts classiques (file:/// / OBS OK).
 */
(function () {
  "use strict";

  const toast = window.showQuizToast || function () {};
  const manifest = window.QUIZ_MANIFEST;

  if (!Array.isArray(manifest) || !manifest.length) {
    console.error("QUIZ_MANIFEST vide ou manquant (quiz/manifest.js)");
    toast("Manifeste manquant ou vide — vérifie quiz/manifest.js.", "error");
    return;
  }

  const QUIZ_SCRIPTS = [
    "js/quiz/store.js",
    "js/quiz/ui-core.js",
    "js/quiz/ui-panels.js",
    "js/quiz/ui-round.js",
    "js/quiz/game-round.js",
    "js/quiz/game-flow.js",
    "js/quiz/events.js"
  ];

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () {
        reject(new Error("Échec de chargement: " + src));
      };
      document.head.appendChild(s);
    });
  }

  async function loadAll(srcs) {
    for (let i = 0; i < srcs.length; i++) {
      await loadScript(srcs[i]);
    }
  }

  const quizFiles = manifest.map(function (id) {
    return "quiz/" + id + ".js";
  });

  loadAll(quizFiles.concat(QUIZ_SCRIPTS)).catch(function (err) {
    console.error(err);
    const msg = err && err.message ? err.message : "Erreur de chargement des quiz.";
    toast(msg + " — vérifie le manifeste et les fichiers quiz/.", "error");
  });
})();
