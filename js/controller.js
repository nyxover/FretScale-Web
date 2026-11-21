/* CONTRÔLEUR - FretScaleWeb : événements, audio, micrométrie et orchestration */
(function () {
  'use strict';
  const NS = (window.FretScale = window.FretScale || {});
  const M = NS.Model, V = NS.View;
  const $ = function (id) { return document.getElementById(id); };
  const {
    state, SHARP, FLAT, TEMPLATES, MOODS,
    parseNoteName, mod12, sharpName, fretStrings, generateProgression,
    detectPitch, analyzeHistory, detectChordSpectrum, generateRiff,
    chordDisplayName, canonicalTonicName
  } = M;
  const { renderAll, renderFretboard, renderFretAdvice, renderChords, renderRiff,
          renderNoob, showBanner, hideBanner } = V;

  /* Sur PC, les longs textes sont repliés : aucun panneau ne défile. */
  function syncDetails() {
    const compact = window.innerWidth >= 1200;
    Array.prototype.forEach.call(
      document.querySelectorAll('details.grid-help, details.theory-details'),
      function (d) {
        if (compact) d.removeAttribute('open');
        else d.setAttribute('open', '');
      }
    );
  }

  /* Délégation d'événements pour les éléments reconstruits par la vue. */
  function bindNoteTargets(id, duration) {
    const container = $(id);
    container.addEventListener('pointerdown', function (e) {
      const el = e.target.closest ? e.target.closest('[data-midi]') : null;
      if (!el || !container.contains(el)) return;
      const midi = Number(el.getAttribute('data-midi'));
      playTone(midi, duration);
      state.tempNoteUntil = performance.now() + 700;
      state.detectedPc = mod12(midi);
      triggerRiff(mod12(midi), null);
      renderAll();
      setTimeout(renderAll, 720);
    });
  }

    function selectFret(stringIndex, fret) {
    const strings = fretStrings();
    const midi = strings[stringIndex].midi + fret;
    const pc = mod12(midi);
    state.selectedFret = { string: stringIndex, fret: fret, instrument: state.instrument };
    playTone(midi, 0.6);
    triggerRiff(pc, null);
    renderFretboard();
    renderFretAdvice(strings, pc, fret, stringIndex);
  }


    function toggleNoob() {
    state.noobMode = !state.noobMode;
    document.body.classList.toggle('noob', state.noobMode);
    const btn = $('noobBtn');
    btn.textContent = state.noobMode ? '🎓 Mode normal' : '🤓 Mode super noob';
    btn.setAttribute('aria-pressed', String(state.noobMode));
    renderNoob();
  }


    function triggerRiff(pc, chord) {
    state.riffLast = { pc: pc, chord: chord };
    const sig = chord ? 'c:' + chordDisplayName(chord) + ':' + chord.notes.join(',')
                      : (pc !== null && pc !== undefined ? 'n:' + pc : '');
    if (!sig || sig === state.riffSignature) return;
    state.riffSignature = sig;
    generateRiff(state.riffLast);
    renderRiff();
  }


    function regenerateRiff() {
    state.riffVariation++;
    state.riffSignature = null;
    generateRiff(state.riffLast || { pc: state.tonicPc, chord: null });
    renderRiff();
  }


    function ensureAudio() {
    if (!state.audio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      state.audio = new Ctx();
    }
    if (state.audio.state === 'suspended') state.audio.resume();
    return state.audio;
  }


    function playTone(midi, dur) {
    const ctx = ensureAudio();
    if (!ctx) return;
    dur = dur || 0.4;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }


    function stopProgression() {
    state.playTimers.forEach(clearTimeout);
    state.playTimers = [];
    state.playingProgression = false;
    $('playBtn').textContent = '▶ Écouter';
  }


    function playProgression() {
    if (state.playingProgression) { stopProgression(); return; }
    const ctx = ensureAudio();
    if (!ctx) return;
    state.playingProgression = true;
    $('playBtn').textContent = '■ Arrêter';
    let delay = 100;
    state.progressionChords.forEach(function (c) {
      c.notes.forEach(function (pc, idx) {
        const midi = 60 + pc;
        state.playTimers.push(setTimeout(function () { playTone(midi, 0.45); }, delay + idx * 150));
      });
      delay += 780;
    });
    state.playTimers.push(setTimeout(stopProgression, delay + 200));
  }


    function micLoop() {
    if (!state.micActive || !state.analyser) return;
    const now = performance.now();
    if (now - state.lastDetect >= 40) {
      state.lastDetect = now;
      state.analyser.getFloatTimeDomainData(state.timeBuf);
      const result = detectPitch(state.timeBuf, state.audio.sampleRate);
      const bar = $('clarityBar');
      const txt = $('clarityTxt');
      if (result) {
        const pct = Math.round(result.clarity * 100);
        bar.style.width = pct + '%';
        txt.textContent = pct + '%';
        const midi = Math.round(69 + 12 * Math.log2(result.freq / 440));
        state.detectedMidi = midi;
        state.detectedPc = mod12(midi);
        state.lastPitchAt = now;
        state.history.push({ pc: mod12(midi), t: now });
        if (state.history.length > 240) state.history.shift();
      } else {
        bar.style.width = '0%';
        txt.textContent = '0%';
        if (now - state.lastPitchAt > 400) {
          state.detectedMidi = null;
          state.detectedPc = null;
        }
      }
      // Analyse spectrale moins fréquente (accords simultanés).
      if (now - state.lastSpectrumAt > 150) {
        state.lastSpectrumAt = now;
        detectChordSpectrum();
      }
      analyzeHistory();
      if (state.detectedChord) triggerRiff(null, state.detectedChord);
      else if (state.detectedPc !== null) triggerRiff(state.detectedPc, null);
      if (now - state.lastRender > 140) {
        state.lastRender = now;
        renderAll();
      }
    }
    requestAnimationFrame(micLoop);
  }


    async function toggleMic() {
    if (state.micActive) { stopMic(); return; }
    const ctx = ensureAudio();
    if (!ctx || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showBanner('Micro indisponible : ouvre la page en HTTPS ou depuis localhost (et non en fichier local sur iPhone).', true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      state.stream = stream;
      state.source = ctx.createMediaStreamSource(stream);
      state.analyser = ctx.createAnalyser();
      state.analyser.fftSize = 2048;
      state.timeBuf = new Float32Array(state.analyser.fftSize);
      state.spectrumAnalyser = ctx.createAnalyser();
      state.spectrumAnalyser.fftSize = 8192;
      state.spectrumAnalyser.smoothingTimeConstant = 0.35;
      state.freqBuf = new Float32Array(state.spectrumAnalyser.frequencyBinCount);
      state.source.connect(state.analyser);         // YIN (note solo)
      state.source.connect(state.spectrumAnalyser); // FFT (accords) - jamais vers la sortie : pas de retour audio
      state.micActive = true;
      $('micBtn').textContent = '🛑 Arrêter le micro';
      $('micBtn').classList.add('listening');
      hideBanner();
      micLoop();
    } catch (err) {
      showBanner('Accès micro refusé (' + (err && err.name ? err.name : 'erreur') + '). Autorise le micro dans ton navigateur et utilise HTTPS ou localhost.', true);
    }
  }


    function stopMic() {
    state.micActive = false;
    if (state.stream) state.stream.getTracks().forEach(function (t) { t.stop(); });
    if (state.source) { try { state.source.disconnect(); } catch (e) { /* noop */ } }
    state.stream = null;
    state.source = null;
    state.analyser = null;
    state.spectrumAnalyser = null;
    state.spectralChord = null;
    state.history = [];
    state.detectedPc = null;
    state.detectedChord = null;
    state.detectedMidi = null;
    $('micBtn').textContent = '🎤 Activer le micro';
    $('micBtn').classList.remove('listening');
    $('clarityBar').style.width = '0%';
    $('clarityTxt').textContent = '0%';
    renderAll();
  }


    function readControls(syncTonic) {
    if (syncTonic !== false) {
      const raw = $('keyInput').value.trim();
      const pc = parseNoteName(raw);
      // On ne réécrit PAS le champ pendant la saisie : c'était la cause du bug.
      if (pc !== null) { state.tonicPc = pc; state.tonicTyped = raw; }
    }
    const mode = $('scaleSelect').value;
    state.mode = (mode === 'minor') ? 'minor' : 'major';
    state.progression = TEMPLATES[$('progSelect').value] ? $('progSelect').value : 'pop';
    const len = parseInt($('lengthInput').value, 10);
    state.length = isFinite(len) ? Math.max(1, Math.min(16, len)) : 4;
    state.instrument = $('instrumentSelect').value === 'bass' ? 'bass' : 'guitar';
    if (state.selectedFret && state.selectedFret.instrument !== state.instrument) {
      state.selectedFret = null;
      $('fretAdvice').className = 'fret-advice';
      $('fretAdvice').innerHTML = '<span class="advice-icon">👆</span><div><b>Aucune case sélectionnée.</b><br>Touche une frette pour voir le conseil.</div>';
    }
  }


    function normalizeKey() {
    $('keyInput').value = canonicalTonicName();
    state.tonicTyped = $('keyInput').value;
  }


    function refresh(syncTonic) {
      readControls(syncTonic);
      generateProgression();
      renderChords();
      renderAll();
    }


    function init() {
    $('micBtn').addEventListener('click', toggleMic);
    $('noobBtn').addEventListener('click', toggleNoob);
    $('genBtn').addEventListener('click', function () { normalizeKey(); refresh(false); });
    $('playBtn').addEventListener('click', playProgression);
    $('keyInput').addEventListener('input', function () { refresh(true); });
    $('keyInput').addEventListener('change', function () { normalizeKey(); refresh(false); });
    $('keyInput').addEventListener('blur', function () { normalizeKey(); refresh(false); });
    $('scaleSelect').addEventListener('change', function () { refresh(false); });
    $('progSelect').addEventListener('change', function () { refresh(false); });
    $('lengthInput').addEventListener('input', function () { refresh(false); });
    $('instrumentSelect').addEventListener('change', function () { refresh(false); regenerateRiff(); });
    $('moodSelect').addEventListener('change', function () {
      state.mood = MOODS[$('moodSelect').value] ? $('moodSelect').value : 'groove';
      regenerateRiff();
    });
    $('riffBtn').addEventListener('click', regenerateRiff);
    $('fretboard').addEventListener('pointerdown', function (e) {
      const el = e.target.closest ? e.target.closest('.fret') : null;
      if (!el) return;
      selectFret(Number(el.getAttribute('data-string')), Number(el.getAttribute('data-fret')));
    });
    bindNoteTargets('piano', 0.55);
    bindNoteTargets('noteGrid', 0.5);
    $('chords').addEventListener('pointerdown', function (e) {
      const row = e.target.closest ? e.target.closest('[data-index]') : null;
      if (!row) return;
      const c = state.progressionChords[Number(row.getAttribute('data-index'))];
      if (c) triggerRiff(null, c);
    });
    $('noteChips').addEventListener('click', function (e) {
      const btn = e.target.closest ? e.target.closest('button[data-pc]') : null;
      if (!btn) return;
      $('keyInput').value = SHARP[Number(btn.getAttribute('data-pc'))].replace('♯', '#');
      refresh(true);
      normalizeKey();
    });

    // Avertissement utile pour le micro en fichier local / contexte non sécurisé.
    if (location.protocol === 'file:') {
      showBanner('Mode fichier local : les réglages et les progressions fonctionnent. Pour le micro sur mobile, sers le dossier en HTTPS ou via localhost (ex. « python -m http.server »).');
    } else if (!window.isSecureContext) {
      showBanner('Contexte non sécurisé : le micro sera bloqué. Utilise HTTPS ou localhost.', true);
    }

    window.addEventListener('resize', syncDetails);
    syncDetails();
    readControls(true);
    generateProgression();
    renderChords();
    state.riffLast = { pc: state.tonicPc, chord: null };
    generateRiff(state.riffLast);
    renderAll();
  }


  // API publique conservée pour les tests et la console.
  window.FretScaleWeb = {
    generateProgression: generateProgression,
    getState: function () { return JSON.parse(JSON.stringify(state)); },
    buildDiatonicChords: M.buildDiatonicChords,
    recognizeChord: M.recognizeChord,
    detectPitch: detectPitch,
    detectChordSpectrum: detectChordSpectrum,
    findVoicing: M.findVoicing,
    findNotePosition: M.findNotePosition,
    findTwoStringShape: M.findTwoStringShape,
    adviceFor: M.adviceFor,
    nearestGoodFret: M.nearestGoodFret,
    generateRiff: generateRiff,
    regenerateRiff: regenerateRiff,
    triggerRiff: triggerRiff
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
