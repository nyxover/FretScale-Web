/* MODÈLE - FretScaleWeb : état, théorie musicale et algorithmes (sans DOM) */
(function () {
  'use strict';
  const M = (window.FretScale = window.FretScale || {});

  const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const FLAT  = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],          // majeure
    minor: [0, 2, 3, 5, 7, 8, 10]           // mineure naturelle
  };

  // Grilles de progression (indices de degrés 0..6). La dominante (index 4)
  // est automatiquement "harmonisée" en mineur (voir buildDiatonicChords).
  const TEMPLATES = {
    pop:     { major: [0, 4, 5, 3], minor: [0, 6, 5, 4] },
    classic: { major: [0, 3, 4, 0], minor: [0, 3, 4, 0] },
    jazz:    { major: [1, 4, 0, 5], minor: [1, 4, 0, 3] }
  };

  // Modèles d'accords pour la reconnaissance (intervalles en demi-tons).
  const CHORD_TEMPLATES = [
    { suffix: '',   iv: [0, 4, 7] },        // majeur
    { suffix: 'm',  iv: [0, 3, 7] },        // mineur
    { suffix: '7',  iv: [0, 4, 7, 10] },    // dominante 7
    { suffix: 'm7', iv: [0, 3, 7, 10] },
    { suffix: 'maj7', iv: [0, 4, 7, 11] },
    { suffix: '°',  iv: [0, 3, 6] },        // diminué
    { suffix: '+',  iv: [0, 4, 8] },        // augmenté
    { suffix: 'sus4', iv: [0, 5, 7] }
  ];

  // Ambiances du générateur de riff ASCII (16 temps).
  const MOODS = {
    calme:  { label: 'Calme / ballade', steps: [0, 4, 8, 12], style: 'arp', note: 'une note tous les 4 temps' },
    groove: { label: 'Groove / funk',   steps: [0, 3, 6, 8, 11, 14], style: 'arp', note: 'rythme syncopé' },
    rock:   { label: 'Rock',           steps: [0, 2, 4, 6, 8, 10, 12, 14], style: 'power', note: 'croches appuyées en power-chords' },
    reggae: { label: 'Reggae',         steps: [2, 4, 6, 10, 12, 14], style: 'offbeat', note: 'contretemps' },
    jazz:   { label: 'Jazz',           steps: [0, 2, 3, 5, 7, 9, 11, 13, 15], style: 'arp', note: 'arpège swingué' },
    metal:  { label: 'Métal',          steps: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], style: 'power', note: 'double-croches en power-chords' }
  };

  // Cordes (du plus aigu au plus grave pour l'affichage, du plus grave au
  // plus aigu pour les calculs de frettes).
  const STRING_NAMES = {
    guitar: ['e', 'B', 'G', 'D', 'A', 'E'],
    bass:   ['G', 'D', 'A', 'E']
  };
  const OPEN_MIDI = {
    guitar: [40, 45, 50, 55, 59, 64],   // E A D G B e
    bass:   [28, 33, 38, 43]            // E A D G
  };

  const HISTORY_MS = 2600;   // fenêtre d'analyse des notes jouées
  const MIN_RMS = 0.012;     // seuil de volume (bruit de fond)

  // ---------------------------------------------------------------------------
  // État
  // ---------------------------------------------------------------------------
  const state = {
    tonicPc: 0,
    tonicTyped: 'C',
    selectedFret: null,
    mode: 'major',
    progression: 'pop',
    length: 4,
    instrument: 'guitar',
    noobMode: false,
    mood: 'groove',
    riffPattern: null,
    riffSignature: null,
    riffSource: null,
    riffLast: null,
    riffVariation: 0,
    progressionChords: [],
    detectedPc: null,
    detectedMidi: null,
    detectedChord: null,
    history: [],
    micActive: false,
    audio: null,
    stream: null,
    source: null,
    analyser: null,
    timeBuf: null,
    spectrumAnalyser: null,
    freqBuf: null,
    spectralChord: null,
    spectralChordAt: 0,
    lastDetect: 0,
    lastSpectrumAt: 0,
    lastRender: 0,
    lastPitchAt: 0,
    playTimers: [],
    playingProgression: false,
    tempNoteUntil: 0
  };



    function mod12(n) { return ((n % 12) + 12) % 12; }


    function parseNoteName(input) {
    let s = String(input || '').trim();
    s = s.replace(/♯/g, '#').replace(/♭/g, 'b');
    const m = /^([A-Ga-g])([#b]?)$/.exec(s);
    if (!m) return null;
    const base = LETTER_PC[m[1].toUpperCase()];
    const alt = m[2].toLowerCase();
    return mod12(base + (alt === '#' ? 1 : alt === 'b' ? -1 : 0));
  }


    function nameFor(pc) {
    pc = mod12(pc);
    return state.mode === 'minor' ? FLAT[pc] : SHARP[pc];
  }


    function sharpName(pc) { return SHARP[mod12(pc)]; }


    function noteLabel(midi) {
    const pc = mod12(midi);
    const octave = Math.floor(midi / 12) - 1;
    return nameFor(pc) + octave;
  }


    function buildScale(tonicPc, mode) {
    return SCALES[mode].map(function (i) { return mod12(tonicPc + i); });
  }


    function buildDiatonicChords(tonicPc, mode) {
    const scale = buildScale(tonicPc, mode);
    const chords = [];

    for (let d = 0; d < 7; d++) {
      const root   = scale[d];
      const third  = scale[(d + 2) % 7];
      const fifth  = scale[(d + 4) % 7];
      const t = mod12(third - root);
      const f = mod12(fifth - root);
      let quality = 'maj';
      if (t === 3 && f === 7) quality = 'min';
      else if (t === 3 && f === 6) quality = 'dim';
      else if (t === 4 && f === 8) quality = 'aug';
      chords.push({ degree: d, root: root, notes: [root, third, fifth], quality: quality, harmonic: false });
    }

    if (mode === 'minor') {
      // Dominante harmonique : on élève le 3e du Degré V pour obtenir la
      // note sensible (7e) et une vraie tension V -> i.
      chords[4].notes = [mod12(tonicPc + 7), mod12(tonicPc + 11), mod12(tonicPc + 2)];
      chords[4].quality = 'maj';
      chords[4].harmonic = true;
      // Le VII° utilise aussi la note sensible.
      chords[6].notes = [mod12(tonicPc + 11), mod12(tonicPc + 2), mod12(tonicPc + 5)];
      chords[6].quality = 'dim';
      chords[6].harmonic = true;
    }
    return chords;
  }


    function romanOf(chord) {
    const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
    let r = romans[chord.degree];
    if (chord.quality === 'min' || chord.quality === 'dim') r = r.toLowerCase();
    if (chord.quality === 'dim') r += '°';
    if (chord.quality === 'aug') r += '+';
    return r;
  }


    function chordName(chord) {
    let suffix = '';
    if (chord.quality === 'min') suffix = 'm';
    else if (chord.quality === 'dim') suffix = '°';
    else if (chord.quality === 'aug') suffix = '+';
    const root = (chord.root !== undefined && chord.root !== null) ? chord.root : chord.notes[0];
    return nameFor(root) + suffix;
  }


    function generateProgression() {
    const chords = buildDiatonicChords(state.tonicPc, state.mode);
    const seq = TEMPLATES[state.progression][state.mode];
    const out = [];
    for (let i = 0; i < state.length; i++) {
      const chord = chords[seq[i % seq.length]];
      out.push({
        degree: chord.degree,
        root: chord.root,
        notes: chord.notes.slice(),
        quality: chord.quality,
        harmonic: chord.harmonic,
        order: i + 1
      });
    }
    state.progressionChords = out;
  }


    function detectPitch(buf, sampleRate) {
    const n = buf.length;
    let rms = 0;
    for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / n);
    if (rms < MIN_RMS) return null;

    const minTau = Math.max(2, Math.floor(sampleRate / 1400)); // ~1400 Hz
    const maxTau = Math.min(Math.floor(sampleRate / 55), n - 2); // ~55 Hz (Mi basse)

    // Fonction de différence cumulée normalisée (YIN).
    let running = 0;
    let tau = 1;
    let clarity = 1;
    const cmnd = new Float32Array(maxTau + 1);
    cmnd[0] = 1;

    for (tau = 1; tau <= maxTau; tau++) {
      let sum = 0;
      const limit = n - tau;
      for (let i = 0; i < limit; i++) {
        const d = buf[i] - buf[i + tau];
        sum += d * d;
      }
      running += sum;
      cmnd[tau] = running > 0 ? (sum * tau) / running : 1;
    }

    // Seuil absolu : première vallée sous 0.15, sinon minimum global.
    tau = minTau;
    while (tau <= maxTau && cmnd[tau] > 0.15) tau++;
    if (tau > maxTau) {
      let best = Infinity;
      let bestTau = -1;
      for (let t = minTau; t <= maxTau; t++) {
        if (cmnd[t] < best) { best = cmnd[t]; bestTau = t; }
      }
      if (best > 0.28) return null; // pas de hauteur claire (bruit / percussif)
      tau = bestTau;
      clarity = 1 - best;
    } else {
      clarity = 1 - cmnd[tau];
    }

    // Interpolation parabolique autour du minimum pour plus de précision.
    let preciseTau = tau;
    if (tau > minTau && tau < maxTau) {
      const x0 = cmnd[tau - 1], x1 = cmnd[tau], x2 = cmnd[tau + 1];
      const a = (x2 + x0 - 2 * x1) / 2;
      const b = (x2 - x0) / 2;
      if (a !== 0) preciseTau = tau - b / (2 * a);
    }
    const freq = sampleRate / preciseTau;
    if (!isFinite(freq) || freq < 55 || freq > 1400) return null;
    return { freq: freq, clarity: Math.max(0, Math.min(1, clarity)) };
  }


    function recognizeChord(pcSet) {
    let best = null;
    for (let root = 0; root < 12; root++) {
      for (let t = 0; t < CHORD_TEMPLATES.length; t++) {
        const tpl = CHORD_TEMPLATES[t];
        let hit = 0;
        for (let i = 0; i < tpl.iv.length; i++) {
          if (pcSet.has(mod12(root + tpl.iv[i]))) hit++;
        }
        if (hit < 3) continue;
        const extra = [];
        pcSet.forEach(function (pc) {
          let inChord = false;
          for (let i = 0; i < tpl.iv.length; i++) {
            if (mod12(root + tpl.iv[i]) === pc) { inChord = true; break; }
          }
          if (!inChord) extra.push(pc);
        });
        const score = hit * 3 - extra.length * 0.6 + (pcSet.has(root) ? 0.6 : 0);
        if (!best || score > best.score) best = { score: score, root: root, tpl: tpl };
      }
    }
    if (!best) return null;
    return {
      root: best.root,
      suffix: best.tpl.suffix,
      label: nameFor(best.root) + best.tpl.suffix,
      notes: best.tpl.iv.map(function (iv) { return mod12(best.root + iv); })
    };
  }


    function analyzeHistory() {
    const now = performance.now();
    state.history = state.history.filter(function (e) { return now - e.t < HISTORY_MS; });

    const stable = {};
    state.history.forEach(function (e) { stable[e.pc] = (stable[e.pc] || 0) + 1; });
    const pcs = Object.keys(stable).filter(function (pc) { return stable[pc] >= 2; }).map(Number);
    const historyChord = pcs.length >= 3 ? recognizeChord(new Set(pcs)) : null;

    // L'analyse spectrale (accords strummés) prend le pas sur l'historique
    // pendant une courte fenêtre, car elle voit les notes simultanées.
    if (state.spectralChord && now - state.spectralChordAt < 550) {
      state.detectedChord = state.spectralChord;
    } else {
      state.detectedChord = historyChord;
    }
  }


    function detectChordSpectrum(analyser, audioCtx) {
    const an = analyser || state.spectrumAnalyser;
    const ctx = audioCtx || state.audio;
    if (!an || !ctx || !an.getFloatFrequencyData) return null;
    if (!state.freqBuf || state.freqBuf.length !== an.frequencyBinCount) {
      state.freqBuf = new Float32Array(an.frequencyBinCount);
    }
    an.getFloatFrequencyData(state.freqBuf);
    const data = state.freqBuf;
    const binHz = ctx.sampleRate / an.fftSize;

    let peakDb = -Infinity;
    for (let i = 1; i < data.length; i++) if (data[i] > peakDb) peakDb = data[i];
    if (peakDb < -70) { state.spectralChord = null; return null; }
    const threshold = Math.max(-88, peakDb - 42);

    const candidates = [];
    for (let i = 2; i < data.length - 2; i++) {
      const v = data[i];
      if (v < threshold) continue;
      if (v >= data[i - 1] && v >= data[i + 1] && v > data[i - 2] && v > data[i + 2]) {
        const freq = i * binHz;
        if (freq < 55 || freq > 1600) continue;
        const midi = 69 + 12 * Math.log2(freq / 440);
        const nearest = Math.round(midi);
        if (Math.abs(midi - nearest) > 0.45) continue; // bruit / désaccordage
        candidates.push({ pc: mod12(nearest), freq: freq, amp: v });
      }
    }
    if (!candidates.length) { state.spectralChord = null; return null; }
    candidates.sort(function (a, b) { return b.amp - a.amp; });

    // Suppression des harmoniques (2e, 3e, 4e, 5e) d'une note déjà retenue.
    const chosen = [];
    for (let i = 0; i < candidates.length && chosen.length < 6; i++) {
      const c = candidates[i];
      let harmonic = false;
      for (let j = 0; j < chosen.length; j++) {
        const ratio = c.freq / chosen[j].freq;
        if ([2, 3, 4, 5].some(function (h) { return Math.abs(ratio - h) < 0.055; })
            && c.amp < chosen[j].amp - 3) { harmonic = true; break; }
      }
      if (!harmonic) chosen.push(c);
    }

    const set = new Set(chosen.map(function (c) { return c.pc; }));
    if (set.size < 3) { state.spectralChord = null; return null; }
    state.spectralChord = recognizeChord(set);
    state.spectralChordAt = performance.now();
    // Alimente aussi l'historique pour le mode monophonique (jeu de notes).
    chosen.forEach(function (c) { state.history.push({ pc: c.pc, t: performance.now() }); });
    if (state.history.length > 240) state.history.shift();
    return state.spectralChord;
  }


    function fretStrings() {
    return state.instrument === 'bass'
      ? [{ name: 'G', midi: 43 }, { name: 'D', midi: 38 }, { name: 'A', midi: 33 }, { name: 'E', midi: 28 }]
      : [{ name: 'e', midi: 64 }, { name: 'B', midi: 59 }, { name: 'G', midi: 55 },
         { name: 'D', midi: 50 }, { name: 'A', midi: 45 }, { name: 'E', midi: 40 }];
  }


    function adviceFor(pc) {
    const scale = buildScale(state.tonicPc, state.mode);
    const first = state.progressionChords[0];
    const chord = state.detectedChord || (first ? { notes: first.notes, label: chordName(first) } : null);
    const leading = mod12(state.tonicPc + 11);
    if (pc === state.tonicPc) {
      return { level: 'good', icon: '⭐', title: 'TONIQUE — le meilleur choix',
        text: 'C\'est la note d\'arrivée : elle sonne toujours juste. Idéale pour commencer et pour finir.' };
    }
    if (chord && chord.notes.indexOf(pc) !== -1) {
      return { level: 'good', icon: '✅', title: 'NOTE DE L\'ACCORD',
        text: 'Elle fait partie de « ' + chord.label + ' » : elle sonne stable avec ce qui se joue.' };
    }
    if (pc === leading) {
      return { level: 'good', icon: '🎯', title: 'NOTE SENSIBLE (7e)',
        text: 'Elle attire l\'oreille vers la tonique. Parfaite juste avant de revenir à la tonique.' };
    }
    if (scale.indexOf(pc) !== -1) {
      return { level: 'mid', icon: '✔️', title: 'NOTE DE LA GAMME',
        text: 'Diatonique : elle sonne bien dans la tonalité, mais elle n\'est pas dans l\'accord du moment.' };
    }
    return { level: 'bad', icon: '⚠️', title: 'NOTE DE PASSAGE',
      text: 'Hors gamme : à utiliser seulement pour relier deux notes, jamais comme note d\'arrivée.' };
  }


    function nearestGoodFret(stringIndex, fret, strings) {
    const first = state.progressionChords[0];
    const chordNotes = state.detectedChord ? state.detectedChord.notes
                     : (first ? first.notes : [state.tonicPc]);
    const leading = mod12(state.tonicPc + 11);
    let best = null;
    for (let f = 0; f <= 12; f++) {
      const pc = mod12(strings[stringIndex].midi + f);
      let rank;
      if (pc === state.tonicPc) rank = 0;              // tonique : meilleure
      else if (chordNotes.indexOf(pc) !== -1) rank = 1; // note de l'accord
      else if (pc === leading) rank = 2;                // note sensible
      else continue;
      const score = rank * 10 + Math.abs(f - fret);
      if (!best || score < best.score) best = { fret: f, pc: pc, score: score };
    }
    return best;
  }


    function findVoicing(notes, variant) {
    if (!notes || !notes.length) return null;
    const pcs = notes.map(mod12);
    const open = OPEN_MIDI[state.instrument];
    const starts = state.instrument === 'bass' ? [0] : [1, 2, 0];
    const rootShapes = [];
    const otherShapes = [];
    for (let base = 0; base <= 9; base++) {
      for (let i = 0; i < starts.length; i++) {
        const start = starts[i];
        if (start + 4 > open.length) continue;
        const frets = [];
        let ok = true;
        for (let s = start; s < start + 4; s++) {
          let found = -1;
          for (let f = base; f <= base + 3; f++) {
            if (pcs.indexOf(mod12(open[s] + f)) !== -1) { found = f; break; }
          }
          if (found < 0) { ok = false; break; }
          frets.push(found);
        }
        if (ok) {
          const all = new Array(open.length);
          all.fill('x');
          frets.forEach(function (f, k) { all[start + k] = f; });
          const shape = { frets: all, base: base };
          // On classe les prises : celles dont la basse est la racine d'abord.
          if (mod12(open[start] + frets[0]) === pcs[0]) rootShapes.push(shape);
          else otherShapes.push(shape);
        }
      }
    }
    const pool = rootShapes.concat(otherShapes);
    return pool.length ? pool[(variant || 0) % pool.length] : null;
  }


    function findNotePosition(pc) {
    const open = OPEN_MIDI[state.instrument];
    let best = null;
    for (let s = 0; s < open.length; s++) {
      for (let f = 0; f <= 12; f++) {
        if (mod12(open[s] + f) === pc) {
          if (!best || f < best.fret || (f === best.fret && s < best.string)) {
            best = { string: s, fret: f };
          }
          break;
        }
      }
    }
    return best;
  }


    function findTwoStringShape(notes, instrument, variant) {
    if (!notes || notes.length < 2) return null;
    const open = OPEN_MIDI[instrument || state.instrument];
    const pcs = notes.map(mod12);
    const root = pcs[0];
    const fifth = pcs.length >= 3 ? pcs[2] : pcs[pcs.length - 1];

    function search(wantedA, wantedB) {
      const found = [];
      for (let s = 0; s < open.length - 1; s++) {
        for (let f1 = 0; f1 <= 12; f1++) {
          if (wantedA.indexOf(mod12(open[s] + f1)) === -1) continue;
          for (let f2 = 0; f2 <= 12; f2++) {
            if (wantedB.indexOf(mod12(open[s + 1] + f2)) === -1) continue;
            if (mod12(open[s] + f1) === mod12(open[s + 1] + f2)) continue;
            if (Math.abs(f1 - f2) > 2) continue;
            // Position la plus basse d'abord, puis écart le plus petit.
            found.push({ strings: [s, s + 1], frets: [f1, f2],
                         score: Math.max(f1, f2) * 10 + Math.abs(f1 - f2) });
          }
        }
      }
      found.sort(function (a, b) { return a.score - b.score; });
      return found;
    }
    const pool = search([root], [fifth]);
    const all = pool.length ? pool : search(pcs, pcs);
    if (!all.length) return null;
    const chosen = all[(variant || 0) % all.length];
    return { strings: chosen.strings, frets: chosen.frets };
  }


    function chordDisplayName(c) {
    return c.label || chordName(c);
  }


    function noteFretOnString(pc, s) {
    const open = OPEN_MIDI[state.instrument];
    if (!open || s < 0 || s >= open.length) return null;
    for (let f = 0; f <= 12; f++) if (mod12(open[s] + f) === pc) return f;
    return null;
  }


    function generateRiff(trigger) {
    const mood = MOODS[state.mood] || MOODS.groove;
    const v = state.riffVariation;
    const count = STRING_NAMES[state.instrument].length;
    const grid = [];
    for (let s = 0; s < count; s++) grid.push(new Array(16).fill(null));
    function place(step, s, f) {
      if (s >= 0 && s < count && step >= 0 && step < 16 && typeof f === 'number') grid[s][step] = f;
    }

    if (trigger && trigger.chord) {
      const voicing = findVoicing(trigger.chord.notes, v);
      if (voicing) {
        const active = [];
        voicing.frets.forEach(function (f, i) { if (f !== 'x' && f !== undefined) active.push(i); });
        mood.steps.forEach(function (step, k) {
          if (mood.style === 'power') {
            const two = findTwoStringShape(trigger.chord.notes, state.instrument, v);
            if (two) {
              const octave = (k + v) % 4 >= 2 ? 12 : 0;
              place(step, two.strings[0], two.frets[0] + octave);
              place(step, two.strings[1], two.frets[1] + octave);
            } else if (active.length) {
              const s = active[(k + v) % active.length];
              place(step, s, voicing.frets[s]);
            }
          } else if (active.length) {
            const s = active[(k + v) % active.length];
            place(step, s, voicing.frets[s]);
          }
        });
      }
      state.riffSource = chordDisplayName(trigger.chord);
    } else {
      const pc = (trigger && trigger.pc !== null && trigger.pc !== undefined) ? trigger.pc : state.tonicPc;
      const pos = findNotePosition(pc);
      if (mood.style === 'power') {
        const two = findTwoStringShape([pc, mod12(pc + 3), mod12(pc + 7)], state.instrument, v);
        if (two) {
          mood.steps.forEach(function (step, k) {
            const octave = (k + v) % 4 >= 2 ? 12 : 0;
            place(step, two.strings[0], two.frets[0] + octave);
            place(step, two.strings[1], two.frets[1] + octave);
          });
        } else if (pos) {
          mood.steps.forEach(function (step) { place(step, pos.string, pos.fret); });
        }
      } else if (mood.style === 'offbeat') {
        mood.steps.forEach(function (step, k) {
          if (!pos) return;
          const s = (pos.string + v + (k % 2)) % count;
          const f = noteFretOnString(pc, s);
          if (f !== null) place(step, s, f + (k % 3 === 0 ? 12 : 0));
        });
      } else {
        mood.steps.forEach(function (step, k) {
          if (!pos) return;
          const s = (pos.string + v) % count;
          const f = noteFretOnString(pc, s);
          if (f !== null) place(step, s, f + ((k + v) % 4 >= 2 ? 12 : 0));
        });
      }
      state.riffSource = sharpName(pc);
    }
    state.riffPattern = grid;
  }


    function canonicalTonicName() {
    const raw = String(state.tonicTyped || '').toLowerCase();
    if (raw.indexOf('b') !== -1) return FLAT[state.tonicPc].replace('♭', 'b');
    if (raw.indexOf('#') !== -1) return SHARP[state.tonicPc].replace('♯', '#');
    return state.mode === 'minor' ? FLAT[state.tonicPc].replace('♭', 'b') : SHARP[state.tonicPc].replace('♯', '#');
  }


  M.Model = {
    state: state, SHARP: SHARP, FLAT: FLAT, LETTER_PC: LETTER_PC,
    SCALES: SCALES, TEMPLATES: TEMPLATES, CHORD_TEMPLATES: CHORD_TEMPLATES,
    MOODS: MOODS, STRING_NAMES: STRING_NAMES, OPEN_MIDI: OPEN_MIDI,
    HISTORY_MS: HISTORY_MS, MIN_RMS: MIN_RMS,
    mod12,
    parseNoteName,
    nameFor,
    sharpName,
    noteLabel,
    buildScale,
    buildDiatonicChords,
    romanOf,
    chordName,
    generateProgression,
    detectPitch,
    recognizeChord,
    analyzeHistory,
    detectChordSpectrum,
    fretStrings,
    adviceFor,
    nearestGoodFret,
    findVoicing,
    findNotePosition,
    findTwoStringShape,
    chordDisplayName,
    noteFretOnString,
    generateRiff,
    canonicalTonicName
  };
})();
