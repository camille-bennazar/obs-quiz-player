/**
 * Flux de partie : catalogue, navigation, restore, écran final.
 * Consomme App._round (game-round.js) ; expose App.game.
 */
(function () {
  "use strict";

  const App = window.QuizApp;
  if (!App || !App.store || !App.ui || !App.els || !App._round) {
    console.error("QuizApp incomplet — charge game-round.js avant game-flow.js");
    return;
  }

  const Player = window.QuizPlayer;
  const toast = window.showQuizToast || function () {};
  const catalog = window.QUIZ_CATALOG || {};
  const store = App.store;
  const ui = App.ui;
  const els = App.els;
  const s = App.state;
  const round = App._round;

  function getPhase() {
    return s.phase;
  }

  function showFinalScreen() {
    s.phase = "finished";
    Player.pause();
    els.placeholder.hidden = false;
    els.placeholderText.textContent = "Fin des extraits.";
    els.btnBigPlay.hidden = true;
    Player.setChromeEnabled(false);
    if (els.scoreCount) {
      els.scoreCount.textContent = String(store.scoreFromHistory().ok);
    }
    els.remainCount.textContent = "0";
    els.metaRemain.textContent = "terminé";
    els.videoTitle.textContent = "C’est terminé";
    ui.setMysteryAvatar();
    els.channelName.textContent = "Fin de partie";
    els.bioStatus.textContent = "Fin";
    ui.setRulesOpen(false);
    els.choicesContainer.innerHTML = "";
    ui.clearDebrief();
    els.actionsRow.hidden = true;
    ui.updateEndScore();
    ui.closeRecap({ instant: true });
    ui.openEndPanel();
    store.saveProgress();
  }

  function nextQuestion() {
    if (s.currentIndex < s.quizData.length - 1) {
      s.currentIndex++;
      round.loadRound(s.currentIndex);
    } else {
      showFinalScreen();
    }
  }

  function resetToStart() {
    store.clearProgress();
    store.clearRecap();
    s.currentIndex = 0;
    round.resetRoundFlags();
    ui.closeRecap({ instant: true });
    round.loadRound(0);
  }

  function restoreProgress() {
    const savedRecap = store.readRecap();
    if (savedRecap) s.answerHistory = savedRecap.history.slice();
    else s.answerHistory = [];

    const data = store.readProgress();
    if (!data) {
      round.loadRound(0);
      return;
    }

    if (data.phase === "finished") {
      s.currentIndex = Math.min(Math.max(0, data.currentIndex), s.quizData.length - 1);
      showFinalScreen();
      return;
    }

    s.currentIndex = Math.min(Math.max(0, data.currentIndex), s.quizData.length - 1);

    const hasSavedOrder =
      Array.isArray(data.options) &&
      data.options.length === s.quizData[s.currentIndex].options.length &&
      typeof data.correctIndex === "number" &&
      data.correctIndex >= 0 &&
      data.correctIndex < data.options.length;

    if (hasSavedOrder) {
      s.quizData[s.currentIndex].options = data.options.slice();
      s.quizData[s.currentIndex].correctIndex = data.correctIndex;
      round.loadRound(s.currentIndex, { skipShuffle: true });
    } else {
      round.loadRound(s.currentIndex);
    }

    if (data.phase === "validated" && data.selectedChoice !== null && data.selectedChoice !== undefined) {
      s.selectedChoice = data.selectedChoice;
      s.phase = "validated";
      if (s.answerHistory.length <= s.currentIndex) {
        store.recordAnswer(s.quizData[s.currentIndex], s.selectedChoice);
      }
      round.applyValidatedUI();
      ui.updateRemain();
      store.saveProgress();
    } else if (data.selectedChoice !== null && data.selectedChoice !== undefined) {
      s.selectedChoice = data.selectedChoice;
    }
  }

  /**
   * Charge un quiz du catalogue (copie runtime des items).
   * @param {string} id
   * @param {{resetProgress?: boolean, restore?: boolean}} [opts]
   *   - `resetProgress` : wipe progression + récap avant chargement
   *   - `restore` : reprend progression / récap sauvegardés
   * @returns {boolean} `false` si quiz introuvable ou vide
   */
  function loadQuizById(id, opts) {
    const entry = catalog[id];
    if (!entry || !Array.isArray(entry.data) || !entry.data.length) {
      console.error("Quiz introuvable ou vide:", id);
      toast("Quiz « " + id + " » introuvable ou vide.", "error");
      return false;
    }
    /* Copie runtime : le shuffle ne doit pas muter QUIZ_CATALOG. */
    const runtime = [];
    for (let i = 0; i < entry.data.length; i++) {
      const item = entry.data[i];
      if (!round.assertQuizItem(item, i)) return false;
      runtime.push({
        video: item.video,
        avatar: item.avatar,
        options: (item.options || []).slice(),
        correctIndex: item.correctIndex
      });
    }
    store.setActiveQuizId(id);
    s.quizData = runtime;
    s.quizTitle = entry.title || id;
    ui.applyQuizMeta();

    s.currentIndex = 0;
    round.resetRoundFlags();
    ui.closeRecap({ instant: true });

    if (opts && opts.resetProgress) {
      store.clearProgress();
      store.clearRecap();
    }
    if (opts && opts.restore) restoreProgress();
    else {
      s.answerHistory = [];
      store.saveRecap();
      round.loadRound(0);
    }
    return true;
  }

  App.game = {
    getPhase: getPhase,
    getCatalog: function () { return catalog; },
    startExtract: round.startExtract,
    selectOption: round.selectOption,
    validateAnswer: round.validateAnswer,
    nextQuestion: nextQuestion,
    resetToStart: resetToStart,
    loadQuizById: loadQuizById
  };

  delete App._round;
})();
