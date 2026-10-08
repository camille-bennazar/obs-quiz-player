/**
 * Fonctions pures partagées (navigateur + tests Node).
 * Expose window.QuizUtils ; aussi via module.exports sous Node.
 */
(function (root, factory) {
  "use strict";

  const utils = factory();
  if (typeof module === "object" && module.exports) module.exports = utils;
  if (root) root.QuizUtils = utils;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  /**
   * Normalise une phase restaurée depuis le stockage.
   * `playing` et toute valeur inconnue → `waiting` (la vidéo ne reprend pas seule).
   * @param {string} phase
   * @returns {"waiting"|"validated"|"finished"}
   */
  function normalizeSavedPhase(phase) {
    if (phase === "finished" || phase === "validated" || phase === "waiting") return phase;
    return "waiting";
  }

  /**
   * Score à partir de l’historique de réponses.
   * @param {Array<{isCorrect?: boolean}|null|undefined>} history
   * @returns {{ok: number, total: number}}
   */
  function scoreFromHistory(history) {
    let ok = 0;
    history.forEach(function (entry) {
      if (entry && entry.isCorrect) ok++;
    });
    return { ok: ok, total: history.length };
  }

  /**
   * Encode chaque segment d’un chemin média (espaces, accents) pour une URL sûre.
   * @param {string} path
   * @returns {string}
   */
  function encodeMediaPath(path) {
    return path.split("/").map(encodeURIComponent).join("/");
  }

  /**
   * Indique si `index` pointe une option valide du tableau.
   * @param {unknown} options
   * @param {unknown} index
   * @returns {boolean}
   */
  function hasValidOptionIndex(options, index) {
    return (
      Array.isArray(options) &&
      typeof index === "number" &&
      index >= 0 &&
      index < options.length
    );
  }

  /**
   * Label de proposition utilisable (string non vide après trim).
   * @param {unknown} label
   * @returns {boolean}
   */
  function isValidOptionLabel(label) {
    return typeof label === "string" && label.trim() !== "";
  }

  /**
   * Contrat produit : exactement 4 labels string non vides.
   * @param {unknown} options
   * @returns {boolean}
   */
  function hasValidOptions(options) {
    return (
      Array.isArray(options) &&
      options.length === 4 &&
      options.every(isValidOptionLabel)
    );
  }

  /**
   * Label sûr pour UI / récap — jamais undefined si l’index / label est invalide.
   * @param {unknown} options
   * @param {unknown} index
   * @returns {string}
   */
  function resolveOptionLabel(options, index) {
    if (!hasValidOptionIndex(options, index)) return "réponse inconnue";
    const label = options[index];
    if (!isValidOptionLabel(label)) return "réponse inconnue";
    return label.trim();
  }

  return {
    normalizeSavedPhase: normalizeSavedPhase,
    scoreFromHistory: scoreFromHistory,
    encodeMediaPath: encodeMediaPath,
    hasValidOptionIndex: hasValidOptionIndex,
    isValidOptionLabel: isValidOptionLabel,
    hasValidOptions: hasValidOptions,
    resolveOptionLabel: resolveOptionLabel
  };
});
