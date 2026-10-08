/**
 * DOM refs + helpers de panneaux animés.
 * Dépend de window.QuizApp (store.js). Chargé avant ui-panels / ui-round.
 *
 * Visibilité :
 *   is-open   → surface animée visible (récap, picker, fin, règles, debrief, toast)
 *   hidden    → display:none (récap, picker, fin, toast ; aussi toggles runtime
 *               actionsRow / placeholder / btnBigPlay) — pas règles/debrief (overlays)
 *   is-hidden → fade label/hint du picker (frères, pas un panneau)
 */
(function () {
  "use strict";

  const App = window.QuizApp;
  if (!App) {
    console.error("QuizApp manquant — charge store.js avant ui-core.js");
    return;
  }

  const PANEL_CLOSE_MS = App.PANEL_CLOSE_MS;

  App.els = {
    placeholder: document.getElementById("player-placeholder"),
    placeholderText: document.getElementById("placeholder-text"),
    btnBigPlay: document.getElementById("btn-big-play"),
    quizPicker: document.getElementById("quiz-picker"),
    quizLabel: document.getElementById("quiz-label"),
    pickerHint: document.getElementById("picker-hint"),
    scoreCount: document.getElementById("score-count"),
    remainCount: document.getElementById("remain-count"),
    metaRemain: document.getElementById("meta-remain"),
    videoTitle: document.getElementById("video-title"),
    channelAvatar: document.getElementById("channel-avatar"),
    channelName: document.getElementById("channel-name"),
    bioStatus: document.getElementById("bio-status"),
    rulesBox: document.getElementById("rules-box"),
    btnRules: document.getElementById("btn-rules"),
    debriefText: document.getElementById("debrief-text"),
    choicesContainer: document.getElementById("choices-container"),
    btnAction: document.getElementById("btn-action"),
    endPanel: document.getElementById("end-panel"),
    endScore: document.getElementById("end-score"),
    actionsRow: document.getElementById("actions-row"),
    btnRestart: document.getElementById("btn-restart"),
    btnRecap: document.getElementById("btn-recap"),
    btnRecapClose: document.getElementById("btn-recap-close"),
    recapPanel: document.getElementById("recap-panel"),
    recapList: document.getElementById("recap-list"),
    logoEm: document.querySelector(".logo em"),
    watch: document.querySelector(".watch")
  };

  const panelTimers = { recap: 0, picker: 0, end: 0 };

  function prefersReducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (_) {
      return false;
    }
  }

  function clearPanelTimer(name) {
    if (panelTimers[name]) {
      clearTimeout(panelTimers[name]);
      panelTimers[name] = 0;
    }
  }

  /**
   * Ouvre un panneau animé (`hidden` retiré + classe `is-open`).
   * @param {HTMLElement|null} el
   * @param {"recap"|"picker"|"end"} timerName
   */
  function openPanel(el, timerName) {
    if (!el) return;
    clearPanelTimer(timerName);
    el.hidden = false;
    el.classList.remove("is-open");
    void el.offsetWidth;
    el.classList.add("is-open");
  }

  /**
   * Ferme un panneau animé.
   * @param {HTMLElement|null} el
   * @param {"recap"|"picker"|"end"} timerName
   * @param {{instant?: boolean, onDone?: function(): void}} [opts]
   */
  function closePanel(el, timerName, opts) {
    if (!el) return;
    clearPanelTimer(timerName);
    const skipAnim = (opts && opts.instant) || prefersReducedMotion();
    const onDone = opts && opts.onDone;
    el.classList.remove("is-open");

    function finish() {
      el.hidden = true;
      panelTimers[timerName] = 0;
      if (onDone) onDone();
    }

    if (skipAnim || el.hidden) {
      finish();
      return;
    }
    panelTimers[timerName] = setTimeout(finish, PANEL_CLOSE_MS);
  }

  App.uiCore = {
    prefersReducedMotion: prefersReducedMotion,
    openPanel: openPanel,
    closePanel: closePanel
  };

  App.ui = App.ui || {};
})();
