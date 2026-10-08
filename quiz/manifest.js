/*
  Liste des quiz à charger (noms de fichiers dans quiz/, sans .js).
  Les samples sont inclus par défaut — un clone fonctionne sans étape supplémentaire.
  Ajoute / renomme ici uniquement — pas besoin de toucher index.html.
  Chaque quiz/<id>.js enregistre window.QUIZ_CATALOG[id] = QuizCatalogEntry.
*/

/**
 * @typedef {Object} QuizItem
 * @property {string} video - Chemin relatif MP4 (ex. videos/<id>/1.mp4)
 * @property {string} avatar - Chemin relatif WebP (ex. photos/<id>/1.webp)
 * @property {string[]} options - Exactement 4 propositions (contrat produit)
 * @property {number} correctIndex - Index 0-based de la bonne réponse
 *
 * @typedef {Object} QuizCatalogEntry
 * @property {string} title
 * @property {QuizItem[]} data
 */

/** @type {string[]} */
window.QUIZ_MANIFEST = [
  "sample-1",
  "sample-2"
];
