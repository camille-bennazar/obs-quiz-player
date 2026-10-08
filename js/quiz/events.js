/**
 * Câblage DOM / clavier + démarrage de partie.
 * Dépend de App.game (game-flow.js), App.ui, QuizPlayer.
 */
(function () {
  "use strict";

  const App = window.QuizApp;
  if (!App || !App.game || !App.store || !App.ui || !App.els) {
    console.error("QuizApp incomplet — charge store → ui-* → game-* avant events.js");
    return;
  }

  const Player = window.QuizPlayer;
  const toast = window.showQuizToast || function () {};
  const store = App.store;
  const ui = App.ui;
  const els = App.els;
  const s = App.state;
  const game = App.game;

  Player.bind({
    phase: function () { return game.getPhase(); },
    onStartExtract: game.startExtract
  });

  if (Player.video) {
    Player.video.addEventListener("error", function () {
      if (game.getPhase() === "finished") return;
      const item = s.quizData[s.currentIndex];
      const path = item && item.video ? String(item.video) : "fichier inconnu";
      toast("Vidéo introuvable ou illisible : " + path, "error");
    });
  }

  window.addEventListener("keydown", function (e) {
    const hard =
      (e.key === "F5" && (e.ctrlKey || e.metaKey)) ||
      ((e.key === "r" || e.key === "R") && e.ctrlKey && e.shiftKey) ||
      ((e.key === "r" || e.key === "R") && e.metaKey && e.shiftKey);
    if (hard) {
      store.clearProgress();
      store.clearRecap();
    }
  }, true);

  els.btnRules.addEventListener("click", function (e) {
    e.stopPropagation();
    ui.setRulesOpen(!els.rulesBox.classList.contains("is-open"));
  });

  document.addEventListener("click", function (e) {
    if (!els.rulesBox.classList.contains("is-open")) return;
    if (els.rulesBox.contains(e.target) || els.btnRules.contains(e.target)) return;
    ui.setRulesOpen(false);
  });

  function confirmQuizPicker() {
    const id = els.quizPicker.value;
    ui.closeQuizPicker();
    if (!id || id === s.activeQuizId) return;

    const midGame =
      s.currentIndex > 0 ||
      s.answerHistory.length > 0 ||
      s.phase === "playing" ||
      s.phase === "validated" ||
      s.phase === "finished";

    if (midGame) {
      const ok = window.confirm("Changer de quiz ? La progression en cours sera perdue.");
      if (!ok) {
        if (s.activeQuizId) els.quizPicker.value = s.activeQuizId;
        return;
      }
    }

    game.loadQuizById(id, { resetProgress: true });
  }

  if (els.quizPicker) {
    els.quizPicker.addEventListener("click", function (e) { e.stopPropagation(); });
    els.quizPicker.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        ui.closeQuizPicker();
      }
    });
    els.quizPicker.addEventListener("change", function () {
      confirmQuizPicker();
    });
    els.quizPicker.addEventListener("blur", function () {
      setTimeout(function () {
        if (document.activeElement !== els.quizPicker) ui.closeQuizPicker();
      }, 150);
    });
  }

  els.btnBigPlay.addEventListener("click", game.startExtract);
  els.btnRestart.addEventListener("click", game.resetToStart);
  if (els.btnRecap) els.btnRecap.addEventListener("click", ui.toggleRecap);
  if (els.btnRecapClose) els.btnRecapClose.addEventListener("click", function () { ui.closeRecap(); });

  els.btnAction.addEventListener("click", function () {
    const phase = game.getPhase();
    if (phase === "playing") game.validateAnswer();
    else if (phase === "validated") game.nextQuestion();
  });

  function handlePickerShortcut(e) {
    if ((e.key === "s" || e.key === "S") && e.ctrlKey && e.altKey && !e.metaKey) {
      e.preventDefault();
      if (ui.isPickerOpen()) ui.closeQuizPicker();
      else ui.openQuizPicker();
      return true;
    }
    return false;
  }

  function handleSeekKeys(e) {
    if (!Player.canControl()) return false;
    if (e.key === "ArrowLeft" || e.key === "j" || e.key === "J") {
      e.preventDefault();
      Player.seekBy(-5);
      return true;
    }
    if (e.key === "ArrowRight" || e.key === "l" || e.key === "L") {
      e.preventDefault();
      Player.seekBy(5);
      return true;
    }
    return false;
  }

  function handlePlaybackKeys(e) {
    if (!Player.canControl()) return false;
    if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey) {
      Player.replayFromStart();
      return true;
    }
    if ((e.key === "m" || e.key === "M") && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      Player.toggleMute();
      return true;
    }
    return false;
  }

  function handleChoiceKeys(e) {
    if (game.getPhase() !== "playing") return false;
    if (!["1", "2", "3", "4"].includes(e.key)) return false;
    const choiceIdx = parseInt(e.key, 10) - 1;
    if (choiceIdx < s.quizData[s.currentIndex].options.length) game.selectOption(choiceIdx);
    return true;
  }

  function handleEnterKey(e) {
    if (e.code !== "Enter") return false;
    e.preventDefault();
    const phase = game.getPhase();
    if (phase === "finished") game.resetToStart();
    else if (phase === "waiting") game.startExtract();
    else if (phase === "playing" && s.selectedChoice !== null) game.validateAnswer();
    else if (phase === "validated") game.nextQuestion();
    return true;
  }

  window.addEventListener("keydown", function (e) {
    if (handlePickerShortcut(e)) return;
    if (ui.isPickerOpen()) return;

    if (e.code === "Space") {
      e.preventDefault();
      Player.togglePlayPause();
    }

    handleSeekKeys(e);
    handlePlaybackKeys(e);
    handleChoiceKeys(e);
    handleEnterKey(e);
  });

  /* Démarrage : session fraîche, picker, restore du dernier quiz. */
  const catalog = game.getCatalog();
  store.ensureFreshSession();
  ui.fillQuizPicker(catalog);
  const initialId = store.readActiveQuizId(catalog);
  if (initialId) {
    game.loadQuizById(initialId, { restore: true });
  } else {
    console.error("Aucun quiz dans window.QUIZ_CATALOG");
    toast("Aucun quiz chargé — vérifie quiz/manifest.js et les fichiers listés.", "error");
  }
})();
