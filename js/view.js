/* VUE - FretScaleWeb : rendu DOM uniquement (lit le Modèle) */
(function () {
  'use strict';
  const NS = (window.FretScale = window.FretScale || {});
  const M = NS.Model;
  const $ = function (id) { return document.getElementById(id); };
  const {
    state, SHARP, FLAT, STRING_NAMES, OPEN_MIDI, MOODS,
    mod12, nameFor, sharpName, noteLabel, buildScale, romanOf, chordName, fretStrings,
    chordDisplayName, findVoicing, findNotePosition, findTwoStringShape,
    adviceFor, nearestGoodFret
  } = M;

    function highlightClasses(pc) {
    const classes = [];
    const scale = buildScale(state.tonicPc, state.mode);
    const leading = mod12(state.tonicPc + 11);
    const chordNotes = state.detectedChord ? state.detectedChord.notes : null;

    if (state.detectedPc === pc) classes.push('playing');
    if (chordNotes && chordNotes.indexOf(pc) !== -1) classes.push('chord');
    if (pc === mod12(state.tonicPc)) classes.push('tonic');
    else if (pc === leading) classes.push('leading');
    else if (scale.indexOf(pc) !== -1) classes.push('scale');
    else classes.push('pass');
    return classes;
  }


    function renderFretAdvice(strings, pc, fret, stringIndex) {
    const a = adviceFor(pc);
    const midi = strings[stringIndex].midi + fret;
    const note = nameFor(pc) + (Math.floor(midi / 12) - 1);
    let html = '<span class="advice-icon">' + a.icon + '</span><div><b>' + a.title + ' · ' + note + '</b><br>' + a.text;
    if (pc !== state.tonicPc) {
      const best = nearestGoodFret(stringIndex, fret, strings);
      if (best) {
        let reason = best.pc === state.tonicPc ? 'tonique'
                   : best.pc === mod12(state.tonicPc + 11) ? 'note sensible' : 'note de l\'accord';
        html += '<span class="advice-best">👉 Meilleure note conseillée ici : ' + nameFor(best.pc) +
                ' — case ' + best.fret + ' de la corde ' + strings[stringIndex].name + ' (' + reason + ').</span>';
      }
    } else {
      html += '<span class="advice-best">👍 C\'est déjà la meilleure note à cet endroit.</span>';
    }
    html += '</div>';
    const box = $('fretAdvice');
    box.className = 'fret-advice ' + a.level;
    box.innerHTML = html;
  }


    function renderFretboard() {
    const strings = fretStrings();
    let html = '';
    strings.forEach(function (s, si) {
      html += '<div class="str-label">' + s.name + '</div>';
      for (let fret = 0; fret <= 12; fret++) {
        const pc = mod12(s.midi + fret);
        let cls = ['fret', fret === 0 ? 'fret-0' : ''].concat(highlightClasses(pc));
        const sel = state.selectedFret;
        if (sel && sel.instrument === state.instrument && sel.string === si && sel.fret === fret) cls.push('selected');
        html += '<div class="' + cls.join(' ') + '" data-string="' + si + '" data-fret="' + fret +
                '" data-midi="' + (s.midi + fret) + '" title="' + sharpName(pc) + ' · case ' + fret + '">' +
                sharpName(pc) + '</div>';
      }
    });
    $('fretboard').innerHTML = html;
    $('fretSubtitle').textContent = '(' + (state.instrument === 'bass' ? 'basse · 4 cordes' : 'guitare · 6 cordes') + ' · 12 frettes)';
    const sel = state.selectedFret;
    if (sel && sel.instrument === state.instrument && sel.string < strings.length) {
      renderFretAdvice(strings, mod12(strings[sel.string].midi + sel.fret), sel.fret, sel.string);
    }
  }


    function renderGrid() {
    // La cellule 20 (5e de la 3e ligne) est toujours la tonique.
    const centerMidi = (state.instrument === 'bass' ? 48 : 60) + state.tonicPc;
    let html = '';
    for (let i = 0; i < 40; i++) {
      const midi = centerMidi + (i - 20);
      const pc = mod12(midi);
      const octave = Math.floor(midi / 12) - 1;
      const cls = ['gcell'].concat(highlightClasses(pc)).join(' ');
      const mark = i === 20 ? '<span class="dot">★ TONIQUE</span>' : '';
      const title = (i === 20 ? 'TONIQUE · ' : '') + sharpName(pc) + octave;
      html += '<div class="' + cls + '" data-midi="' + midi + '" title="' + title + '">' +
              sharpName(pc) + '<span class="g-oct">' + octave + '</span>' + mark + '</div>';
    }
    $('noteGrid').innerHTML = html;
  }


    function renderPiano() {
    const startMidi = state.instrument === 'bass' ? 36 : 60; // C2 ou C4
    const whites = [0, 2, 4, 5, 7, 9, 11];
    const blackAfter = { 0: 1, 1: 3, 3: 6, 4: 8, 5: 10 };
    const whiteCount = 14;
    const blackWidth = (100 / whiteCount) * 0.62;

    let html = '';
    for (let oct = 0; oct < 2; oct++) {
      whites.forEach(function (off) {
        const midi = startMidi + oct * 12 + off;
        const pc = mod12(midi);
        const cls = ['wkey'].concat(highlightClasses(pc).map(function (c) {
          return c === 'scale' ? 'hl-scale' : c === 'chord' ? 'hl-chord' : c === 'tonic' ? 'hl-tonic'
               : c === 'leading' ? 'hl-leading' : c === 'playing' ? 'hl-play' : '';
        }).filter(Boolean)).join(' ');
        html += '<div class="' + cls + '" data-midi="' + midi + '">' + noteLabel(midi) + '</div>';
      });
    }
    for (let oct = 0; oct < 2; oct++) {
      Object.keys(blackAfter).forEach(function (key) {
        const wi = Number(key);
        const midi = startMidi + oct * 12 + blackAfter[key];
        const pc = mod12(midi);
        const left = ((oct * 7 + wi + 1) / whiteCount) * 100 - blackWidth / 2;
        const cls = ['bkey'].concat(highlightClasses(pc).map(function (c) {
          return c === 'scale' ? 'hl-scale' : c === 'chord' ? 'hl-chord' : c === 'tonic' ? 'hl-tonic'
               : c === 'leading' ? 'hl-leading' : c === 'playing' ? 'hl-play' : '';
        }).filter(Boolean)).join(' ');
        html += '<div class="' + cls + '" data-midi="' + midi + '" style="left:' + left.toFixed(2) + '%;width:' + blackWidth.toFixed(2) + '%">' + sharpName(pc) + '</div>';
      });
    }
    $('piano').innerHTML = html;
  }


    function renderChords() {
    const out = state.progressionChords;
    if (!out.length) { $('chords').innerHTML = '<p class="hint">Aucune progression.</p>'; return; }
    let html = '';
    out.forEach(function (c, i) {
      const next = out[i + 1];
      const isDom = c.degree === 4;
      const isRes = c.degree === 0 && i > 0 && out[i - 1].degree === 4;
      const cls = 'chord-row' + (isDom ? ' dominant' : isRes ? ' resolution' : '');
      const tag = isDom ? '<span class="tag dom">DOMINANTE V → tension</span>'
                : isRes ? '<span class="tag res">RÉSOLUTION → tonique</span>' : '';
      const notes = c.notes.map(function (p) { return nameFor(p); }).join(' · ');
      html += '<div class="' + cls + '" data-index="' + i + '" title="Cliquer pour charger cette tab/riff">' +
                '<div class="deg">' + romanOf(c) + '</div>' +
                '<div><div class="chord-name">' + chordName(c) + tag + '</div>' +
                '<div class="chord-notes">' + notes + (next && isDom ? ' &nbsp;→&nbsp; ' + romanOf(next) : '') + '</div></div>' +
              '</div>';
    });
    $('chords').innerHTML = html;
  }


    function renderTabCard(title, subtitle, voicing, notePos) {
    const names = STRING_NAMES[state.instrument];
    let html = '<div class="tab-card"><div class="tab-head"><b>' + title + '</b>';
    if (subtitle) html += '<span>' + subtitle + '</span>';
    html += '</div><div class="tab">';
    for (let disp = 0; disp < names.length; disp++) {
      const s = names.length - 1 - disp; // index dans OPEN_MIDI (grave -> aigu)
      html += '<div class="tab-row"><span class="tab-string">' + names[disp] + '</span>';
      for (let f = 0; f <= 12; f++) {
        let val = '─', cls = 'tab-cell';
        if (voicing) {
          const vf = voicing.frets[s];
          if (vf === 'x' || vf === undefined) { val = 'x'; cls += ' mute'; }
          else if (vf === f) { val = String(f); cls += ' num'; }
        } else if (notePos && notePos.string === s) {
          if (notePos.fret === f) { val = String(f); cls += ' num'; }
        }
        html += '<span class="' + cls + '">' + val + '</span>';
      }
      html += '</div>';
    }
    return html + '</div></div>';
  }


    function renderNoob() {
    const panel = $('noobPanel');
    if (!state.noobMode) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');

    const detailsOpen = window.innerWidth >= 1200 ? '' : ' open';
    let html = '<details class="tab-intro"' + detailsOpen + '><summary>📖 Comment lire une tablature</summary>' +
      'Lis de gauche à droite. Le <b>chiffre</b> = la case à presser sur cette corde. ' +
      '<b>x</b> = ne joue pas cette corde. ' +
      'Joue uniquement les cordes marquées d\'un chiffre. ' +
      'Si deux chiffres sont sur la même case, pose un doigt dessus (barre).</details>';

    // Astuce spéciale basse : jouer deux cordes en même temps.
    if (state.instrument === 'bass') {
      const source = state.detectedChord ? state.detectedChord.notes
                   : (state.progressionChords[0] ? state.progressionChords[0].notes : null);
      const two = findTwoStringShape(source);
      if (two) {
        const shape = { frets: new Array(OPEN_MIDI.bass.length) };
        shape.frets.fill('x');
        shape.frets[two.strings[0]] = two.frets[0];
        shape.frets[two.strings[1]] = two.frets[1];
        html += '<details class="tab-intro bass-tip"' + detailsOpen + '><summary>🎸 Basse · jouer 2 cordes ensemble</summary>' +
          'Pose <b>un seul doigt en travers</b> sur les deux cordes aux cases indiquées ' +
          '(une « barre »), puis gratte les <b>deux cordes marquées</b> en même temps ' +
          'avec le pouce ou l\'index. Tu obtiens une basse « puissance » (racine + quinte).</details>';
        html += renderTabCard('2 cordes à gratter ensemble', 'barre d\'un doigt', shape, null);
      }
    }

    if (state.detectedChord) {
      html += renderTabCard('Tu joues : ' + state.detectedChord.label, 'accord détecté',
                            findVoicing(state.detectedChord.notes), null);
    } else if (state.detectedPc !== null) {
      html += renderTabCard('Tu joues : ' + nameFor(state.detectedPc), 'note détectée',
                            null, findNotePosition(state.detectedPc));
    } else {
      html += '<p class="hint">Active le micro et joue, ou tape une touche du piano pour voir sa tablature.</p>';
    }

    state.progressionChords.forEach(function (c, i) {
      html += renderTabCard(romanOf(c) + ' · ' + chordName(c), 'accord ' + (i + 1),
                            findVoicing(c.notes), null);
    });
    $('noobContent').innerHTML = html;
  }


    function renderRiff() {
    const el = $('riffTab');
    if (!el) return;
    const names = STRING_NAMES[state.instrument];
    let out = '    ' + Array.from({ length: 16 }, function (_, i) { return String(i + 1).padStart(3, ' '); }).join('') + '\n';
    for (let disp = 0; disp < names.length; disp++) {
      const s = names.length - 1 - disp;
      let line = names[disp].padStart(2, ' ') + ' |';
      for (let step = 0; step < 16; step++) {
        const f = state.riffPattern && state.riffPattern[s] ? state.riffPattern[s][step] : null;
        line += (f === null || f === undefined) ? '---' : String(f).padStart(3, '-');
      }
      out += line + '|\n';
    }
    el.textContent = out;
    const mood = MOODS[state.mood] || MOODS.groove;
    $('riffCaption').innerHTML = 'Source : <b>' + (state.riffSource || '—') + '</b> · Ambiance : <b>' +
      mood.label + '</b> · Variation n°' + (state.riffVariation + 1) + ' — ' + mood.note +
      '. Chiffre = case à presser, <code>---</code> = silence.';
  }


    function renderLive() {
    $('liveNote').textContent = state.detectedPc !== null && state.detectedMidi !== null
      ? noteLabel(state.detectedMidi) : (state.detectedPc !== null ? sharpName(state.detectedPc) : '—');
    $('liveChord').textContent = state.detectedChord ? state.detectedChord.label : '—';
  }


    function renderAll() {
    renderFretboard();
    renderGrid();
    renderPiano();
    renderLive();
    renderNoob();
    renderNoteChips();
    renderRiff();
  }


    function renderNoteChips() {
    const box = $('noteChips');
    if (!box.children.length) {
      let html = '';
      for (let pc = 0; pc < 12; pc++) {
        html += '<button type="button" data-pc="' + pc + '">' + SHARP[pc].replace('♯', '#') + '</button>';
      }
      box.innerHTML = html;
    }
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (btn) {
      btn.classList.toggle('active', Number(btn.getAttribute('data-pc')) === state.tonicPc);
    });
  }


    function showBanner(msg, isError) {
    const b = $('banner');
    b.textContent = msg;
    b.classList.remove('hidden');
    b.classList.toggle('error', !!isError);
  }


    function hideBanner() { $('banner').classList.add('hidden'); }


  NS.View = {
    highlightClasses,
    renderFretAdvice,
    renderFretboard,
    renderGrid,
    renderPiano,
    renderChords,
    renderTabCard,
    renderNoob,
    renderRiff,
    renderLive,
    renderAll,
    renderNoteChips,
    showBanner,
    hideBanner
  };
})();
