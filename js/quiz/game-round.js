/**
 * Logique d’un round : chargement, choix, validation UI.
 * Expose App._round (consommé par game-flow.js puis retiré).
 */
(function () {
  "use strict";

  const App = window.QuizApp;
  if (!App || !App.store || !App.ui || !App.els) {
    console.error("QuizApp incomplet — charge store + ui-* avant game-round.js");
    return;
  }

  const Player = window.QuizPlayer;
  const Utils = window.QuizUtils || {};
  const toast = window.showQuizToast || function () {};
  const store = App.store;
  const ui = App.ui;
  const els = App.els;
  const s = App.state;

  function resetRoundFlags() {
    s.selectedChoice = null;
    s.phase = "waiting";
  }

  /**
   * Valide un item avant chargement du round.
   * Item / vidéo / options (≠ 4 labels) / correctIndex invalides
   * → toast error + `false` (round annulé). Voir docs/dev.md.
   * @param {QuizItem|null|undefined} item
   * @param {number} index
   * @returns {boolean}
   */
  function assertQuizItem(item, index) {
    const n = index + 1;
    if (!item) {
      toast("Question #" + n + " manquante dans le quiz.", "error");
      return false;
    }
    if (!item.video) {
      toast("Vidéo manquante pour la question #" + n + ".", "error");
      return false;
    }
    if (!Utils.hasValidOptions(item.options)) {
      toast("Propositions invalides pour la question #" + n + " (4 labels requis).", "error");
      return false;
    }
    if (!Utils.hasValidOptionIndex(item.options, item.correctIndex)) {
      toast("Index de réponse invalide pour la question #" + n + ".", "error");
      return false;
    }
    return true;
  }

  function forEachChoice(fn) {
    els.choicesContainer.querySelectorAll(".btn-choice").forEach(fn);
  }

  function shuffleItemOptions(item) {
    const opts = item.options.slice();
    let correctIndex = item.correctIndex;
    const track = Utils.hasValidOptionIndex(opts, correctIndex);
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = opts[i];
      opts[i] = opts[j];
      opts[j] = tmp;
      if (track) {
        if (correctIndex === i) correctIndex = j;
        else if (correctIndex === j) correctIndex = i;
      }
    }
    item.options = opts;
    if (track) item.correctIndex = correctIndex;
  }

  function prepareVideo(item, index) {
    Player.setVideoSources(Player.video, item.video || null);
    Player.syncVolumeUI();
    Player.resetSoftEnd();
    Player.pause();
    Player.updateProgress();
    Player.preloadRound(
      index + 1 < s.quizData.length ? s.quizData[index + 1].video : null
    );
  }

  function selectOption(index) {
    if (s.phase !== "playing") return;
    s.selectedChoice = index;
    forEachChoice(function (btn, idx) {
      btn.classList.toggle("is-selected", idx === index);
    });
    els.btnAction.disabled = false;
    store.saveProgress();
  }

  function renderChoiceButtons(item) {
    els.choicesContainer.innerHTML = "";
    const options = Array.isArray(item.options) ? item.options : [];
    options.forEach(function (opt, idx) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-choice is-locked";
      btn.disabled = true;
      btn.innerHTML = "<span></span><span class=\"key\">" + (idx + 1) + "</span>";
      btn.querySelector("span").textContent = opt;
      btn.addEventListener("click", function () { selectOption(idx); });
      els.choicesContainer.appendChild(btn);
    });
  }

  /**
   * Charge le round à `index` (shuffle, UI, vidéo, progression).
   * @param {number} index
   * @param {{skipShuffle?: boolean}} [opts] - `skipShuffle` si l’ordre est déjà restauré
   */
  function loadRound(index, opts) {
    const item = s.quizData[index];
    if (!assertQuizItem(item, index)) return;

    resetRoundFlags();
    if (!(opts && opts.skipShuffle) && item.options && item.options.length) {
      shuffleItemOptions(item);
    }

    ui.updateRemain();
    ui.setAvatar(item, index + 1);
    ui.setWaitingLabels();
    ui.resetRoundChrome();
    prepareVideo(item, index);
    renderChoiceButtons(item);
    ui.playEnterAnim();
    store.saveProgress();
  }

  function unlockChoices() {
    forEachChoice(function (btn, idx) {
      btn.disabled = false;
      btn.classList.remove("is-locked");
      if (s.selectedChoice !== null) btn.classList.toggle("is-selected", idx === s.selectedChoice);
    });
    if (s.selectedChoice !== null) els.btnAction.disabled = false;
  }

  function startExtract() {
    if (s.phase === "finished") return;
    ui.closeQuizPicker({ instant: true });
    const alreadyValidated = s.phase === "validated";
    if (!alreadyValidated) s.phase = "playing";
    els.placeholder.hidden = true;
    Player.setChromeEnabled(true);
    if (!alreadyValidated) {
      unlockChoices();
      els.bioStatus.textContent = "Tes propositions";
      ui.setRulesOpen(false);
    }
    Player.syncVolumeUI();
    Player.playFromStart();
    if (!alreadyValidated) store.saveProgress();
  }

  function applyValidatedUI() {
    const item = s.quizData[s.currentIndex];
    const opts = item.options;
    const hasCorrect = Utils.hasValidOptionIndex(opts, item.correctIndex);
    const label = Utils.resolveOptionLabel(opts, item.correctIndex);
    const ok = hasCorrect && s.selectedChoice === item.correctIndex;
    forEachChoice(function (btn, idx) {
      btn.disabled = true;
      btn.classList.remove("is-selected", "is-locked");
      if (hasCorrect && idx === item.correctIndex) btn.classList.add("is-correct");
      else btn.classList.add("is-wrong");
    });

    els.channelName.textContent = label;
    els.videoTitle.textContent = label;
    els.channelAvatar.alt = label;

    els.debriefText.textContent = ok
      ? "Bien vu — c’était " + label + "."
      : "Raté — c’était " + label + ".";
    els.debriefText.classList.toggle("is-ok", ok);
    els.debriefText.classList.toggle("is-ko", !ok);
    els.debriefText.classList.add("is-open");

    els.btnAction.textContent = s.currentIndex < s.quizData.length - 1
      ? "Suivant →"
      : "Terminer";
    els.btnAction.disabled = false;
    els.bioStatus.textContent = "Résultat";
    els.actionsRow.hidden = false;
  }

  /**
   * Valide le choix courant : phase `validated`, récap, UI debrief, progression.
   * No-op si aucun choix ou déjà validé / terminé.
   */
  function validateAnswer() {
    if (s.selectedChoice === null || s.phase === "validated" || s.phase === "finished") return;
    s.phase = "validated";
    store.recordAnswer(s.quizData[s.currentIndex], s.selectedChoice);
    applyValidatedUI();
    ui.updateRemain();
    store.saveProgress();
  }

  App._round = {
    resetRoundFlags: resetRoundFlags,
    assertQuizItem: assertQuizItem,
    loadRound: loadRound,
    startExtract: startExtract,
    selectOption: selectOption,
    validateAnswer: validateAnswer,
    applyValidatedUI: applyValidatedUI
  };
})();
