/**
 * Persistence quiz (localStorage / sessionStorage).
 * Crée window.QuizApp — chargé avant ui-*.js, game-*.js et events.js.
 */
(function () {
  "use strict";

  const ACTIVE_KEY = "qui-est-ce-active-quiz";
  const SESSION_FLAG = "qui-est-ce-session";
  const RECAP_PREFIX = "qui-est-ce-recap_";
  const PROGRESS_PREFIX = "qui-est-ce-progress_";
  const Utils = window.QuizUtils;

  const App = {
    PANEL_CLOSE_MS: 220,
    state: {
      activeQuizId: null,
      quizData: [],
      quizTitle: "",
      answerHistory: [],
      currentIndex: 0,
      selectedChoice: null,
      /** @type {"waiting"|"playing"|"validated"|"finished"} */
      phase: "waiting"
    }
  };

  function progressKey() {
    return PROGRESS_PREFIX + App.state.activeQuizId;
  }

  function recapKey() {
    return RECAP_PREFIX + App.state.activeQuizId;
  }

  function clearKeysByPrefix(store, prefix) {
    try {
      const keys = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.indexOf(prefix) === 0) keys.push(k);
      }
      keys.forEach(function (k) { store.removeItem(k); });
    } catch (e) { console.warn("Avertissement:", e); }
  }

  function clearAllProgress() {
    clearKeysByPrefix(localStorage, PROGRESS_PREFIX);
  }

  function clearAllRecaps() {
    clearKeysByPrefix(sessionStorage, RECAP_PREFIX);
  }

  /**
   * Nouvelle session navigateur (flag sessionStorage absent) →
   * wipe progression + récaps de tous les quiz. Distinct du hard-refresh
   * (quiz actif seulement, voir events.js).
   */
  function ensureFreshSession() {
    try {
      if (!sessionStorage.getItem(SESSION_FLAG)) {
        clearAllProgress();
        clearAllRecaps();
        sessionStorage.setItem(SESSION_FLAG, "1");
      }
    } catch (e) { console.warn("Avertissement:", e); }
  }

  /**
   * Dernier quiz actif encore présent dans le catalogue, sinon le premier id.
   * @param {Object<string, unknown>} catalog
   * @returns {string|null}
   */
  function readActiveQuizId(catalog) {
    try {
      const saved = localStorage.getItem(ACTIVE_KEY);
      if (saved && catalog[saved]) return saved;
    } catch (e) { console.warn("Avertissement:", e); }
    const ids = Object.keys(catalog);
    return ids.length ? ids[0] : null;
  }

  /**
   * Mémorise le quiz actif (état + localStorage).
   * @param {string} id
   */
  function setActiveQuizId(id) {
    App.state.activeQuizId = id;
    try { localStorage.setItem(ACTIVE_KEY, id); } catch (e) { console.warn("Avertissement:", e); }
  }

  /** Persiste l’historique de réponses (sessionStorage). */
  function saveRecap() {
    const s = App.state;
    if (!s.activeQuizId) return;
    try {
      sessionStorage.setItem(recapKey(), JSON.stringify({
        history: s.answerHistory
      }));
    } catch (e) { console.warn("Avertissement:", e); }
  }

  /** Efface le récap stocké et remet l’historique en mémoire à []. */
  function clearRecap() {
    if (!App.state.activeQuizId) return;
    try { sessionStorage.removeItem(recapKey()); } catch (e) { console.warn("Avertissement:", e); }
    App.state.answerHistory = [];
  }

  /**
   * Lit le récap session du quiz actif.
   * @returns {{history: Array}|null}
   */
  function readRecap() {
    if (!App.state.activeQuizId) return null;
    try {
      const raw = sessionStorage.getItem(recapKey());
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!Array.isArray(data.history)) return null;
      return data;
    } catch (e) {
      console.warn("Avertissement:", e);
      return null;
    }
  }

  /** Efface la progression localStorage du quiz actif. */
  function clearProgress() {
    try { localStorage.removeItem(progressKey()); } catch (e) { console.warn("Avertissement:", e); }
  }

  /** Persiste index, phase, choix et ordre shuffle du round courant. */
  function saveProgress() {
    const s = App.state;
    if (!s.activeQuizId) return;
    try {
      const item = s.quizData[s.currentIndex];
      localStorage.setItem(progressKey(), JSON.stringify({
        currentIndex: s.currentIndex,
        selectedChoice: s.selectedChoice,
        phase: s.phase,
        options: item ? item.options.slice() : null,
        correctIndex: item ? item.correctIndex : null
      }));
    } catch (e) { console.warn("Avertissement:", e); }
  }

  /**
   * Lit et normalise la progression du quiz actif.
   * @returns {{currentIndex: number, selectedChoice: *, phase: string, options: string[]|null, correctIndex: number|null}|null}
   */
  function readProgress() {
    try {
      const raw = localStorage.getItem(progressKey());
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (typeof data.currentIndex !== "number") return null;
      data.phase = Utils.normalizeSavedPhase(data.phase);
      return data;
    } catch (e) {
      console.warn("Avertissement:", e);
      return null;
    }
  }

  /**
   * Score courant via QuizUtils (délègue `App.state.answerHistory`).
   * @returns {{ok: number, total: number}}
   */
  function scoreFromHistory() {
    return Utils.scoreFromHistory(App.state.answerHistory);
  }

  /**
   * Enregistre (ou écrase) la réponse du round courant, puis sauve le récap.
   * @param {{options: string[], correctIndex: number}} item
   * @param {number|null|undefined} choice
   */
  function recordAnswer(item, choice) {
    const s = App.state;
    const opts = item.options;
    const hasCorrect = Utils.hasValidOptionIndex(opts, item.correctIndex);
    const selectedLabel =
      choice !== null && choice !== undefined && Utils.hasValidOptionIndex(opts, choice)
        ? opts[choice]
        : null;
    const entry = {
      correctLabel: Utils.resolveOptionLabel(opts, item.correctIndex),
      selectedLabel: selectedLabel,
      isCorrect: hasCorrect && choice === item.correctIndex
    };
    if (s.answerHistory.length > s.currentIndex) {
      s.answerHistory[s.currentIndex] = entry;
      s.answerHistory = s.answerHistory.slice(0, s.currentIndex + 1);
    } else {
      s.answerHistory.push(entry);
    }
    saveRecap();
  }

  App.store = {
    ensureFreshSession: ensureFreshSession,
    readActiveQuizId: readActiveQuizId,
    setActiveQuizId: setActiveQuizId,
    saveRecap: saveRecap,
    clearRecap: clearRecap,
    readRecap: readRecap,
    clearProgress: clearProgress,
    saveProgress: saveProgress,
    readProgress: readProgress,
    scoreFromHistory: scoreFromHistory,
    recordAnswer: recordAnswer
  };

  window.QuizApp = App;
})();
