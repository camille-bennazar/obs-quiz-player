/**
 * Picker, récap, règles, score de fin, méta quiz.
 * Dépend de App.els + App.uiCore (ui-core.js).
 */
(function () {
  "use strict";

  const App = window.QuizApp;
  if (!App || !App.els || !App.uiCore) {
    console.error("QuizApp UI incomplet — charge ui-core.js avant ui-panels.js");
    return;
  }

  const els = App.els;
  const core = App.uiCore;

  function fillQuizPicker(catalog) {
    if (!els.quizPicker) return;
    els.quizPicker.innerHTML = "";
    Object.keys(catalog).forEach(function (id) {
      const entry = catalog[id];
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = entry.title || id;
      els.quizPicker.appendChild(opt);
    });
  }

  function isPickerOpen() {
    return els.quizPicker && els.quizPicker.classList.contains("is-open");
  }

  function openQuizPicker() {
    if (!els.quizPicker || !els.placeholder || els.placeholder.hidden) return;
    if (els.quizLabel) els.quizLabel.classList.add("is-hidden");
    if (els.pickerHint) els.pickerHint.classList.add("is-hidden");
    if (App.state.activeQuizId) els.quizPicker.value = App.state.activeQuizId;
    core.openPanel(els.quizPicker, "picker");
    els.quizPicker.focus();
    try {
      if (typeof els.quizPicker.showPicker === "function") els.quizPicker.showPicker();
    } catch (e) { console.warn("Avertissement:", e); }
  }

  function closeQuizPicker(opts) {
    if (!els.quizPicker) return;
    opts = opts || {};
    els.quizPicker.blur();
    const userOnDone = opts.onDone;
    core.closePanel(els.quizPicker, "picker", {
      instant: opts.instant,
      onDone: function () {
        if (els.quizLabel) els.quizLabel.classList.remove("is-hidden");
        if (els.pickerHint) els.pickerHint.classList.remove("is-hidden");
        if (userOnDone) userOnDone();
      }
    });
  }

  function applyQuizMeta() {
    const s = App.state;
    if (els.logoEm) els.logoEm.textContent = s.quizTitle || s.activeQuizId || "";
    if (els.quizLabel) els.quizLabel.textContent = s.quizTitle || s.activeQuizId || "";
    if (els.quizPicker && s.activeQuizId) els.quizPicker.value = s.activeQuizId;
  }

  function updateEndScore() {
    if (!els.endScore) return;
    const s = App.store.scoreFromHistory();
    const total = App.state.quizData.length || s.total;
    els.endScore.innerHTML =
      "Score : <span class=\"end-score-ok\">" + s.ok + "</span>" +
      "<span class=\"end-score-total\"> / " + total + "</span>";
  }

  function openEndPanel() {
    if (!els.endPanel) return;
    core.openPanel(els.endPanel, "end");
  }

  function closeEndPanel(opts) {
    if (!els.endPanel) return;
    core.closePanel(els.endPanel, "end", opts || {});
  }

  function closeRecap(opts) {
    if (!els.recapPanel) return;
    if (els.btnRecap) els.btnRecap.textContent = "Voir le récap";
    core.closePanel(els.recapPanel, "recap", opts || {});
  }

  function renderRecap() {
    if (!els.recapList) return;
    els.recapList.innerHTML = "";
    const history = App.state.answerHistory;
    if (!history.length) {
      const empty = document.createElement("li");
      empty.className = "recap-empty";
      empty.textContent = "Aucune réponse enregistrée pour cette session.";
      els.recapList.appendChild(empty);
      return;
    }
    history.forEach(function (h, i) {
      const li = document.createElement("li");
      li.className = "recap-item " + (h.isCorrect ? "is-ok" : "is-ko");

      const badge = document.createElement("span");
      badge.className = "recap-badge";
      badge.textContent = h.isCorrect ? "✓" : "✗";

      const body = document.createElement("div");
      body.className = "recap-body";
      const title = document.createElement("strong");
      title.textContent = "#" + (i + 1) + " — " + (h.correctLabel || "—");
      const detail = document.createElement("span");
      if (h.isCorrect) {
        detail.textContent = "Bonne réponse";
      } else {
        detail.textContent = "Ton choix : " + (h.selectedLabel || "—");
      }
      body.appendChild(title);
      body.appendChild(detail);

      li.appendChild(badge);
      li.appendChild(body);
      els.recapList.appendChild(li);
    });
  }

  function openRecap() {
    if (!els.recapPanel) return;
    renderRecap();
    core.openPanel(els.recapPanel, "recap");
    if (els.btnRecap) els.btnRecap.textContent = "Masquer le récap";
  }

  function toggleRecap() {
    if (!els.recapPanel) return;
    if (els.recapPanel.hidden || !els.recapPanel.classList.contains("is-open")) openRecap();
    else closeRecap();
  }

  function setRulesOpen(open) {
    els.rulesBox.classList.toggle("is-open", open);
    els.btnRules.classList.toggle("is-open", open);
    els.btnRules.setAttribute("aria-expanded", open ? "true" : "false");
  }

  Object.assign(App.ui, {
    fillQuizPicker: fillQuizPicker,
    isPickerOpen: isPickerOpen,
    openQuizPicker: openQuizPicker,
    closeQuizPicker: closeQuizPicker,
    applyQuizMeta: applyQuizMeta,
    updateEndScore: updateEndScore,
    openEndPanel: openEndPanel,
    closeEndPanel: closeEndPanel,
    closeRecap: closeRecap,
    toggleRecap: toggleRecap,
    setRulesOpen: setRulesOpen
  });
})();
