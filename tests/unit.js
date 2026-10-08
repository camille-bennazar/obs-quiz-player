/**
 * Tests Node des fonctions pures QuizUtils (`make test`).
 * Dépend de js/shared/utils.js (module.exports).
 */
"use strict";

const assert = require("node:assert/strict");
const Utils = require("../js/shared/utils.js");

assert.deepEqual(
  Utils.scoreFromHistory([{ isCorrect: true }, { isCorrect: false }, null]),
  { ok: 1, total: 3 }
);
assert.deepEqual(Utils.scoreFromHistory([]), { ok: 0, total: 0 });

["waiting", "validated", "finished"].forEach(function (phase) {
  assert.equal(Utils.normalizeSavedPhase(phase), phase);
});
assert.equal(Utils.normalizeSavedPhase("playing"), "waiting");
assert.equal(Utils.normalizeSavedPhase("inconnue"), "waiting");

assert.equal(
  Utils.encodeMediaPath("videos/mon quiz/épisode 1.mp4"),
  "videos/mon%20quiz/%C3%A9pisode%201.mp4"
);

assert.equal(Utils.hasValidOptionIndex(["a", "b"], 1), true);
assert.equal(Utils.hasValidOptionIndex(["a", "b"], 2), false);
assert.equal(Utils.hasValidOptionIndex(["a", "b"], -1), false);
assert.equal(Utils.hasValidOptionIndex(null, 0), false);

assert.equal(Utils.isValidOptionLabel("Alpha"), true);
assert.equal(Utils.isValidOptionLabel("  Beta  "), true);
assert.equal(Utils.isValidOptionLabel(""), false);
assert.equal(Utils.isValidOptionLabel("   "), false);
assert.equal(Utils.isValidOptionLabel(null), false);
assert.equal(Utils.isValidOptionLabel(42), false);

const four = ["A", "B", "C", "D"];
assert.equal(Utils.hasValidOptions(four), true);
assert.equal(Utils.hasValidOptions(["A", "B", "C"]), false);
assert.equal(Utils.hasValidOptions(["A", "B", "C", "D", "E"]), false);
assert.equal(Utils.hasValidOptions(["A", "B", "", "D"]), false);
assert.equal(Utils.hasValidOptions(["A", "B", "  ", "D"]), false);
assert.equal(Utils.hasValidOptions(["A", "B", 3, "D"]), false);
assert.equal(Utils.hasValidOptions(null), false);

assert.equal(Utils.resolveOptionLabel(["Alpha", "Beta"], 1), "Beta");
assert.equal(Utils.resolveOptionLabel(["Alpha"], 3), "réponse inconnue");
assert.equal(Utils.resolveOptionLabel(["Alpha", ""], 1), "réponse inconnue");
assert.equal(Utils.resolveOptionLabel(["Alpha", "   "], 1), "réponse inconnue");
assert.equal(Utils.resolveOptionLabel(["Alpha", 9], 1), "réponse inconnue");
assert.equal(Utils.resolveOptionLabel(["  Trim  ", "B", "C", "D"], 0), "Trim");

console.log("[OK] Tests unitaires OK");
