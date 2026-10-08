/**
 * Chrome d’un round : compteur, avatar, mystère, debrief, reset UI.
 * Dépend de App.els + App.uiCore + App.ui (panels), QuizPlayer, QuizUtils.
 */
(function () {
  "use strict";

  const App = window.QuizApp;
  if (!App || !App.els || !App.uiCore || !App.ui) {
    console.error("QuizApp UI incomplet — charge ui-core + ui-panels avant ui-round.js");
    return;
  }

  const toast = window.showQuizToast || function () {};
  const Player = window.QuizPlayer;
  const Utils = window.QuizUtils;
  const els = App.els;
  const core = App.uiCore;
  const ui = App.ui;

  function playEnterAnim() {
    if (!els.watch || core.prefersReducedMotion()) return;
    els.watch.classList.remove("is-entering");
    void els.watch.offsetWidth;
    els.watch.classList.add("is-entering");
  }

  function clearDebrief() {
    els.debriefText.textContent = "";
    els.debriefText.classList.remove("is-open", "is-ok", "is-ko");
  }

  function updateRemain() {
    const s = App.state;
    /* Restants = non encore répondues (la question validée ne compte plus). */
    const n = Math.max(0, s.quizData.length - s.answerHistory.length);
    els.remainCount.textContent = String(n);
    els.metaRemain.textContent = n === 1 ? "1 restant" : n + " restants";
    if (els.scoreCount) {
      els.scoreCount.textContent = String(App.store.scoreFromHistory().ok);
    }
  }

  function setMysteryAvatar() {
    els.channelAvatar.removeAttribute("src");
    els.channelAvatar.alt = "";
    els.channelAvatar.classList.add("is-mystery");
    els.channelName.textContent = "Extrait mystère";
  }

  function setAvatar(item, questionNumber) {
    if (!item.avatar) {
      toast("Avatar manquant pour la question #" + questionNumber + ".", "warn");
      setMysteryAvatar();
      return;
    }
    els.channelAvatar.classList.remove("is-mystery");
    els.channelAvatar.src = Utils.encodeMediaPath(item.avatar);
    /* Pas de réponse dans alt avant validation (a11y / spoiler lecteur d’écran). */
    els.channelAvatar.alt = "";
    els.channelAvatar.onerror = function () {
      toast("Avatar manquant : " + item.avatar, "warn");
      els.channelAvatar.onerror = null;
      setMysteryAvatar();
    };
  }

  /**
   * Titre du quiz + labels mystère (l’avatar image est géré à part via setAvatar).
   */
  function setWaitingLabels() {
    els.videoTitle.textContent = App.state.quizTitle || "obs-quiz-player";
    els.channelName.textContent = "Extrait mystère";
    els.bioStatus.textContent = "Propositions";
  }

  function resetRoundChrome() {
    ui.setRulesOpen(false);
    ui.closeEndPanel({ instant: true });
    ui.closeRecap({ instant: true });
    els.actionsRow.hidden = false;
    clearDebrief();
    els.placeholder.hidden = false;
    els.placeholderText.textContent = "Clique pour lancer l’extrait";
    els.btnBigPlay.hidden = false;
    ui.closeQuizPicker({ instant: true });
    Player.setChromeEnabled(false);
    els.btnAction.textContent = "Valider mon choix";
    els.btnAction.disabled = true;
  }

  Object.assign(App.ui, {
    playEnterAnim: playEnterAnim,
    clearDebrief: clearDebrief,
    updateRemain: updateRemain,
    setMysteryAvatar: setMysteryAvatar,
    setAvatar: setAvatar,
    setWaitingLabels: setWaitingLabels,
    resetRoundChrome: resetRoundChrome
  });
})();
