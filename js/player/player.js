/**
 * Lecteur vidéo style YouTube (chrome, volume, soft-end, preload).
 * Expose window.QuizPlayer. Dépend de window.QuizUtils (shared/utils.js).
 */
(function () {
  "use strict";

  const VOLUME_KEY = "qui-est-ce-volume";
  /* Soft-end : coupe avant la vraie fin pour éviter un artefact codec / freeze.
   * END_FADE_PAD  → début du fade volume vers 0
   * END_SOFT_PAD  → pause « douce » (avant duration)
   * END_STALL_PAD → si buffer stall près de la fin, force le soft-end */
  const END_SOFT_PAD = 0.3;
  const END_FADE_PAD = 0.55;
  const END_STALL_PAD = 1.5;

  const quizVideo = document.getElementById("quiz-video");
  const ytChrome = document.getElementById("yt-chrome");
  const btnPlay = document.getElementById("btn-play");
  const btnSeekBack = document.getElementById("btn-seek-back");
  const btnSeekFwd = document.getElementById("btn-seek-fwd");
  const ytProgress = document.getElementById("yt-progress");
  const ytProgressLoad = document.getElementById("yt-progress-load");
  const ytProgressPlay = document.getElementById("yt-progress-play");
  const ytTime = document.getElementById("yt-time");
  const btnMute = document.getElementById("btn-mute");
  const ytVolTrack = document.getElementById("yt-vol-track");
  const ytVolFill = document.getElementById("yt-vol-fill");
  const Utils = window.QuizUtils;

  let hooks = {
    phase: function () { return "waiting"; },
    onStartExtract: function () {}
  };

  /**
   * Contrôles actifs seulement en phase `playing` ou `validated`.
   * @returns {boolean}
   */
  function canControl() {
    const p = hooks.phase();
    return p === "playing" || p === "validated";
  }

  let userVolume = 1;
  let isMuted = false;
  let volDragging = false;
  let progressDragging = false;
  let progressRaf = 0;
  let softEnded = false;
  let endWatchRaf = 0;

  const nextPreloader = document.createElement("video");
  nextPreloader.preload = "auto";
  nextPreloader.muted = true;
  nextPreloader.setAttribute("playsinline", "");
  nextPreloader.style.display = "none";
  document.body.appendChild(nextPreloader);

  /** Ratio horizontal 0–1 depuis un clic / drag sur une piste. */
  function ratioFromEvent(track, e) {
    const rect = track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }

  /**
   * Remplace les sources d’un élément `<video>` (chemin encodé via QuizUtils).
   * @param {HTMLVideoElement} el
   * @param {string|null} video - Chemin relatif MP4, ou `null` pour vider
   */
  function setVideoSources(el, video) {
    el.removeAttribute("src");
    el.innerHTML = "";
    if (video) {
      const source = document.createElement("source");
      source.src = Utils.encodeMediaPath(video);
      source.type = "video/mp4";
      el.appendChild(source);
    }
    try { el.load(); } catch (e) { console.warn("Avertissement:", e); }
  }

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  /**
   * Active / désactive le chrome (boutons, aria, barre de progression).
   * @param {boolean} on
   */
  function setChromeEnabled(on) {
    ytChrome.classList.toggle("is-disabled", !on);
    btnPlay.disabled = !on;
    btnSeekBack.disabled = !on;
    btnSeekFwd.disabled = !on;
    btnMute.disabled = !on;
    ytProgress.tabIndex = on ? 0 : -1;
    ytVolTrack.tabIndex = on ? 0 : -1;
    ytProgress.setAttribute("aria-disabled", String(!on));
    ytVolTrack.setAttribute("aria-disabled", String(!on));
    if (!on) {
      ytChrome.classList.remove("is-active", "is-paused");
      btnPlay.classList.remove("pause");
      btnPlay.classList.add("play");
      ytProgressPlay.style.transform = "scaleX(0)";
      ytProgressLoad.style.transform = "scaleX(0)";
      ytTime.textContent = "0:00 / 0:00";
    }
  }

  function syncPlayButton() {
    const paused = quizVideo.paused;
    btnPlay.classList.toggle("play", paused);
    btnPlay.classList.toggle("pause", !paused);
    ytChrome.classList.toggle("is-paused", paused);
    ytChrome.classList.toggle("is-active", !paused);
  }

  function readVolumePrefs() {
    try {
      const raw = localStorage.getItem(VOLUME_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.volume === "number" && isFinite(data.volume)) {
        userVolume = Math.max(0, Math.min(1, data.volume));
      }
      if (typeof data.muted === "boolean") isMuted = data.muted;
    } catch (e) { console.warn("Avertissement:", e); }
  }

  function saveVolumePrefs() {
    try {
      localStorage.setItem(VOLUME_KEY, JSON.stringify({ volume: userVolume, muted: isMuted }));
    } catch (e) { console.warn("Avertissement:", e); }
  }

  function effectiveVolume() {
    return isMuted ? 0 : userVolume;
  }

  /** Synchronise barre de volume, bouton mute et volume réel de la vidéo. */
  function syncVolumeUI() {
    const eff = effectiveVolume();
    const show = isMuted ? 0 : userVolume;
    ytVolFill.style.transform = "scaleX(" + show + ")";
    ytVolTrack.classList.toggle("is-muted", isMuted || userVolume === 0);
    ytVolTrack.setAttribute("aria-valuenow", String(Math.round(show * 100)));
    ytVolTrack.setAttribute("aria-valuetext", Math.round(show * 100) + " %");
    btnMute.classList.toggle("is-muted", isMuted || userVolume === 0);
    btnMute.title = (isMuted || userVolume === 0) ? "Rétablir le son (M)" : "Muet (M)";
    btnMute.setAttribute("aria-label", btnMute.title);
    if (!softEnded) quizVideo.volume = eff;
    quizVideo.muted = false;
  }

  function setUserVolume(v, opts) {
    const next = Math.max(0, Math.min(1, v));
    userVolume = next;
    if (next > 0) isMuted = false;
    else isMuted = true;
    syncVolumeUI();
    if (!opts || opts.save !== false) saveVolumePrefs();
  }

  /** Bascule le mute (persiste les préférences volume). */
  function toggleMute() {
    if (isMuted) {
      isMuted = false;
      if (userVolume === 0) userVolume = 0.5;
    } else {
      isMuted = true;
    }
    syncVolumeUI();
    saveVolumePrefs();
  }

  /**
   * Précharge le prochain extrait dans un `<video>` hors écran.
   * @param {string|null|undefined} videoPath
   */
  function preloadRound(videoPath) {
    setVideoSources(nextPreloader, videoPath || null);
  }

  /** Remet le soft-end à zéro et restaure le volume effectif. */
  function resetSoftEnd() {
    softEnded = false;
    quizVideo.volume = effectiveVolume();
  }

  function stopEndWatch() {
    if (endWatchRaf) {
      cancelAnimationFrame(endWatchRaf);
      endWatchRaf = 0;
    }
  }

  function finishSoftEnd() {
    if (softEnded) return;
    softEnded = true;
    stopEndWatch();
    quizVideo.volume = 0;
    try { quizVideo.pause(); } catch (e) { console.warn("Avertissement:", e); }
    syncPlayButton();
    updateProgress();
  }

  function tickEndWatch() {
    endWatchRaf = 0;
    maybeSoftEnd();
    if (!softEnded && canControl() && !quizVideo.paused) {
      endWatchRaf = requestAnimationFrame(tickEndWatch);
    }
  }

  function startEndWatch() {
    if (endWatchRaf || softEnded) return;
    endWatchRaf = requestAnimationFrame(tickEndWatch);
  }

  function maybeSoftEnd() {
    if (!canControl() || softEnded || quizVideo.seeking) return;
    const dur = quizVideo.duration || 0;
    const cur = quizVideo.currentTime || 0;
    if (!dur || !isFinite(dur)) return;

    const base = effectiveVolume();
    const remain = dur - cur;
    if (remain > END_FADE_PAD) {
      if (quizVideo.volume !== base && !quizVideo.paused) quizVideo.volume = base;
      return;
    }
    if (remain > END_SOFT_PAD) {
      if (quizVideo.paused) return;
      const span = END_FADE_PAD - END_SOFT_PAD;
      const fade = Math.max(0, Math.min(1, (remain - END_SOFT_PAD) / span));
      quizVideo.volume = base * fade;
      return;
    }

    finishSoftEnd();
  }

  function updateProgressNow() {
    const dur = quizVideo.duration || 0;
    const cur = softEnded && dur ? dur : quizVideo.currentTime || 0;
    const pct = dur > 0 ? (cur / dur) * 100 : 0;
    ytProgressPlay.style.transform = "scaleX(" + (pct / 100) + ")";
    ytProgress.setAttribute("aria-valuenow", String(Math.round(pct)));
    ytTime.textContent = formatTime(cur) + " / " + formatTime(dur);
    ytProgress.setAttribute("aria-valuetext", formatTime(cur) + " sur " + formatTime(dur));

    if (quizVideo.buffered && quizVideo.buffered.length && dur > 0) {
      const end = quizVideo.buffered.end(quizVideo.buffered.length - 1);
      ytProgressLoad.style.transform = "scaleX(" + Math.min(1, end / dur) + ")";
    }

    maybeSoftEnd();
  }

  /** Met à jour barre / temps (throttle via requestAnimationFrame). */
  function updateProgress() {
    if (progressRaf) return;
    progressRaf = requestAnimationFrame(function () {
      progressRaf = 0;
      updateProgressNow();
    });
  }

  /**
   * Seek relatif en secondes (borné avant le soft-end).
   * @param {number} delta
   */
  function seekBy(delta) {
    if (!canControl()) return;
    const dur = quizVideo.duration || 0;
    resetSoftEnd();
    const maxT = Math.max(0, dur - END_SOFT_PAD);
    quizVideo.currentTime = Math.max(0, Math.min(maxT, (quizVideo.currentTime || 0) + delta));
    updateProgress();
  }

  /**
   * Relance l’extrait depuis le début (phases contrôlables uniquement).
   * Le rejet de `play()` (autoplay) est journalisé en avertissement.
   */
  function replayFromStart() {
    if (!canControl()) return;
    resetSoftEnd();
    quizVideo.currentTime = 0;
    quizVideo.play().catch(function (e) { console.warn("Avertissement:", e); });
    syncPlayButton();
    updateProgress();
  }

  /**
   * Play / pause selon la phase : en `waiting` délègue à `hooks.onStartExtract`.
   * Le rejet de `play()` (autoplay) est journalisé en avertissement.
   */
  function togglePlayPause() {
    const p = hooks.phase();
    if (p === "finished") return;
    if (p === "waiting") {
      hooks.onStartExtract();
      return;
    }
    if (quizVideo.paused) {
      if (softEnded) {
        replayFromStart();
        return;
      }
      quizVideo.play().catch(function (e) { console.warn("Avertissement:", e); });
    } else {
      quizVideo.pause();
    }
  }

  function seekToRatio(ratio) {
    if (!canControl()) return;
    const dur = quizVideo.duration || 0;
    if (!dur) return;
    resetSoftEnd();
    quizVideo.currentTime = Math.max(0, Math.min(dur - END_SOFT_PAD, ratio * dur));
    updateProgress();
  }

  function seekFromEvent(e) {
    seekToRatio(ratioFromEvent(ytProgress, e));
  }

  function bufferCoversTo(t) {
    const ranges = quizVideo.buffered;
    if (!ranges || !ranges.length) return false;
    try {
      for (let i = 0; i < ranges.length; i++) {
        if (ranges.start(i) <= quizVideo.currentTime + 0.05 && ranges.end(i) >= t) return true;
      }
    } catch (e) { console.warn("Avertissement:", e); }
    return false;
  }

  function handleNearEndStall() {
    if (!canControl() || softEnded || quizVideo.seeking) return;
    const dur = quizVideo.duration || 0;
    const cur = quizVideo.currentTime || 0;
    if (!dur || !isFinite(dur)) {
      quizVideo.play().catch(function (e) { console.warn("Avertissement:", e); });
      return;
    }
    const remain = dur - cur;
    if (remain <= END_STALL_PAD) {
      if (remain <= END_SOFT_PAD * 2 || !bufferCoversTo(dur - 0.05)) {
        finishSoftEnd();
      }
      return;
    }
    quizVideo.play().catch(function (e) { console.warn("Avertissement:", e); });
  }

  /**
   * Démarre la lecture depuis 0 (réinitialise le soft-end).
   * Le rejet de `play()` (autoplay) est journalisé en avertissement.
   */
  function playFromStart() {
    resetSoftEnd();
    quizVideo.currentTime = 0;
    quizVideo.play().catch(function (e) { console.warn("Avertissement:", e); });
    syncPlayButton();
    updateProgress();
  }

  /** Met la vidéo en pause. */
  function pause() {
    quizVideo.pause();
  }

  /**
   * Branche les hooks jeu → lecteur.
   * @param {{phase: function(): string, onStartExtract: function(): void}} nextHooks
   */
  function bind(nextHooks) {
    hooks = nextHooks;
  }

  readVolumePrefs();
  syncVolumeUI();

  btnPlay.addEventListener("click", togglePlayPause);
  btnSeekBack.addEventListener("click", function () { seekBy(-5); });
  btnSeekFwd.addEventListener("click", function () { seekBy(5); });
  btnMute.addEventListener("click", toggleMute);
  ytProgress.addEventListener("pointerdown", function (e) {
    if (!canControl() || !e.isPrimary) return;
    e.preventDefault();
    progressDragging = true;
    ytProgress.setPointerCapture(e.pointerId);
    seekFromEvent(e);
  });
  ytProgress.addEventListener("pointermove", function (e) {
    if (!progressDragging || !e.isPrimary) return;
    seekFromEvent(e);
  });
  ytProgress.addEventListener("pointerup", function (e) {
    progressDragging = false;
    if (ytProgress.hasPointerCapture(e.pointerId)) ytProgress.releasePointerCapture(e.pointerId);
  });
  ytProgress.addEventListener("pointercancel", function () {
    progressDragging = false;
  });
  ytProgress.addEventListener("keydown", function (e) {
    if (!canControl()) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") seekBy(-5);
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") seekBy(5);
    else if (e.key === "Home") seekToRatio(0);
    else if (e.key === "End") seekToRatio(1);
    else return;
    e.preventDefault();
    e.stopPropagation();
  });

  ytVolTrack.addEventListener("pointerdown", function (e) {
    if (btnMute.disabled) return;
    if (!e.isPrimary) return;
    e.preventDefault();
    volDragging = true;
    ytVolTrack.setPointerCapture(e.pointerId);
    setUserVolume(ratioFromEvent(ytVolTrack, e), { save: false });
  });
  ytVolTrack.addEventListener("pointermove", function (e) {
    if (!volDragging || !e.isPrimary) return;
    setUserVolume(ratioFromEvent(ytVolTrack, e), { save: false });
  });
  ytVolTrack.addEventListener("pointerup", function (e) {
    if (!volDragging) return;
    volDragging = false;
    if (ytVolTrack.hasPointerCapture(e.pointerId)) ytVolTrack.releasePointerCapture(e.pointerId);
    saveVolumePrefs();
  });
  ytVolTrack.addEventListener("pointercancel", function () {
    if (!volDragging) return;
    volDragging = false;
    saveVolumePrefs();
  });
  ytVolTrack.addEventListener("keydown", function (e) {
    if (btnMute.disabled) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") setUserVolume(userVolume - 0.05);
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") setUserVolume(userVolume + 0.05);
    else if (e.key === "Home") setUserVolume(0);
    else if (e.key === "End") setUserVolume(1);
    else return;
    e.preventDefault();
    e.stopPropagation();
  });

  quizVideo.addEventListener("timeupdate", updateProgress);
  quizVideo.addEventListener("progress", updateProgress);
  quizVideo.addEventListener("loadedmetadata", updateProgress);
  quizVideo.addEventListener("play", function () {
    syncPlayButton();
    startEndWatch();
  });
  quizVideo.addEventListener("pause", function () {
    stopEndWatch();
    syncPlayButton();
  });
  quizVideo.addEventListener("ended", function () {
    stopEndWatch();
    finishSoftEnd();
  });
  quizVideo.addEventListener("waiting", handleNearEndStall);
  quizVideo.addEventListener("stalled", handleNearEndStall);

  window.QuizPlayer = {
    bind: bind,
    canControl: canControl,
    setVideoSources: setVideoSources,
    setChromeEnabled: setChromeEnabled,
    syncVolumeUI: syncVolumeUI,
    resetSoftEnd: resetSoftEnd,
    updateProgress: updateProgress,
    togglePlayPause: togglePlayPause,
    seekBy: seekBy,
    replayFromStart: replayFromStart,
    toggleMute: toggleMute,
    preloadRound: preloadRound,
    playFromStart: playFromStart,
    pause: pause,
    video: quizVideo
  };
})();
