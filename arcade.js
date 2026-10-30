/**
 * Galactic Sheep — Centralised Server-Backed Multi-Player Arcade Leaderboard,
 * Full Player Name Entry, Collectible Stars Guide & Live HUD
 * Exposes window.TonyArcadeUI
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'tonys_jumping_game_highscores_v3';
  const PLAYER_NAME_STORAGE_KEY = 'galactic_sheep_player_name';
  const API_URL = '/api/leaderboard';

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

  const DEFAULT_STAR_CATALOG_FALLBACK = [
    {
      id: 'GOLD_SUPERNOVA',
      name: 'Gold Supernova',
      category: 'positive',
      color: '#FFD700',
      radius: 22,
      sizeLabel: 'LARGE',
      scoreDelta: 500,
      shortTag: '+500 PTS',
      description: 'Instant +500 bonus points!'
    },
    {
      id: 'CYAN_PULSAR',
      name: 'Cyan Pulsar',
      category: 'positive',
      color: '#00E5FF',
      radius: 18,
      sizeLabel: 'MEDIUM',
      scoreDelta: 250,
      shortTag: 'HIGH JUMP',
      description: 'Higher jumps (+25% apex) for 10s & +250 pts!'
    },
    {
      id: 'EMERALD_QUASAR',
      name: 'Emerald Quasar',
      category: 'positive',
      color: '#2ECC71',
      radius: 14,
      sizeLabel: 'MINI',
      scoreDelta: 300,
      shortTag: 'MINI + WIDE GAP',
      description: 'Makes Tony smaller (0.68x) & widens planet gaps (+30%) for 10s!'
    },
    {
      id: 'CRIMSON_DWARF',
      name: 'Crimson Dwarf',
      category: 'negative',
      color: '#FF3366',
      radius: 21,
      sizeLabel: 'LARGE',
      scoreDelta: -150,
      shortTag: 'BIG SHEEP + TIGHT GAP',
      description: 'Makes Tony bigger (1.38x), narrows planet gaps (-10%), & -150 pts!'
    },
    {
      id: 'VIOLET_NOVA',
      name: 'Violet Hazard Nova',
      category: 'negative',
      color: '#C77DFF',
      radius: 26,
      sizeLabel: 'COLOSSAL',
      scoreDelta: -300,
      shortTag: '5x GIANT PLANETS -300',
      description: 'Next 5 planets in a row grow larger (+32%) & loses 300 pts!'
    },
    {
      id: 'AMBER_ECLIPSE',
      name: 'Amber Eclipse',
      category: 'negative',
      color: '#FF7B00',
      radius: 16,
      sizeLabel: 'SMALL',
      scoreDelta: -200,
      shortTag: 'TIGHT GAPS -200',
      description: 'Narrows planet gaps slightly (-9%) for 8s & loses 200 pts!'
    }
  ];

  const DEFAULT_SEED_SCORES = [];

  // Internal state
  const state = {
    scores: [],
    bestSessionScore: 0,
    lastSubmittedId: null,
    pendingRunEntryId: null,
    isTypingInitials: false,
    playerName: '',
    pendingRunStats: null,
    onInitialsSaved: null,
    recentClears: [],
    lastManifestSignature: '',
    lastEffectsSignature: '',
    lastSeenRunId: -1,
    serverOnline: false,
    pollTimer: null,
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

  function normalizePlayerName(raw) {
    const cleaned = String(raw ?? '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_NAME_LENGTH);
    return cleaned || 'Anonymous Sheep';
  }

  function loadRememberedPlayerName() {
    if (state.playerName) return state.playerName;
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(PLAYER_NAME_STORAGE_KEY);
        if (saved && saved.trim()) {
          state.playerName = saved.trim().slice(0, MAX_NAME_LENGTH);
          return state.playerName;
        }
      }
    } catch (_err) {}
    return '';
  }

  function saveRememberedPlayerName(name) {
    const clean = String(name ?? '').trim().slice(0, MAX_NAME_LENGTH);
    if (!clean) return;
    state.playerName = clean;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PLAYER_NAME_STORAGE_KEY, clean);
      }
    } catch (_err) {}
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
      initials: fullName,
      score: Math.max(0, Math.floor(Number(entry.score) || 0)),
      planetsCleared: Math.max(0, Math.floor(Number(entry.planetsCleared) || 0)),
      perfectJumps: Math.max(0, Math.floor(Number(entry.perfectJumps) || 0)),
      starsCollected: Math.max(0, Math.floor(Number(entry.starsCollected) || 0)),
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
    const dedupMap = new Map();
    for (const raw of (Array.isArray(list) ? list : [])) {
      if (isLegacySeedEntry(raw)) continue;
      const norm = normalizeScoreEntry(raw);
      if (norm.score <= 0) continue;
      dedupMap.set(norm.id, norm);
    }
    return Array.from(dedupMap.values())
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
            state.scores = sortAndRankScores(filtered);
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
    } catch (_err) {}
    if (!Array.isArray(state.scores)) {
      state.scores = [];
    }
    return state.scores;
  }

  function getHighScores() {
    if (Array.isArray(state.scores) && state.scores.length > 0) {
      return state.scores.slice();
    }
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
    } catch (_err) {}
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

  function canUseServerApi() {
    if (typeof fetch !== 'function') return false;
    if (typeof location !== 'undefined' && location.protocol === 'file:') return false;
    return true;
  }

  function updateServerStatusBadge(online) {
    state.serverOnline = Boolean(online);
    if (typeof document === 'undefined') return;
    const badge = byId('server-sync-badge');
    if (badge) {
      badge.textContent = state.serverOnline ? 'LIVE SERVER SYNC' : 'LOCAL STORAGE';
    }
  }

  /**
   * Centralised Server Leaderboard Fetch (GET /api/leaderboard)
   * Called automatically on init, at the start of every game run, and every 4s.
   */
  async function fetchServerLeaderboard() {
    if (!canUseServerApi()) {
      return getHighScores();
    }
    try {
      const resp = await fetch(API_URL, {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      });
      if (!resp.ok) {
        return getHighScores();
      }
      const data = await resp.json();
      if (data && Array.isArray(data.scores)) {
        updateServerStatusBadge(true);
        const serverScores = saveHighScores(data.scores);
        const activeEngineScore =
          (global.gameEngine && global.gameEngine.isPlaying && global.gameEngine.score) || 0;
        if (serverScores.length === 0 && activeEngineScore === 0) {
          state.bestSessionScore = 0;
        }
        const top = Math.max(
          serverScores.length > 0 ? serverScores[0].score : 0,
          activeEngineScore
        );
        syncEngineHighScore(top);
        renderHighScoreTable(serverScores);
        updateHighScoreDisplay(activeEngineScore, serverScores.length === 0 && activeEngineScore === 0);
        return serverScores;
      }
    } catch (_err) {
      updateServerStatusBadge(false);
    }
    return getHighScores();
  }

  async function postScoreToServer(entryObj) {
    if (!canUseServerApi()) return null;
    try {
      const resp = await fetch(API_URL, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(entryObj)
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      if (data && Array.isArray(data.scores)) {
        updateServerStatusBadge(true);
        const serverScores = saveHighScores(data.scores);
        syncEngineHighScore(getTopScore());
        renderHighScoreTable(serverScores);
        updateHighScoreDisplay();
        return data;
      }
    } catch (_err) {}
    return null;
  }

  async function clearServerLeaderboard() {
    // Safe no-op: players cannot wipe the shared household leaderboard.
    return getHighScores();
  }

  function startServerPolling(intervalMs = 4000) {
    if (typeof window === 'undefined' || !canUseServerApi()) return;
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = setInterval(() => {
      if (!state.isTypingInitials) {
        fetchServerLeaderboard();
      }
    }, intervalMs);
  }

  /**
   * Safe no-op: preserves existing player scores in state.scores, localStorage, and /api/leaderboard
   * so players cannot wipe the shared household leaderboard.
   */
  function resetHighScores() {
    return getHighScores();
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

  /**
   * Submits or updates a score entry both locally and on POST /api/leaderboard.
   * If `entry.id` matches an existing entry (e.g. auto-saved at Game Over and then updated
   * with the player's entered name in the modal), updates it in-place without duplicating.
   */
  function submitScore(entry = {}) {
    if (!Array.isArray(state.scores)) {
      loadHighScores();
    }
    const inputEl = getModalPlayerNameInput();
    const rawName =
      entry.name ??
      entry.playerName ??
      entry.initials ??
      (inputEl && inputEl.value ? inputEl.value : loadRememberedPlayerName()) ??
      'Anonymous Sheep';

    const entryId = entry.id || state.pendingRunEntryId || `player-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const newEntry = normalizeScoreEntry({
      id: entryId,
      name: rawName,
      score: entry.score,
      planetsCleared: entry.planetsCleared,
      perfectJumps: entry.perfectJumps,
      starsCollected: entry.starsCollected,
      biggestPlanet: entry.biggestPlanet,
      biggestPlanetObj: entry.biggestPlanetObj,
      date: entry.date || new Date().toISOString().slice(0, 10),
      isSession: true,
      isSeed: false
    });

    if (rawName && rawName.trim() && rawName.trim() !== 'Anonymous Sheep') {
      saveRememberedPlayerName(newEntry.name);
    }

    if (newEntry.score > state.bestSessionScore) {
      state.bestSessionScore = newEntry.score;
    }
    state.lastSubmittedId = newEntry.id;

    const withoutSameId = state.scores.filter((item) => item.id !== newEntry.id);
    const combined = newEntry.score > 0 ? withoutSameId.concat([newEntry]) : withoutSameId;
    const updated = saveHighScores(combined);
    const savedRecord = updated.find((item) => item.id === newEntry.id) || null;

    syncEngineHighScore(getTopScore());
    renderHighScoreTable(updated);
    updateHighScoreDisplay(newEntry.score);

    const serverPromise = newEntry.score > 0 ? postScoreToServer(newEntry) : Promise.resolve(null);

    return {
      madeTop10: Boolean(savedRecord),
      rank: savedRecord ? savedRecord.rank : null,
      entry: savedRecord || newEntry,
      scores: updated,
      serverPromise
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
   * Renders the 6 Surprise Floating Collectible Stars Guide (#star-legend-grid)
   */
  function renderStarLegend(customCatalog) {
    if (typeof document === 'undefined') return;
    const container = byId('star-legend-grid', 'star-collectibles-grid');
    if (!container) return;

    const rawCatalog =
      customCatalog ||
      (global.TONY_ASSETS && global.TONY_ASSETS.STAR_CATALOG) ||
      global.STAR_CATALOG ||
      DEFAULT_STAR_CATALOG_FALLBACK;

    const list = Array.isArray(rawCatalog)
      ? rawCatalog
      : Object.values(rawCatalog || {});

    const items = list.length > 0 ? list : DEFAULT_STAR_CATALOG_FALLBACK;

    container.innerHTML = items.map((star) => {
      const isPos = String(star.category || '').toLowerCase() === 'positive' || Number(star.scoreDelta) > 0;
      const cardClass = isPos ? 'star-card-positive' : 'star-card-negative';
      const badgeClass = isPos ? 'tier-MINI' : 'tier-COLOSSAL';
      const signLabel = isPos ? 'POSITIVE STAR' : 'HAZARD STAR';
      const color = star.color || (isPos ? '#FFD700' : '#FF3366');
      const shortTag = star.shortTag || (star.scoreDelta > 0 ? `+${star.scoreDelta} PTS` : `${star.scoreDelta} PTS`);
      return `
        <div class="star-legend-card ${cardClass}" data-star-id="${escapeHtml(star.id || star.name)}">
          <div class="star-icon-swatch" style="color:${escapeHtml(color)};text-shadow:0 0 10px ${escapeHtml(color)};">★</div>
          <div class="star-card-body">
            <div class="star-card-title-row">
              <span class="star-card-name">${escapeHtml(star.name)}</span>
              <span class="tier-badge ${badgeClass}">${escapeHtml(shortTag)}</span>
            </div>
            <div class="star-card-desc">
              <strong>${signLabel} (${escapeHtml(star.sizeLabel || 'R:' + star.radius + 'px')}):</strong>
              ${escapeHtml(star.description || '')}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Renders active star modifiers, enlarged planet surges & perfect jump counts into #active-effects-strip
   */
  function renderActiveEffects(hudState = {}) {
    if (typeof document === 'undefined') return;
    const strip = byId('active-effects-strip');
    if (!strip) return;

    const pills = [];
    const perfectJumps = Math.max(0, Math.floor(Number(hudState.perfectJumps) || 0));
    const starsCollected = Math.max(0, Math.floor(Number(hudState.starsCollected) || 0));

    pills.push(
      `<span class="active-effect-pill is-gold">⚡ Perfect Jumps: ${perfectJumps}</span>`
    );
    pills.push(
      `<span class="active-effect-pill is-neutral">★ Stars Collected: ${starsCollected}</span>`
    );

    const effectsList = Array.isArray(hudState.activeEffects) ? hudState.activeEffects : [];
    for (const eff of effectsList) {
      if (!eff) continue;
      const isNeg = String(eff.category || eff.polarity || '').toLowerCase() === 'negative' || Boolean(eff.isNegative);
      const pillClass = isNeg ? 'is-negative' : 'is-positive';
      const label = eff.label || eff.name || eff.shortTag || eff.type || 'Star Effect';
      const rem = eff.remainingSec
        ? ` (${Number(eff.remainingSec).toFixed(1)}s)`
        : eff.remainingCount
        ? ` (${eff.remainingCount} left)`
        : '';
      pills.push(
        `<span class="active-effect-pill ${pillClass}">${escapeHtml(label)}${escapeHtml(rem)}</span>`
      );
    }

    const enlargedRem = Math.max(0, Math.floor(Number(hudState.enlargedPlanetsRemaining) || 0));
    if (enlargedRem > 0 && !effectsList.some((e) => e && e.type === 'FIVE_BIGGER_PLANETS')) {
      pills.push(
        `<span class="active-effect-pill is-negative">🪐 Giant Planet Surge: ${enlargedRem} left</span>`
      );
    }

    const tonyScale = Number(hudState.tonyScale || 1.0);
    if (tonyScale < 0.95 && effectsList.length === 0) {
      pills.push(`<span class="active-effect-pill is-positive">🐑 Mini Sheep (${tonyScale.toFixed(2)}x) & Wider Gaps</span>`);
    } else if (tonyScale > 1.05 && effectsList.length === 0) {
      pills.push(`<span class="active-effect-pill is-negative">🐑 Giant Sheep (${tonyScale.toFixed(2)}x) & Tighter Gaps</span>`);
    }

    const jumpMult = Number(hudState.jumpBoostMultiplier || 1.0);
    if (jumpMult > 1.05 && effectsList.length === 0) {
      pills.push(`<span class="active-effect-pill is-positive">🚀 High Jump Boost (${jumpMult.toFixed(2)}x)</span>`);
    }

    const sig = pills.join('|');
    if (sig !== state.lastEffectsSignature) {
      state.lastEffectsSignature = sig;
      strip.innerHTML = pills.join('');
    }
  }

  /**
   * Live HUD Updater called on animation frames or state transitions
   */
  function updateHUD(hudState = {}) {
    if (typeof document === 'undefined') return;

    // Automatically sync centralized leaderboard whenever a new game run begins
    if (typeof hudState.runId === 'number' && hudState.runId !== state.lastSeenRunId) {
      state.lastSeenRunId = hudState.runId;
      fetchServerLeaderboard();
    }

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

    const perfectEl = byId('hud-perfect-jumps', 'perfect-jumps-value');
    if (perfectEl) {
      const pCount = Math.max(0, Math.floor(Number(hudState.perfectJumps) || 0));
      perfectEl.textContent = String(pCount);
    }

    const starsEl = byId('hud-stars-collected', 'stars-collected-value');
    if (starsEl) {
      const sCount = Math.max(0, Math.floor(Number(hudState.starsCollected) || 0));
      starsEl.textContent = String(sCount);
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

    renderActiveEffects(hudState);

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

  function renderTelemetryFeed() {
    if (typeof document === 'undefined') return;
    const listEl = byId('telemetry-feed-list', 'run-telemetry-list');
    if (!listEl) return;

    listEl.innerHTML = state.recentClears.map((item) => {
      const ptsClass = item.isNegative ? 'telemetry-points-tag is-negative' : 'telemetry-points-tag';
      const ptsPrefix = item.points >= 0 ? `+${item.points} PTS` : `${item.points} PTS`;
      return `
        <li class="telemetry-feed-item">
          <span class="telemetry-planet-tag">
            <span class="tier-badge ${escapeHtml(item.badgeClass || 'tier-MEDIUM')}">${escapeHtml(item.badgeText || 'EVENT')}</span>
            <span>${escapeHtml(item.title)}</span>
            ${item.extraBadge ? `<span class="tier-badge tier-COLOSSAL">${escapeHtml(item.extraBadge)}</span>` : ''}
          </span>
          <span class="${ptsClass}">${escapeHtml(ptsPrefix)}</span>
        </li>
      `;
    }).join('');
  }

  function logPlanetClear(clearEvent = {}) {
    const name = clearEvent.name || clearEvent.planetName || 'Planet';
    const tier = String(clearEvent.tier || clearEvent.sizeTier || 'MEDIUM').toUpperCase();
    const points = Math.round(Number(clearEvent.points || clearEvent.bonus || 100));
    const radius = Math.round(Number(clearEvent.radius || 30));
    const closeCall = Boolean(clearEvent.closeCall);

    state.recentClears.unshift({
      badgeClass: `tier-${tier}`,
      badgeText: tier,
      title: `${name} (R:${radius}px)`,
      extraBadge: closeCall ? 'CLOSE CALL!' : '',
      points,
      isNegative: false
    });
    state.recentClears = state.recentClears.slice(0, 6);
    renderTelemetryFeed();
  }

  function logPerfectJump(jumpEvent = {}) {
    const planetName = jumpEvent.planetName || (jumpEvent.planet && jumpEvent.planet.name) || 'Planet';
    const bonus = Math.round(Number(jumpEvent.bonus || jumpEvent.points || 200));
    state.recentClears.unshift({
      badgeClass: 'tier-MEDIUM',
      badgeText: 'PERFECT JUMP',
      title: `Optimal Launch Window · ${planetName}`,
      extraBadge: '',
      points: bonus,
      isNegative: false
    });
    state.recentClears = state.recentClears.slice(0, 6);
    renderTelemetryFeed();
  }

  function logStarCollected(starEvent = {}) {
    const name = starEvent.name || starEvent.starName || 'Cosmic Star';
    const delta = Math.round(Number(starEvent.scoreDelta ?? starEvent.points ?? 0));
    const isNeg = String(starEvent.category || '').toLowerCase() === 'negative' || delta < 0;
    const shortTag = starEvent.shortTag || (isNeg ? 'HAZARD STAR' : 'STAR BUFF');

    state.recentClears.unshift({
      badgeClass: isNeg ? 'tier-COLOSSAL' : 'tier-MINI',
      badgeText: isNeg ? 'HAZARD ★' : 'BONUS ★',
      title: `${name} · ${shortTag}`,
      extraBadge: '',
      points: delta,
      isNegative: isNeg
    });
    state.recentClears = state.recentClears.slice(0, 6);
    renderTelemetryFeed();
  }

  function setPlayerName(str) {
    state.playerName = String(str ?? '').slice(0, MAX_NAME_LENGTH);
    saveRememberedPlayerName(state.playerName);
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

    // Assign a deterministic entry ID for this run so auto-saving at Game Over
    // and subsequently clicking Save in the modal updates the same server record in-place.
    state.pendingRunEntryId =
      runStats.entryId ||
      runStats.id ||
      `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const remembered = loadRememberedPlayerName();
    if (score > 0) {
      submitScore({
        id: state.pendingRunEntryId,
        name: runStats.playerName || runStats.name || remembered || 'Anonymous Sheep',
        score,
        planetsCleared,
        perfectJumps: runStats.perfectJumps || 0,
        starsCollected: runStats.starsCollected || 0,
        biggestPlanet: runStats.biggestPlanetObj || runStats.biggestPlanet || null,
        biggestPlanetObj: runStats.biggestPlanetObj || null
      });
    }

    const projectedRank = getProjectedRank(score);
    const qualifies = qualifiesForHighScore(score);

    const badgeEl = byId('initials-rank-badge');
    if (badgeEl) {
      badgeEl.textContent = qualifies
        ? `SHARED BOARD RANK #${projectedRank} · SCORE SAVED!`
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
      } else if (remembered) {
        inputEl.value = remembered;
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
      id: state.pendingRunEntryId,
      name: enteredName,
      score: stats.score || 0,
      planetsCleared: stats.planetsCleared || 0,
      perfectJumps: stats.perfectJumps || 0,
      starsCollected: stats.starsCollected || 0,
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

  function ensureModalDOM() {
    if (typeof document === 'undefined') return;

    const modalHtml = `
      <div class="arcade-initials-dialog">
        <span id="initials-rank-badge" class="initials-header-badge">NEW HIGH SCORE!</span>
        <h2 id="initials-dialog-title" class="initials-dialog-title">ENTER PLAYER NAME</h2>
        <p class="section-subtitle" style="margin:0;">Saved to the centralised Galactic Sheep Hall of Fame</p>

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
            value="${escapeHtml(loadRememberedPlayerName())}"
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
    loadRememberedPlayerName();
    if (typeof document !== 'undefined') {
      ensureModalDOM();
      normalizeOfflineIcons(document);
      const existingModal = byId('initials-modal');
      if (existingModal) bindModalEvents(existingModal);

      const cabinet = byId('high-score-cabinet');
      if (cabinet) {
        cabinet.classList.remove('crt-enabled', 'crt-scanlines');
      }
      const oldCrtBtn = byId('btn-toggle-crt', 'btn-crt-toggle', 'toggle-crt-btn');
      if (oldCrtBtn) {
        oldCrtBtn.remove();
      }

      const oldResetBtn = byId('btn-reset-scores', 'reset-high-scores-btn');
      if (oldResetBtn && typeof oldResetBtn.remove === 'function') {
        oldResetBtn.remove();
      }

      syncEngineHighScore(getTopScore());
      renderHighScoreTable();
      renderPlanetScaleStrip(options.planetManifest || DEFAULT_PLANET_FALLBACK);
      renderStarLegend(options.starCatalog);
      updateHUD({
        score: 0,
        planetsCleared: 0,
        perfectJumps: 0,
        starsCollected: 0,
        streak: 0,
        multiplier: 1.0,
        speedMultiplier: 1.0,
        planetManifest: options.planetManifest || DEFAULT_PLANET_FALLBACK
      });

      fetchServerLeaderboard();
      startServerPolling(4000);
    }
    bindGlobalKeyboard();
    return TonyArcadeUI;
  }

  const TonyArcadeUI = {
    STORAGE_KEY,
    PLAYER_NAME_STORAGE_KEY,
    API_URL,
    TIER_META,
    DEFAULT_SEED_SCORES,
    DEFAULT_STAR_CATALOG_FALLBACK,
    init,
    loadHighScores,
    getHighScores,
    saveHighScores,
    fetchServerLeaderboard,
    syncFromServer: fetchServerLeaderboard,
    refreshLeaderboard: fetchServerLeaderboard,
    onRunStartSync: fetchServerLeaderboard,
    postScoreToServer,
    clearServerLeaderboard,
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
    renderStarLegend,
    renderActiveEffects,
    updateHUD,
    logPlanetClear,
    logPerfectJump,
    logStarCollected,
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
