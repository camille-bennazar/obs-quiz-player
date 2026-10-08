/**
 * Toast partagé (boot + quiz + player).
 * Expose window.showQuizToast.
 */
(function () {
  "use strict";

  let toastTimer = 0;

  /**
   * Affiche un toast temporaire (classe `toast-{type}`).
   * @param {string} message
   * @param {"error"|"warn"} [type="error"]
   */
  function showQuizToast(message, type) {
    const el = document.getElementById("toast");
    if (!el || !message) return;
    el.hidden = false;
    el.textContent = message;
    el.className = "toast is-open toast-" + (type || "error");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("is-open");
      toastTimer = setTimeout(function () {
        el.hidden = true;
        toastTimer = 0;
      }, 220);
    }, 4200);
  }

  window.showQuizToast = showQuizToast;
})();
