/**
 * Tony's Jumping Game — Retro Arcade High-Score Cabinet, Full Player Name Entry & Live HUD
 * Exposes window.TonyArcadeUI
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'tonys_jumping_game_highscores_v3';
  const LEGACY_STORAGE_KEYS = [
    'tonys_jumping_game_highscores_v1',
    'tonys_jumping_game_highscores_v2'
  ];
  const LEGACY_SEED_SIGNATURES = new Set([
    'TNY:14850',
    'SHP:11400',
    'JUP:9250',
    'SAT:7600',
    'MAR:6150',
    'MARS:6150',
    'BAH:4900',
    'BAHH:4900',
    'WOL:3450',
    'WOOL:3450',
    'SOL:2100'
  ]);
  const MAX_LEADERBOARD_ROWS = 10;
  const MAX_NAME_LENGTH = 24;

  const RANK_LABELS = [
    '1ST', '2ND', '3RD', '4TH', '5TH',
    '6TH', '7TH', '8TH', '9TH', '10TH'
  ];

  const TIER_META = {
    MINI:     { label: 'MINI',     points: 100,  mult: '1.0x', radiusRange: '18–24px', previewPx: 14 },
    SMALL:    { label: 'SMALL',    points: 200,  mult: '2.0x', radiusRange: '26–33px', previewPx: 20 },
    MEDIUM:   { label: 'MEDIUM',   points: 350,  mult: '3.5x', radiusRange: '35–44px', previewPx: 27 },
    LARGE:    { label: 'LARGE',    points: 600,  mult: '6.0x', radiusRange: '46–56px', previewPx: 35 },
    COLOSSAL: { label: 'COLOSSAL', points: 1000, mult: '10x',  radiusRange: '58–70px', previewPx: 44 }
  };

  const DEFAULT_PLANET_FALLBACK = [
    { id: 'mercury', name: 'Mercury', tier: 'MINI',     radius: 21, points: 100,  baseColor: '#9e9e9e', accentColor: '#cfd8dc', hasRings: false },
    { id: 'venus',   name: 'Venus',   tier: 'SMALL',    radius: 30, points: 200,  baseColor: '#e6b85c', accentColor: '#fff3cd', hasRings: false },
    { id: 'earth',   name: 'Earth',   tier: 'MEDIUM',   radius: 39, points: 350,  baseColor: '#2b82d9', accentColor: '#5cd68d', hasRings: false },
    { id: 'mars',    name: 'Mars',    tier: 'SMALL',    radius: 28, points: 200,  baseColor: '#d95338', accentColor: '#ff9e80', hasRings: false },
    { id: 'jupiter', name: 'Jupiter', tier: 'COLOSSAL', radius: 66, points: 1000, baseColor: '#d99b66', accentColor: '#e65c40', hasRings: false },
    { id: 'saturn',  name: 'Saturn',  tier: 'LARGE',    radius: 52, points: 600,  baseColor: '#e6c875', accentColor: '#f5e1a4', hasRings: true  },
    { id: 'uranus',  name: 'Uranus',  tier: 'MEDIUM',   radius: 41, points: 350,  baseColor: '#66d9e8', accentColor: '#b2f2ff', hasRings: true  },
    { id: 'neptune', name: 'Neptune', tier: 'LARGE',    radius: 49, points: 600,  baseColor: '#3b5bdb', accentColor: '#748ffc', hasRings: false }
  ];

  /**
   * Starts with NO pre-seeded scores so the leaderboard begins completely clean (0 entries).
   */
  const DEFAULT_SEED_SCORES = [];

  // Internal state
  const state = {
    scores: [],
    bestSessionScore: 0,
    lastSubmittedId: null,
    isTypingInitials: false,
    playerName: '',
    pendingRunStats: null,
    onInitialsSaved: null,
    recentClears: [],
    lastManifestSignature: '',
    resetToastTimer: null
  };

  function padScore(val, digits = 6) {
    const num = Math.max(0, Math.floor(Number(val) || 0));
    return String(num).padStart(digits, '0');
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Normalizes a full player name (up to 24 characters, preserving spaces and case).
   */
  function normalizePlayerName(raw) {
    const cleaned = String(raw ?? '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_NAME_LENGTH);
    return cleaned || 'Anonymous Sheep';
  }

  function formatBiggestPlanet(bp, fallbackObj) {
    const src = (fallbackObj && typeof fallbackObj === 'object') ? fallbackObj : bp;
    if (!src || src === 'None') {
      return { name: 'None', diameter: 0, radius: 0, tier: 'MINI', label: '—' };
    }
    if (typeof src === 'string') {
      const match = src.match(/^([^(]+)\((MINI|SMALL|MEDIUM|LARGE|COLOSSAL)?[^0-9]*(\d+)?/i);
      if (match) {
        const name = match[1].trim() || src;
        const tier = (match[2] || 'MEDIUM').toUpperCase();
        const diameter = Number(match[3]) || 0;
        const radius = diameter ? Math.round(diameter / 2) : 0;
        return { name, diameter, radius, tier, label: src };
      }
      return { name: src, diameter: 0, radius: 0, tier: 'MEDIUM', label: src };
    }
    const name = src.name || src.planetName || 'Planet';
    const radius = Number(src.radius) || (src.diameter ? Math.round(src.diameter / 2) : 0);
    const diameter = Number(src.diameter) || (radius ? radius * 2 : 0);
    const tier = String(src.tier || src.sizeTier || 'MEDIUM').toUpperCase();
    const label = diameter > 0 ? `${name} (${diameter}px)` : `${name} (${tier})`;
    return { name, diameter, radius, tier, label };
  }

  function isLegacySeedEntry(entry) {
    if (!entry || typeof entry !== 'object') return true;
    if (entry.isSeed === true || entry.seeded === true) return true;
    if (typeof entry.id === 'string' && entry.id.startsWith('seed-')) return true;
    const rawCallsign = String(entry.name || entry.playerName || entry.initials || '').trim().toUpperCase();
    const rawScore = Math.floor(Number(entry.score) || 0);
    if (LEGACY_SEED_SIGNATURES.has(`${rawCallsign}:${rawScore}`)) return true;
    return false;
  }

  function normalizeScoreEntry(entry, idx = 0) {
    const bp = formatBiggestPlanet(entry.biggestPlanet, entry.biggestPlanetObj);
    const fullName = normalizePlayerName(entry.name || entry.playerName || entry.initials || 'Anonymous Sheep');
    return {
      id: entry.id || `run-${Date.now()}-${idx}`,
      rank: idx + 1,
      name: fullName,
      playerName: fullName,
      initials: fullName, // Alias kept for compatibility with any caller reading .initials
      score: Math.max(0, Math.floor(Number(entry.score) || 0)),
      planetsCleared: Math.max(0, Math.floor(Number(entry.planetsCleared) || 0)),
      biggestPlanet: {
        name: bp.name,
        diameter: bp.diameter,
        radius: bp.radius,
        tier: bp.tier
      },
      date: entry.date || new Date().toISOString().slice(0, 10),
      isSession: Boolean(entry.isSession),
      isSeed: false
    };
  }

  function sortAndRankScores(list) {
    return (Array.isArray(list) ? list : [])
      .filter((item) => !isLegacySeedEntry(item))
      .slice()
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.planetsCleared || 0) - (a.planetsCleared || 0);
      })
      .slice(0, MAX_LEADERBOARD_ROWS)
      .map((item, idx) => Object.assign({}, item, { rank: idx + 1 }));
  }

  function purgeLegacyStorageKeys() {
    try {
      if (typeof localStorage !== 'undefined') {
        for (const k of LEGACY_STORAGE_KEYS) {
          localStorage.removeItem(k);
        }
      }
    } catch (_err) {}
  }

  function loadHighScores() {
    try {
      if (typeof localStorage !== 'undefined') {
        purgeLegacyStorageKeys();
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((item) => !isLegacySeedEntry(item));
            state.scores = sortAndRankScores(filtered.map(normalizeScoreEntry));
            if (filtered.length !== parsed.length) {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(state.scores));
            }
            return state.scores;
          }
        }
        state.scores = [];
        localStorage.setItem(STORAGE_KEY, '[]');
        return state.scores;
      }
    } catch (_err) {
      // Ignore storage access errors in restricted contexts
    }
    if (!Array.isArray(state.scores)) {
      state.scores = [];
    }
    return state.scores;
  }

  function getHighScores() {
    if (typeof localStorage !== 'undefined') {
      return loadHighScores();
    }
    return Array.isArray(state.scores) ? state.scores.slice() : [];
  }

  function saveHighScores(scoresList) {
    state.scores = sortAndRankScores(scoresList);
    try {
      if (typeof localStorage !== 'undefined') {
        purgeLegacyStorageKeys();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.scores));
      }
    } catch (_err) {
      // Ignore quota/storage errors in restricted contexts
    }
    return state.scores;
  }

  function syncEngineHighScore(newHigh) {
    const val = Math.max(0, Math.floor(Number(newHigh) || 0));
    if (global.gameEngine && typeof global.gameEngine === 'object') {
      global.gameEngine.highScore = val;
    }
    if (global.tonyEngine && typeof global.tonyEngine === 'object') {
      global.tonyEngine.highScore = val;
    }
    if (global.TonyGameEngine && global.TonyGameEngine.instance) {
      global.TonyGameEngine.instance.highScore = val;
    }
  }

  /**
   * Immediately clears all high scores to empty ([]) without window.confirm blocking,
   * resets HI 000000 to 000000, re-renders the empty 10-slot table, and shows visual feedback.
   */
  function resetHighScores() {
    state.lastSubmittedId = null;
    state.bestSessionScore = 0;
    state.scores = [];
    saveHighScores([]);
    syncEngineHighScore(0);

    renderHighScoreTable([]);
    updateHighScoreDisplay(0, true);

    if (typeof document !== 'undefined') {
      const resetBtn = byId('btn-reset-scores', 'reset-high-scores-btn');
      if (resetBtn) {
        if (state.resetToastTimer) {
          clearTimeout(state.resetToastTimer);
        }
        resetBtn.classList.add('is-cleared-toast');
        resetBtn.innerHTML = '<span class="material-symbols-outlined">✓</span><span>Board Cleared</span>';
        state.resetToastTimer = setTimeout(() => {
          resetBtn.classList.remove('is-cleared-toast');
          resetBtn.innerHTML = '<span class="material-symbols-outlined">↺</span><span>Clear Board</span>';
          state.resetToastTimer = null;
        }, 1500);
      }
    }

    if (global.TONY_ASSETS && global.TONY_ASSETS.TONY_AUDIO && typeof global.TONY_ASSETS.TONY_AUDIO.playButton === 'function') {
      global.TONY_ASSETS.TONY_AUDIO.playButton();
    }
    return state.scores;
  }

  function getTopScore() {
    if (!Array.isArray(state.scores)) {
      loadHighScores();
    }
    const boardTop = state.scores.length > 0 ? state.scores[0].score : 0;
    return Math.max(boardTop, state.bestSessionScore || 0);
  }

  function qualifiesForHighScore(score) {
    const numericScore = Math.floor(Number(score) || 0);
    if (numericScore <= 0) return false;
    if (!Array.isArray(state.scores)) loadHighScores();
    if (state.scores.length < MAX_LEADERBOARD_ROWS) return true;
    const lowestScore = state.scores[state.scores.length - 1].score;
    return numericScore >= lowestScore;
  }

  function getProjectedRank(score) {
    const numericScore = Math.floor(Number(score) || 0);
    if (!Array.isArray(state.scores)) loadHighScores();
    for (let i = 0; i < state.scores.length; i++) {
      if (numericScore >= state.scores[i].score) {
        return i + 1;
      }
    }
    return state.scores.length < MAX_LEADERBOARD_ROWS ? state.scores.length + 1 : MAX_LEADERBOARD_ROWS + 1;
  }

  function getModalPlayerNameInput() {
    if (typeof document === 'undefined') return null;
    return byId('arcade-player-name-input', 'arcade-initials-input', 'initials-hidden-input');
  }

  function submitScore(entry = {}) {
    if (!Array.isArray(state.scores)) {
      loadHighScores();
    }
    const inputEl = getModalPlayerNameInput();
    const rawName =
      entry.name ??
      entry.playerName ??
      entry.initials ??
      (inputEl && inputEl.value ? inputEl.value : state.playerName) ??
      'Anonymous Sheep';

    const newEntry = normalizeScoreEntry({
      id: `player-${Date.now()}`,
      name: rawName,
      score: entry.score,
      planetsCleared: entry.planetsCleared,
      biggestPlanet: entry.biggestPlanet,
      biggestPlanetObj: entry.biggestPlanetObj,
      date: entry.date || new Date().toISOString().slice(0, 10),
      isSession: true,
      isSeed: false
    });

    state.playerName = newEntry.name;

    if (newEntry.score > state.bestSessionScore) {
      state.bestSessionScore = newEntry.score;
    }
    state.lastSubmittedId = newEntry.id;

    const combined = state.scores.concat([newEntry]);
    const updated = saveHighScores(combined);
    const savedRecord = updated.find((item) => item.id === newEntry.id) || null;

    syncEngineHighScore(getTopScore());
    renderHighScoreTable();
    updateHighScoreDisplay(newEntry.score);

    return {
      madeTop10: Boolean(savedRecord),
      rank: savedRecord ? savedRecord.rank : null,
      entry: savedRecord || newEntry,
      scores: updated
    };
  }

  function byId(...ids) {
    if (typeof document === 'undefined') return null;
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) return el;
    }
    return null;
  }

  function updateHighScoreDisplay(currentScore = 0, forceZero = false) {
    const hiEl = byId('hud-high-score', 'high-score-value', 'hi-score-display');
    const best = forceZero ? 0 : Math.max(getTopScore(), Math.floor(Number(currentScore) || 0));
    if (hiEl) {
      hiEl.textContent = `HI ${padScore(best)}`;
    }
  }

  /**
   * Renders the 1ST..10TH Retro Arcade High Score Table with full player names
   */
  function renderHighScoreTable(customScores) {
    if (typeof document === 'undefined') return;
    const scores = Array.isArray(customScores)
      ? sortAndRankScores(customScores)
      : state.scores;

    // Ensure table header says PLAYER instead of INIT
    const table = byId('high-score-table');
    if (table) {
      const ths = table.querySelectorAll('thead th');
      if (ths.length >= 2 && ths[1].textContent.trim().toUpperCase() === 'INIT') {
        ths[1].textContent = 'PLAYER';
      }
    }

    const tbody = byId('high-score-tbody', 'high-score-table-body', 'arcade-leaderboard-body');
    if (!tbody) return;

    const rowsHtml = [];
    for (let i = 0; i < MAX_LEADERBOARD_ROWS; i++) {
      const rankLabel = RANK_LABELS[i] || `${i + 1}TH`;
      const rowData = scores[i];
      const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : `rank-${i + 1}`;

      if (rowData) {
        const bp = formatBiggestPlanet(rowData.biggestPlanet, rowData.biggestPlanetObj);
        const sessionClass = (rowData.id === state.lastSubmittedId || rowData.isSession) ? 'is-current-session' : '';
        const tierClass = `tier-${bp.tier || 'MINI'}`;
        const displayName = escapeHtml(rowData.name || rowData.playerName || rowData.initials || 'Anonymous Sheep');
        const biggestCellHtml = bp.name && bp.name !== 'None'
          ? `<span class="tier-badge ${tierClass}">${escapeHtml(bp.tier)}</span> <span>${escapeHtml(bp.name)}</span>`
          : '—';

        rowsHtml.push(`
          <tr class="arcade-score-row ${rankClass} ${sessionClass}" data-rank="${i + 1}" data-player="${displayName}" data-initials="${displayName}">
            <td class="rank-cell">${rankLabel}</td>
            <td class="player-name-cell initials-cell">${displayName}</td>
            <td class="score-cell num-col">${padScore(rowData.score)}</td>
            <td class="num-col">${rowData.planetsCleared}</td>
            <td class="biggest-planet-cell">${biggestCellHtml}</td>
          </tr>
        `);
      } else {
        rowsHtml.push(`
          <tr class="arcade-score-row ${rankClass} is-empty-slot" data-rank="${i + 1}">
            <td class="rank-cell">${rankLabel}</td>
            <td class="player-name-cell initials-cell">---</td>
            <td class="score-cell num-col">000000</td>
            <td class="num-col">0</td>
            <td class="biggest-planet-cell">—</td>
          </tr>
        `);
      }
    }

    tbody.innerHTML = rowsHtml.join('');

    const bestSessionEl = byId('session-best-score', 'arcade-session-best');
    if (bestSessionEl) {
      bestSessionEl.textContent = padScore(state.bestSessionScore);
    }
  }

  /**
   * Renders the Current Run's Randomized Planet Scale Strip (8 solar system planets)
   */
  function renderPlanetScaleStrip(manifestInput, upcomingPlanetId, clearedPlanetIds) {
    if (typeof document === 'undefined') return;
    const container = byId('planet-scale-strip', 'planet-manifest-strip', 'planet-radar-grid');
    if (!container) return;

    const rawList = (Array.isArray(manifestInput) && manifestInput.length > 0)
      ? manifestInput
      : DEFAULT_PLANET_FALLBACK;

    const clearedSet = new Set(Array.isArray(clearedPlanetIds) ? clearedPlanetIds : []);

    const cardsHtml = rawList.map((planet) => {
      const id = planet.id || String(planet.name || '').toLowerCase();
      const name = planet.name || 'Planet';
      const tierKey = String(planet.tier || planet.sizeTier || 'MEDIUM').toUpperCase();
      const tierInfo = TIER_META[tierKey] || TIER_META.MEDIUM;
      const radius = Math.round(Number(planet.radius) || 32);
      const diameter = radius * 2;
      const points = Math.round(Number(planet.points || planet.basePoints || tierInfo.points));
      const baseColor = planet.baseColor || '#4dabf7';
      const accentColor = planet.accentColor || '#a5d8ff';
      const hasRings = Boolean(planet.hasRings || id === 'saturn' || id === 'uranus');

      const orbPx = Math.max(14, Math.min(44, Math.round((radius / 70) * 44)));
      const isUpcoming = upcomingPlanetId && (upcomingPlanetId === id || upcomingPlanetId === name);
      const isCleared = clearedSet.has(id) || clearedSet.has(name);

      return `
        <div class="planet-seed-card ${isUpcoming ? 'is-upcoming' : ''} ${isCleared ? 'is-cleared' : ''}"
             data-planet-id="${id}"
             data-planet-tier="${tierKey}"
             data-planet-radius="${radius}"
             data-planet-points="${points}">
          <span class="tier-badge tier-${tierKey}">${tierKey}</span>
          <div class="planet-orb-preview">
            <span class="planet-orb-circle ${hasRings ? 'has-rings' : ''}"
                  style="width:${orbPx}px;height:${orbPx}px;background:radial-gradient(circle at 32% 30%, ${accentColor}, ${baseColor} 68%, #090d16 100%);"></span>
          </div>
          <div class="planet-seed-name" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
          <div class="planet-seed-points">+${points} PTS</div>
          <div class="planet-seed-radius">R:${radius}px · Ø${diameter}px</div>
        </div>
      `;
    });

    container.innerHTML = cardsHtml.join('');
  }

  /**
   * Live HUD Updater called on animation frames or state transitions
   */
  function updateHUD(hudState = {}) {
    if (typeof document === 'undefined') return;

    const score = Math.max(0, Math.floor(Number(hudState.score) || 0));
    if (score > state.bestSessionScore) {
      state.bestSessionScore = score;
    }

    const scoreEl = byId('hud-score', 'score-value', 'current-score');
    if (scoreEl) {
      scoreEl.textContent = padScore(score);
    }

    updateHighScoreDisplay(score);

    const clearedEl = byId('hud-planets-cleared', 'planets-cleared-value', 'hud-cleared');
    if (clearedEl) {
      const count = Math.max(0, Math.floor(Number(hudState.planetsCleared ?? hudState.clearedCount) || 0));
      clearedEl.textContent = String(count);
    }

    const streakEl = byId('hud-streak', 'streak-value', 'hud-multiplier');
    if (streakEl) {
      const streak = Number(hudState.streak ?? hudState.streakCount ?? 0);
      const mult = Number(hudState.multiplier ?? hudState.streakMultiplier ?? (1 + Math.min(streak, 10) * 0.1));
      streakEl.textContent = `${mult.toFixed(1)}x (${streak})`;
    }

    const speedEl = byId('hud-speed', 'speed-value');
    if (speedEl) {
      const speedMult = Number(hudState.speedMultiplier ?? hudState.mach ?? 1.0);
      speedEl.textContent = `MACH ${speedMult.toFixed(1)}x`;
    }

    const nextPlanetEl = byId('hud-next-planet', 'next-planet-value');
    if (nextPlanetEl) {
      const nextP = hudState.nextPlanet || hudState.upcomingPlanet;
      if (nextP && typeof nextP === 'object') {
        const tier = String(nextP.tier || nextP.sizeTier || '').toUpperCase();
        nextPlanetEl.textContent = tier ? `${nextP.name} (${tier})` : String(nextP.name || 'Scanning...');
      } else if (typeof nextP === 'string' && nextP) {
        nextPlanetEl.textContent = nextP;
      } else {
        nextPlanetEl.textContent = 'Orbit Clear';
      }
    }

    const manifest = hudState.planetManifest || hudState.runPlanetManifest || hudState.manifest;
    if (Array.isArray(manifest) && manifest.length > 0) {
      const nextId = (hudState.nextPlanet && hudState.nextPlanet.id) || hudState.nextPlanetId || '';
      const sig = manifest.map((p) => `${p.id || p.name}:${p.tier || p.sizeTier}:${p.radius}`).join('|') + `|next:${nextId}`;
      if (sig !== state.lastManifestSignature) {
        state.lastManifestSignature = sig;
        renderPlanetScaleStrip(manifest, nextId, hudState.clearedPlanetIds);
      }
    }
  }

  /**
   * Logs a planet clearance event into the live telemetry feed
   */
  function logPlanetClear(clearEvent = {}) {
    if (typeof document === 'undefined') return;
    const listEl = byId('telemetry-feed-list', 'run-telemetry-list');
    if (!listEl) return;

    const name = clearEvent.name || clearEvent.planetName || 'Planet';
    const tier = String(clearEvent.tier || clearEvent.sizeTier || 'MEDIUM').toUpperCase();
    const points = Math.round(Number(clearEvent.points || clearEvent.bonus || 100));
    const radius = Math.round(Number(clearEvent.radius || 30));
    const closeCall = Boolean(clearEvent.closeCall);

    state.recentClears.unshift({ name, tier, points, radius, closeCall });
    state.recentClears = state.recentClears.slice(0, 5);

    listEl.innerHTML = state.recentClears.map((item) => `
      <li class="telemetry-feed-item">
        <span class="telemetry-planet-tag">
          <span class="tier-badge tier-${escapeHtml(item.tier)}">${escapeHtml(item.tier)}</span>
          <span>${escapeHtml(item.name)} (R:${item.radius}px)</span>
          ${item.closeCall ? '<span class="tier-badge tier-COLOSSAL">CLOSE CALL!</span>' : ''}
        </span>
        <span class="telemetry-points-tag">+${item.points} PTS</span>
      </li>
    `).join('');
  }

  function setPlayerName(str) {
    state.playerName = String(str ?? '').slice(0, MAX_NAME_LENGTH);
    const inputEl = getModalPlayerNameInput();
    if (inputEl) {
      inputEl.value = state.playerName;
    }
  }

  function openInitialsModal(runStats = {}, onSaveCallback) {
    if (typeof document === 'undefined') return;
    ensureModalDOM();

    const modal = byId('initials-modal');
    if (!modal) return;

    state.isTypingInitials = true;
    state.pendingRunStats = runStats;
    state.onInitialsSaved = typeof onSaveCallback === 'function' ? onSaveCallback : null;

    const score = Math.max(0, Math.floor(Number(runStats.score) || 0));
    const planetsCleared = Math.max(0, Math.floor(Number(runStats.planetsCleared) || 0));
    const bp = formatBiggestPlanet(runStats.biggestPlanet, runStats.biggestPlanetObj);
    const projectedRank = getProjectedRank(score);
    const qualifies = qualifiesForHighScore(score);

    const badgeEl = byId('initials-rank-badge');
    if (badgeEl) {
      badgeEl.textContent = qualifies
        ? `TOP 10 QUALIFIED · PROJECTED RANK #${projectedRank}`
        : `RUN COMPLETE · LOG YOUR SCORE`;
    }

    const scoreEl = byId('modal-run-score');
    if (scoreEl) scoreEl.textContent = padScore(score);

    const clearedEl = byId('modal-run-cleared');
    if (clearedEl) clearedEl.textContent = String(planetsCleared);

    const biggestEl = byId('modal-run-biggest');
    if (biggestEl) biggestEl.textContent = bp.name !== 'None' ? `${bp.name} (${bp.tier})` : 'None';

    modal.hidden = false;
    modal.classList.remove('is-hidden');

    const inputEl = getModalPlayerNameInput();
    if (inputEl) {
      if (runStats.playerName || runStats.name) {
        inputEl.value = String(runStats.playerName || runStats.name).slice(0, MAX_NAME_LENGTH);
      }
      setTimeout(() => {
        try {
          inputEl.focus();
          inputEl.select();
        } catch (_e) {}
      }, 20);
    }

    if (qualifies && global.TONY_ASSETS && global.TONY_ASSETS.TONY_AUDIO && typeof global.TONY_ASSETS.TONY_AUDIO.playNewHighScore === 'function') {
      global.TONY_ASSETS.TONY_AUDIO.playNewHighScore();
    }
  }

  function closeInitialsModal() {
    if (typeof document === 'undefined') return;
    const modal = byId('initials-modal');
    if (modal) {
      modal.hidden = true;
      modal.classList.add('is-hidden');
    }
    state.isTypingInitials = false;
    const inputEl = getModalPlayerNameInput();
    if (inputEl && typeof inputEl.blur === 'function') {
      inputEl.blur();
    }
  }

  function confirmInitialsEntry() {
    const stats = state.pendingRunStats || {};
    const inputEl = getModalPlayerNameInput();
    const enteredName = inputEl ? inputEl.value : state.playerName;
    const result = submitScore({
      name: enteredName,
      score: stats.score || 0,
      planetsCleared: stats.planetsCleared || 0,
      biggestPlanet: stats.biggestPlanetObj || stats.biggestPlanet || null,
      biggestPlanetObj: stats.biggestPlanetObj || null
    });
    const cb = state.onInitialsSaved;
    closeInitialsModal();
    if (typeof cb === 'function') {
      cb(result);
    }
    return result;
  }

  /**
   * Ensures the Full Player Name Entry Modal exists in the DOM (and upgrades any legacy 3-slot modal)
   */
  function ensureModalDOM() {
    if (typeof document === 'undefined') return;

    const modalHtml = `
      <div class="arcade-initials-dialog">
        <span id="initials-rank-badge" class="initials-header-badge">NEW HIGH SCORE!</span>
        <h2 id="initials-dialog-title" class="initials-dialog-title">ENTER PLAYER NAME</h2>
        <p class="section-subtitle" style="margin:0;">Enter your full name or callsign for the Galactic Sheep Hall of Fame</p>

        <div class="initials-run-summary">
          <div class="summary-stat-box">
            <span class="summary-stat-label">Final Score</span>
            <span id="modal-run-score" class="summary-stat-val">000000</span>
          </div>
          <div class="summary-stat-box">
            <span class="summary-stat-label">Planets Jumped</span>
            <span id="modal-run-cleared" class="summary-stat-val">0</span>
          </div>
          <div class="summary-stat-box">
            <span class="summary-stat-label">Biggest Cleared</span>
            <span id="modal-run-biggest" class="summary-stat-val">—</span>
          </div>
        </div>

        <div class="player-name-field-group">
          <label for="arcade-player-name-input" class="player-name-field-label">Player Name</label>
          <input
            type="text"
            id="arcade-player-name-input"
            class="arcade-name-input"
            maxlength="24"
            placeholder="Enter your name..."
            autocomplete="off"
            spellcheck="false"
            value="${escapeHtml(state.playerName)}"
          />
        </div>

        <div class="initials-dialog-actions">
          <button type="button" id="btn-save-initials" class="btn-arcade btn-primary">
            <span class="material-symbols-outlined">🏆</span>
            <span>SAVE TO ARCADE BOARD</span>
            <span class="kbd-hint">ENTER</span>
          </button>
          <button type="button" id="btn-skip-initials" class="btn-arcade">
            <span>SKIP</span>
            <span class="kbd-hint">ESC</span>
          </button>
        </div>
      </div>
    `;

    let modal = document.getElementById('initials-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'initials-modal';
      modal.className = 'arcade-initials-overlay is-hidden';
      modal.hidden = true;
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.setAttribute('aria-labelledby', 'initials-dialog-title');
      modal.innerHTML = modalHtml;
      document.body.appendChild(modal);
    } else if (!document.getElementById('arcade-player-name-input')) {
      modal.innerHTML = modalHtml;
      delete modal.dataset.bound;
    }

    bindModalEvents(modal);
  }

  function bindModalEvents(modalRoot) {
    if (!modalRoot || modalRoot.dataset.bound === 'true') return;
    modalRoot.dataset.bound = 'true';

    modalRoot.addEventListener('click', (e) => {
      if (e.target.closest('#btn-save-initials')) {
        confirmInitialsEntry();
        return;
      }
      if (e.target.closest('#btn-skip-initials')) {
        closeInitialsModal();
      }
    });

    const inputEl = modalRoot.querySelector('#arcade-player-name-input');
    if (inputEl) {
      inputEl.addEventListener('input', () => {
        state.playerName = inputEl.value;
      });
      inputEl.addEventListener('keydown', (e) => {
        // Stop game shortcut listeners from seeing keys typed in the name input
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          confirmInitialsEntry();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeInitialsModal();
        }
      });
    }
  }

  function bindGlobalKeyboard() {
    if (typeof window === 'undefined' || window.__tonyArcadeKeysBound) return;
    window.__tonyArcadeKeysBound = true;

    window.addEventListener('keydown', (e) => {
      if (!state.isTypingInitials) return;

      const inputEl = getModalPlayerNameInput();
      const isInputFocused = inputEl && document.activeElement === inputEl;

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        confirmInitialsEntry();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeInitialsModal();
        return;
      }

      // If the modal is open and the user starts typing while focus is not yet inside the input,
      // focus the input and let them type naturally without triggering game hotkeys.
      if (!isInputFocused && inputEl) {
        inputEl.focus();
      }
      e.stopPropagation();
    }, true);
  }

  const ICON_GLYPH_MAP = {
    keyboard_arrow_up: '▲',
    keyboard_arrow_down: '▼',
    emoji_events: '🏆',
    rocket_launch: '🚀',
    casino: '🎲',
    volume_up: '🔊',
    volume_off: '🔇',
    track_changes: '🎯',
    pause: '⏸',
    play_arrow: '▶',
    public: '🪐',
    shuffle: '↻',
    edit_square: '✎',
    tv: '📺',
    restart_alt: '↺',
    bolt: '⚡'
  };

  function normalizeOfflineIcons(rootEl) {
    if (typeof document === 'undefined') return;
    const scope = rootEl || document;
    const icons = scope.querySelectorAll('.material-symbols-outlined');
    icons.forEach((el) => {
      const raw = (el.textContent || '').trim();
      if (ICON_GLYPH_MAP[raw]) {
        el.textContent = ICON_GLYPH_MAP[raw];
      }
    });
  }

  function init(options = {}) {
    loadHighScores();
    if (typeof document !== 'undefined') {
      ensureModalDOM();
      normalizeOfflineIcons(document);
      const existingModal = byId('initials-modal');
      if (existingModal) bindModalEvents(existingModal);

      // Remove any legacy CRT classes or CRT buttons if present
      const cabinet = byId('high-score-cabinet');
      if (cabinet) {
        cabinet.classList.remove('crt-enabled', 'crt-scanlines');
      }
      const oldCrtBtn = byId('btn-toggle-crt', 'btn-crt-toggle', 'toggle-crt-btn');
      if (oldCrtBtn) {
        oldCrtBtn.remove();
      }

      if (!window.__tonyArcadeResetDelegated) {
        window.__tonyArcadeResetDelegated = true;
        document.addEventListener('click', (e) => {
          const btn = e.target && typeof e.target.closest === 'function'
            ? e.target.closest('#btn-reset-scores, #reset-high-scores-btn')
            : null;
          if (btn) {
            e.preventDefault();
            e.stopPropagation();
            resetHighScores();
          }
        }, true);
      }

      const resetBtn = byId('btn-reset-scores', 'reset-high-scores-btn');
      if (resetBtn && !resetBtn.dataset.bound) {
        resetBtn.dataset.bound = 'true';
        resetBtn.addEventListener('click', (e) => {
          e.preventDefault();
          resetHighScores();
        });
      }

      syncEngineHighScore(getTopScore());
      renderHighScoreTable();
      renderPlanetScaleStrip(options.planetManifest || DEFAULT_PLANET_FALLBACK);
      updateHUD({
        score: 0,
        planetsCleared: 0,
        streak: 0,
        multiplier: 1.0,
        speedMultiplier: 1.0,
        planetManifest: options.planetManifest || DEFAULT_PLANET_FALLBACK
      });
    }
    bindGlobalKeyboard();
    return TonyArcadeUI;
  }

  const TonyArcadeUI = {
    STORAGE_KEY,
    TIER_META,
    DEFAULT_SEED_SCORES,
    init,
    loadHighScores,
    getHighScores,
    saveHighScores,
    resetHighScores,
    clearHighScores: resetHighScores,
    seedArcadeBoard: resetHighScores,
    getTopScore,
    getHighScore: getTopScore,
    qualifiesForHighScore,
    getProjectedRank,
    submitScore,
    addHighScore: submitScore,
    renderHighScoreTable,
    renderPlanetScaleStrip,
    updateHUD,
    logPlanetClear,
    openInitialsModal,
    openScoreModal: openInitialsModal,
    handleGameOver: openInitialsModal,
    onGameOver: openInitialsModal,
    showGameOverModal: openInitialsModal,
    closeInitialsModal,
    closeScoreModal: closeInitialsModal,
    confirmInitialsEntry,
    setPlayerName,
    setInitialsString: setPlayerName,
    padScore,
    isModalOpen: () => state.isTypingInitials,
    get isTypingInitials() {
      return state.isTypingInitials;
    }
  };

  global.TonyArcadeUI = TonyArcadeUI;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TonyArcadeUI;
  }
})(typeof window !== 'undefined' ? window : globalThis);
