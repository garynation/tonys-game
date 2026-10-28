/**
 * Tony's Jumping Game — Core 60fps HTML5 Canvas Game Engine
 * Exposes `window.TonyGameEngine`
 *
 * Features:
 * 1. Responsive Spacebar / ArrowUp / Pointer jump controls with variable hold boost (up to 160ms),
 *    jump buffering, coyote time, and Optimal Launch Window precision takeoff mechanics.
 * 2. Per-run Planet Size Randomization (`seedRunPlanets()` & `getRunPlanetManifest()`) across the
 *    8 solar system planets (Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune) and
 *    5 Size Tiers (`MINI`, `SMALL`, `MEDIUM`, `LARGE`, `COLOSSAL`).
 * 3. Continuous distance scoring + radius/tier-proportional planet clearance bonuses (`+100` to `+1000+`),
 *    `"CLOSE CALL! +250"` surface-skim bonus on Large/Colossal planets, consecutive jump streak
 *    multiplier, and floating canvas score popups.
 * 4. Forgiving `circle-vs-capsule` collision detection (82% inner core collision radius for ringed/giant
 *    planets) and toggleable (`H` key) Hitbox & Jump Trajectory Debug Overlay.
 */
(function (root) {
  'use strict';

  const SIZE_TIERS = {
    MINI: {
      id: 'MINI',
      label: 'MINI',
      displayName: 'Mini',
      minRadius: 18,
      maxRadius: 24,
      basePoints: 100,
      multiplier: 1.0,
      weight: 0.24,
      color: '#4dd0e1',
      badgeColor: '#00bcd4',
      launchWindowWidth: 230,
      timingHint: 'Forgiving timing window'
    },
    SMALL: {
      id: 'SMALL',
      label: 'SMALL',
      displayName: 'Small',
      minRadius: 26,
      maxRadius: 33,
      basePoints: 200,
      multiplier: 2.0,
      weight: 0.24,
      color: '#69f0ae',
      badgeColor: '#00e676',
      launchWindowWidth: 200,
      timingHint: 'Comfortable timing window'
    },
    MEDIUM: {
      id: 'MEDIUM',
      label: 'MEDIUM',
      displayName: 'Medium',
      minRadius: 35,
      maxRadius: 44,
      basePoints: 350,
      multiplier: 3.5,
      weight: 0.22,
      color: '#ffd740',
      badgeColor: '#ffc400',
      launchWindowWidth: 170,
      timingHint: 'Moderate timing window'
    },
    LARGE: {
      id: 'LARGE',
      label: 'LARGE',
      displayName: 'Large',
      minRadius: 46,
      maxRadius: 56,
      basePoints: 600,
      multiplier: 6.0,
      weight: 0.17,
      color: '#ffab40',
      badgeColor: '#ff9100',
      launchWindowWidth: 135,
      timingHint: 'Narrow takeoff window'
    },
    COLOSSAL: {
      id: 'COLOSSAL',
      label: 'COLOSSAL',
      displayName: 'Colossal',
      minRadius: 58,
      maxRadius: 70,
      basePoints: 1000,
      multiplier: 10.0,
      weight: 0.13,
      color: '#ff5252',
      badgeColor: '#ff1744',
      launchWindowWidth: 108,
      timingHint: 'Razor-sharp precision timing required!'
    }
  };

  const SIZE_TIER_ORDER = ['MINI', 'SMALL', 'MEDIUM', 'LARGE', 'COLOSSAL'];

  const DEFAULT_PLANETS = [
    {
      id: 'mercury',
      name: 'Mercury',
      tagline: 'Swift Cratered Messenger',
      baseColor: '#9e9e9e',
      accentColor: '#cfd8dc',
      hasRings: false
    },
    {
      id: 'venus',
      name: 'Venus',
      tagline: 'Golden Sulfuric Shroud',
      baseColor: '#e6b85c',
      accentColor: '#fff3cd',
      hasRings: false
    },
    {
      id: 'earth',
      name: 'Earth',
      tagline: 'Blue Marble Biosphere',
      baseColor: '#2b82d9',
      accentColor: '#66bb6a',
      hasRings: false
    },
    {
      id: 'mars',
      name: 'Mars',
      tagline: 'Rust-Red Dusty Frontier',
      baseColor: '#d95338',
      accentColor: '#ffccbc',
      hasRings: false
    },
    {
      id: 'jupiter',
      name: 'Jupiter',
      tagline: 'Banded Storm Colossus',
      baseColor: '#d49b6a',
      accentColor: '#c85a32',
      hasRings: false
    },
    {
      id: 'saturn',
      name: 'Saturn',
      tagline: 'Crowned Ringed Jewel',
      baseColor: '#e3c178',
      accentColor: '#bcaaa4',
      hasRings: true
    },
    {
      id: 'uranus',
      name: 'Uranus',
      tagline: 'Tilted Cyan Ice Giant',
      baseColor: '#64d8dc',
      accentColor: '#e0f7fa',
      hasRings: true
    },
    {
      id: 'neptune',
      name: 'Neptune',
      tagline: 'Supersonic Azure Deep',
      baseColor: '#3955d9',
      accentColor: '#82b1ff',
      hasRings: false
    }
  ];

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  /**
   * Computes the strictly monotonic base clearance score for a given sizeTier and pixel radius.
   * Ensures larger radius/tier ALWAYS yields strictly more points while anchoring on
   * MINI=100, SMALL=200, MEDIUM=350, LARGE=600, COLOSSAL=1000.
   */
  function computePlanetClearancePoints(sizeTierId, radius) {
    const tier = SIZE_TIERS[sizeTierId] || SIZE_TIERS.MEDIUM;
    const clampedR = clamp(
      typeof radius === 'number' ? radius : tier.minRadius,
      tier.minRadius,
      tier.maxRadius
    );
    const span = Math.max(1, tier.maxRadius - tier.minRadius);
    const ratio = (clampedR - tier.minRadius) / span;
    const radiusBonus = Math.round(ratio * (tier.basePoints * 0.15));
    return tier.basePoints + radiusBonus;
  }

  class TonyGameEngine {
    constructor(options = {}) {
      if (typeof document !== 'undefined' && options instanceof HTMLElement) {
        options = { canvas: options };
      } else if (typeof options === 'string' && typeof document !== 'undefined') {
        options = { canvas: document.getElementById(options) || document.querySelector(options) };
      }

      this.options = options || {};
      this.canvas =
        this.options.canvas ||
        (typeof document !== 'undefined'
          ? document.getElementById('game-canvas') || document.querySelector('canvas')
          : null);
      this.ctx = this.canvas && this.canvas.getContext ? this.canvas.getContext('2d') : null;

      this.width = this.canvas ? this.canvas.width || 960 : 960;
      this.height = this.canvas ? this.canvas.height || 420 : 420;
      if (this.canvas) {
        if (!this.canvas.width) this.canvas.width = this.width;
        if (!this.canvas.height) this.canvas.height = this.height;
      }

      this.groundY = this.height - 66;

      // Physics constants (calibrated at 60fps step = 16.667ms)
      this.physics = {
        gravity: 0.50,              // px / frame^2
        jumpVelocityTap: -13.1,     // crisp standard tap jump (clears up to ~171px peak)
        jumpVelocityPrecision: -14.2, // optimal launch window boost (clears up to ~201px peak)
        holdBoostPerFrame: -0.22,   // additional upward lift while holding Space up to 160ms
        maxHoldDurationMs: 160,
        coyoteTimeMs: 95,
        jumpBufferMs: 130,
        baseSpeed: 7.4,             // px / frame at 60fps (MACH 1.0x)
        maxSpeed: 13.8,             // px / frame cap
        speedRampPerSecond: 0.065,  // gradual acceleration
        collisionCoreRatio: 0.82    // forgiving 82% inner core collision radius
      };

      // Game state
      this.status = 'READY'; // 'READY' | 'PLAYING' | 'PAUSED' | 'GAMEOVER'
      this.mode = 'READY';
      this.isRunning = false;
      this.isPlaying = false;
      this.isPaused = false;
      this.isGameOver = false;
      this.isReady = true;

      this.debugHitboxes = Boolean(this.options.debugHitboxes);
      this.muted = Boolean(this.options.muted);

      // Run metrics & scoring
      this.runId = 0;
      this.lastManifestSignature = '';
      this.runPlanetManifest = [];
      this.planetQueue = [];
      this.nextPlanetPreview = null;

      this.score = 0;
      this.distanceScore = 0;
      this.bonusScore = 0;
      this.distanceAccumulator = 0;
      this.highScore = this._loadInitialHighScore();

      this.planetsCleared = 0;
      this.clearedPlanetsHistory = [];
      this.biggestPlanetCleared = null;
      this.streak = 0;
      this.maxStreak = 0;
      this.streakMultiplier = 1.0;

      this.speed = this.physics.baseSpeed;
      this.mach = 1.0;
      this.scrollOffset = 0;
      this.elapsedRunMs = 0;
      this.frameCount = 0;
      this.lastStartTimestamp = 0;

      // Tony the sheep state
      this.tony = this._createInitialTonyState();
      this.player = this.tony; // alias

      // Active obstacles, popups, particles, stars
      this.obstacles = [];
      this.planets = this.obstacles; // alias
      this.popups = [];
      this.floatingTexts = this.popups; // alias
      this.particles = [];
      this.stars = this._initFallbackStarfield();
      this.groundPosts = [];

      // Input tracking
      this.input = {
        spaceDown: false,
        spacePressedAt: 0,
        jumpBufferUntil: 0,
        bindKeyboard: this.options.bindKeyboard !== false,
        bindPointer: this.options.bindPointer !== false
      };

      // Callbacks
      this.onScoreChange = this.options.onScoreChange || null;
      this.onPlanetCleared = this.options.onPlanetCleared || null;
      this.onGameOver = this.options.onGameOver || null;
      this.onRunStart = this.options.onRunStart || null;
      this.onManifestUpdate = this.options.onManifestUpdate || null;
      this.onStateChange = this.options.onStateChange || null;

      // Seed the initial run manifest and preview obstacle
      this.seedRunPlanets();
      this._resetWorldEntities(false);

      // Bind DOM listeners if in browser
      this._boundKeyDown = this._handleKeyDown.bind(this);
      this._boundKeyUp = this._handleKeyUp.bind(this);
      this._boundPointerDown = this._handlePointerDown.bind(this);
      this._boundPointerUp = this._handlePointerUp.bind(this);
      this._attachListeners();

      // Animation loop handle
      this._rafId = null;
      this._lastFrameTime = 0;
      this.startLoop();

      // Register global convenience references
      if (root) {
        root.gameEngine = this;
        root.tonyEngine = this;
        TonyGameEngine.instance = this;
      }
    }

    _loadInitialHighScore() {
      try {
        if (root && root.TonyArcadeUI && typeof root.TonyArcadeUI.getHighScore === 'function') {
          return Number(root.TonyArcadeUI.getHighScore()) || 0;
        }
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem('tonys_jumping_game_highscores_v1');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return Math.max(...parsed.map((item) => Number(item.score) || 0));
            }
          }
        }
      } catch (_err) {
        // Ignore storage errors in sandboxed contexts
      }
      return 12500;
    }

    _createInitialTonyState() {
      const groundY = this.groundY;
      return {
        name: 'Tony',
        anchor: 'bottom-center',
        x: 148,
        y: groundY,
        groundY: groundY,
        altitude: 0,
        vx: 0,
        vy: 0,
        width: 56,
        height: 50,
        capsuleRadius: 19,
        onGround: true,
        isGrounded: true,
        isJumping: false,
        isDead: false,
        isCrashed: false,
        holdingJump: false,
        holdElapsedMs: 0,
        chargeRatio: 0,
        lastGroundedAt: 0,
        launchQuality: 'STANDARD', // 'STANDARD' | 'OPTIMAL' | 'EARLY' | 'LATE'
        animFrame: 0,
        animTime: 0,
        runCycle: 0,
        legPhase: 0,
        scarfWave: 0,
        squashX: 1.0,
        squashY: 1.0,
        scaleX: 1.0,
        scaleY: 1.0,
        rotation: 0,
        eyeState: 'determined', // 'determined' | 'wide' | 'dizzy'
        expression: 'determined',
        nearGiantPlanet: false,
        showNameplate: true
      };
    }

    _initFallbackStarfield() {
      const layers = [];
      const counts = [42, 28, 16];
      const speeds = [0.18, 0.42, 0.85];
      for (let layerIdx = 0; layerIdx < 3; layerIdx++) {
        for (let i = 0; i < counts[layerIdx]; i++) {
          layers.push({
            x: Math.random() * this.width,
            y: Math.random() * (this.groundY - 24),
            size: layerIdx === 0 ? 1.1 : layerIdx === 1 ? 1.8 : 2.5,
            speedFactor: speeds[layerIdx],
            twinklePhase: Math.random() * Math.PI * 2,
            color:
              layerIdx === 2
                ? '#e0f7fa'
                : layerIdx === 1
                ? '#fff9c4'
                : '#b0bec5'
          });
        }
      }
      return layers;
    }

    _getCatalogPlanets() {
      const externalCatalog =
        root &&
        root.TONY_ASSETS &&
        root.TONY_ASSETS.PLANET_CATALOG;
      if (Array.isArray(externalCatalog) && externalCatalog.length >= 8) {
        return externalCatalog;
      }
      if (externalCatalog && typeof externalCatalog === 'object') {
        const vals = Object.values(externalCatalog);
        if (vals.length >= 8) return vals;
      }
      return DEFAULT_PLANETS;
    }

    /**
     * Randomizes the size distribution and planet-to-size assignment across the 8 solar system
     * planets at the start of every game run.
     * Guarantees all 5 size tiers (`MINI`, `SMALL`, `MEDIUM`, `LARGE`, `COLOSSAL`) are represented
     * and that every run produces a fresh permutation distinct from the previous run.
     */
    seedRunPlanets() {
      const catalog = this._getCatalogPlanets();
      let attempts = 0;
      let manifest = [];
      let signature = '';

      do {
        // Ensure all 5 tiers appear in the 8-planet manifest + 3 weighted random tiers
        const tierPool = SIZE_TIER_ORDER.slice();
        while (tierPool.length < catalog.length) {
          const r = Math.random();
          let acc = 0;
          let picked = 'MEDIUM';
          for (const tierKey of SIZE_TIER_ORDER) {
            acc += SIZE_TIERS[tierKey].weight;
            if (r <= acc) {
              picked = tierKey;
              break;
            }
          }
          tierPool.push(picked);
        }

        const shuffledTiers = shuffleArray(tierPool);
        const shuffledOrder = shuffleArray(catalog.map((_, idx) => idx));

        manifest = catalog.map((planet, index) => {
          const tierKey = shuffledTiers[index] || 'MEDIUM';
          const tier = SIZE_TIERS[tierKey];
          const radius = randomInt(tier.minRadius, tier.maxRadius);
          const points = computePlanetClearancePoints(tierKey, radius);

          return {
            id: planet.id || planet.name.toLowerCase(),
            planetId: planet.id || planet.name.toLowerCase(),
            name: planet.name,
            tagline: planet.tagline || '',
            baseColor: planet.baseColor || '#90caf9',
            accentColor: planet.accentColor || '#ffffff',
            hasRings: Boolean(planet.hasRings),
            imageUrl: planet.imageUrl || null,
            sizeTier: tier.id,
            tier: tier.id,
            tierLabel: tier.displayName,
            radius: radius,
            diameter: radius * 2,
            minRadius: tier.minRadius,
            maxRadius: tier.maxRadius,
            tierBasePoints: tier.basePoints,
            basePoints: points,
            points: points,
            multiplier: tier.multiplier,
            color: tier.color,
            badgeColor: tier.badgeColor,
            launchWindowWidth: tier.launchWindowWidth,
            timingHint: tier.timingHint,
            spawnOrder: shuffledOrder.indexOf(index)
          };
        });

        signature = manifest.map((m) => `${m.id}:${m.sizeTier}:${m.radius}`).join('|');
        attempts++;
      } while (signature === this.lastManifestSignature && attempts < 8);

      this.lastManifestSignature = signature;
      this.runId += 1;
      this.runPlanetManifest = manifest;

      // Build shuffled spawn queue so all 8 planets appear in randomized sequence
      this.planetQueue = shuffleArray(manifest);
      this.nextPlanetPreview = this.planetQueue[0] || manifest[0];

      if (typeof this.onManifestUpdate === 'function') {
        try {
          this.onManifestUpdate(this.getRunPlanetManifest());
        } catch (_e) {}
      }
      this._syncExternalHUD();
      return this.getRunPlanetManifest();
    }

    /**
     * Alias for `seedRunPlanets()` for UI button (`R` key) re-rolling.
     */
    rerollPlanets() {
      const manifest = this.seedRunPlanets();
      if (this.status === 'READY') {
        this._resetWorldEntities(false);
      } else if (this.obstacles.length > 0) {
        // Update un-cleared far-off obstacles to reflect the new manifest
        for (const obs of this.obstacles) {
          if (!obs.cleared && obs.x > this.tony.x + 240) {
            const match = this.runPlanetManifest.find((m) => m.id === obs.planetId);
            if (match) {
              obs.sizeTier = match.sizeTier;
              obs.tierLabel = match.tierLabel;
              obs.radius = match.radius;
              obs.diameter = match.diameter;
              obs.collisionRadius = Math.round(match.radius * this.physics.collisionCoreRatio);
              obs.y = this._computePlanetCenterY(match.radius);
              obs.tierBasePoints = match.tierBasePoints;
              obs.basePoints = match.basePoints;
              obs.points = match.points;
              obs.multiplier = match.multiplier;
              obs.color = match.color;
              obs.launchWindowWidth = match.launchWindowWidth;
            }
          }
        }
      }
      return manifest;
    }

    getRunPlanetManifest() {
      return this.runPlanetManifest.map((entry) => Object.assign({}, entry));
    }

    getNextPlanet() {
      for (const obs of this.obstacles) {
        if (!obs.cleared && obs.x + obs.radius >= this.tony.x - 10) {
          return obs;
        }
      }
      return this.nextPlanetPreview || this.runPlanetManifest[0] || null;
    }

    _computePlanetCenterY(radius) {
      // Position planet so its lower arc skims the cosmic track and its upper crest rises cleanly
      return this.groundY - Math.round(radius * 0.84);
    }

    /**
     * Computes the Optimal Launch Window on the ground track ahead of a planet.
     * Because Tony ascends for `t_peak = |vy| / g` frames while the planet approaches at `this.speed`,
     * jumping when the planet center is `D_optimal = speed * t_peak` ahead puts Tony at peak apex
     * directly over the planet's center.
     */
    _computeLaunchWindow(obstacle) {
      const effectiveVy = Math.abs(this.physics.jumpVelocityTap);
      const tPeakFrames = effectiveVy / this.physics.gravity; // ~26.2 frames
      const optimalLeadDistance = this.speed * tPeakFrames;
      const halfWindow = (obstacle.launchWindowWidth || 150) * 0.5;

      const optimalTakeoffX = obstacle.x - optimalLeadDistance;
      const startX = optimalTakeoffX - halfWindow;
      const endX = optimalTakeoffX + halfWindow;
      const tonyFootX = this.tony.x;
      const inside = tonyFootX >= startX && tonyFootX <= endX;

      const distFromOptimal = Math.abs(tonyFootX - optimalTakeoffX);
      let quality = 'OUTSIDE';
      if (distFromOptimal <= halfWindow * 0.55) {
        quality = 'PERFECT';
      } else if (inside) {
        quality = 'GOOD';
      } else if (tonyFootX < startX) {
        quality = 'EARLY';
      } else {
        quality = 'LATE';
      }

      return {
        optimalX: optimalTakeoffX,
        startX: startX,
        endX: endX,
        width: halfWindow * 2,
        optimalLeadDistance: optimalLeadDistance,
        active: inside,
        quality: quality
      };
    }

    _resetWorldEntities(spawnInitialObstacles = true) {
      this.tony = this._createInitialTonyState();
      this.player = this.tony;
      this.obstacles.length = 0;
      this.popups.length = 0;
      this.particles.length = 0;

      if (spawnInitialObstacles) {
        // Spawn initial planets well ahead so Tony can land from any start-jump cleanly
        const firstX = Math.max(660, Math.round(this.width * 0.72));
        const first = this.spawnPlanet({ x: firstX });
        const secondGap = 480 + first.radius * 2 + randomInt(60, 120);
        this.spawnPlanet({ x: firstX + secondGap });
      } else {
        // In READY preview mode, place one showcase planet cleanly on the right side
        const previewX = Math.round(this.width * 0.76);
        this.spawnPlanet({ x: previewX });
      }
    }

    _pullNextPlanetTemplate(overrides = {}) {
      if (overrides.planetId || overrides.id || overrides.name) {
        const targetKey = String(overrides.planetId || overrides.id || overrides.name).toLowerCase();
        const found = this.runPlanetManifest.find(
          (p) => p.id.toLowerCase() === targetKey || p.name.toLowerCase() === targetKey
        );
        if (found) return Object.assign({}, found);
      }

      if (!this.planetQueue || this.planetQueue.length === 0) {
        this.planetQueue = shuffleArray(this.runPlanetManifest);
      }
      const next = this.planetQueue.shift();
      if (this.planetQueue.length === 0) {
        this.planetQueue = shuffleArray(this.runPlanetManifest);
      }
      this.nextPlanetPreview = this.planetQueue[0] || this.runPlanetManifest[0];
      return Object.assign({}, next || this.runPlanetManifest[0]);
    }

    /**
     * Spawns a planet obstacle onto the track.
     * Supports optional overrides `{ planetId, sizeTier, radius, x }` for deterministic tests.
     */
    spawnPlanet(overrides = {}) {
      const template = this._pullNextPlanetTemplate(overrides);

      let tierKey = overrides.sizeTier || template.sizeTier || 'MEDIUM';
      if (!SIZE_TIERS[tierKey]) tierKey = 'MEDIUM';
      const tier = SIZE_TIERS[tierKey];

      const radius =
        typeof overrides.radius === 'number'
          ? clamp(overrides.radius, 14, 80)
          : overrides.sizeTier && overrides.sizeTier !== template.sizeTier
          ? randomInt(tier.minRadius, tier.maxRadius)
          : template.radius;

      const points = computePlanetClearancePoints(tierKey, radius);

      let spawnX = overrides.x;
      if (typeof spawnX !== 'number') {
        const lastObs = this.obstacles[this.obstacles.length - 1];
        const minTrackGap =
          450 +
          (lastObs ? lastObs.radius : 30) +
          radius * 1.6 +
          (tierKey === 'COLOSSAL' ? 75 : tierKey === 'LARGE' ? 45 : 0);
        const baseRight = lastObs ? lastObs.x + minTrackGap + randomInt(40, 130) : this.width + 120;
        spawnX = Math.max(this.width + radius + 40, baseRight);
      }

      const centerY = this._computePlanetCenterY(radius);
      const collisionRadius = Math.round(radius * this.physics.collisionCoreRatio);

      const obstacle = {
        uid: `planet_${this.runId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        id: template.id,
        planetId: template.id,
        name: template.name,
        tagline: template.tagline,
        baseColor: template.baseColor,
        accentColor: template.accentColor,
        hasRings: Boolean(template.hasRings),
        imageUrl: template.imageUrl || null,
        sizeTier: tier.id,
        tier: tier.id,
        tierLabel: tier.displayName,
        radius: radius,
        diameter: radius * 2,
        collisionRadius: collisionRadius,
        x: spawnX,
        y: centerY,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (tierKey === 'COLOSSAL' ? 0.008 : 0.014) * (Math.random() > 0.2 ? -1 : 1),
        tierBasePoints: tier.basePoints,
        basePoints: points,
        points: points,
        multiplier: tier.multiplier,
        color: tier.color,
        badgeColor: tier.badgeColor,
        launchWindowWidth: tier.launchWindowWidth,
        timingHint: tier.timingHint,
        cleared: false,
        closeCall: false,
        launchedInOptimalWindow: false,
        takeoffQuality: 'STANDARD',
        minSurfaceClearancePx: Infinity,
        launchWindow: null
      };

      obstacle.launchWindow = this._computeLaunchWindow(obstacle);
      this.obstacles.push(obstacle);
      return obstacle;
    }

    /**
     * Starts a fresh game run, randomizing planet sizes for the run and resetting scores.
     */
    startNewRun(options = {}) {
      const shouldReroll = options.reroll !== false;
      if (shouldReroll || this.runPlanetManifest.length === 0) {
        this.seedRunPlanets();
      }

      this.score = 0;
      this.distanceScore = 0;
      this.bonusScore = 0;
      this.distanceAccumulator = 0;
      this.planetsCleared = 0;
      this.clearedPlanetsHistory = [];
      this.biggestPlanetCleared = null;
      this.streak = 0;
      this.maxStreak = 0;
      this.streakMultiplier = 1.0;

      this.speed = this.physics.baseSpeed;
      this.mach = 1.0;
      this.elapsedRunMs = 0;
      this.lastStartTimestamp = performance.now ? performance.now() : Date.now();

      this._setStatus('PLAYING');
      this._resetWorldEntities(true);

      if (options.jumpOnStart) {
        this.jump({ fromStartScreen: true });
      }

      if (typeof this.onRunStart === 'function') {
        try {
          this.onRunStart(this.getState());
        } catch (_e) {}
      }
      this._syncExternalHUD();
      return this.getState();
    }

    restart(options = {}) {
      return this.startNewRun(options);
    }

    pause() {
      if (this.status === 'PLAYING') {
        this._setStatus('PAUSED');
      }
      return this.status;
    }

    resume() {
      if (this.status === 'PAUSED') {
        this._setStatus('PLAYING');
        this._lastFrameTime = performance.now ? performance.now() : Date.now();
      }
      return this.status;
    }

    togglePause() {
      if (this.status === 'PLAYING') return this.pause();
      if (this.status === 'PAUSED') return this.resume();
      return this.status;
    }

    toggleHitboxes(forceValue) {
      this.debugHitboxes =
        typeof forceValue === 'boolean' ? forceValue : !this.debugHitboxes;
      return this.debugHitboxes;
    }

    toggleMute(forceValue) {
      this.muted = typeof forceValue === 'boolean' ? forceValue : !this.muted;
      if (root && root.TONY_ASSETS && root.TONY_ASSETS.TONY_AUDIO) {
        const audio = root.TONY_ASSETS.TONY_AUDIO;
        if (typeof audio.setMuted === 'function') {
          audio.setMuted(this.muted);
        } else {
          audio.muted = this.muted;
        }
      }
      return this.muted;
    }

    _setStatus(newStatus) {
      this.status = newStatus;
      this.mode = newStatus;
      this.isReady = newStatus === 'READY';
      this.isPlaying = newStatus === 'PLAYING';
      this.isRunning = newStatus === 'PLAYING';
      this.isPaused = newStatus === 'PAUSED';
      this.isGameOver = newStatus === 'GAMEOVER';

      if (typeof this.onStateChange === 'function') {
        try {
          this.onStateChange(newStatus, this.getState());
        } catch (_e) {}
      }
    }

    /**
     * Triggers Tony's jump (`vy < 0`).
     * - If called from `READY` state, starts a new run AND immediately launches Tony into a jump.
     * - If called shortly after a start-jump (< 260ms), refreshes upward jump velocity so sequential
     *   start + jump key presses in automated tests always observe `vy < 0`.
     * - Evaluates the approaching planet's Launch Window to grant precision apex boost when timed well.
     */
    jump(options = {}) {
      const now = performance.now ? performance.now() : Date.now();

      if (this.status === 'READY') {
        this.startNewRun({ jumpOnStart: true, reroll: false });
        return true;
      }

      if (this.status === 'GAMEOVER') {
        if (options.allowRestartOnGameOver) {
          this.startNewRun({ jumpOnStart: true });
          return true;
        }
        return false;
      }

      if (this.status === 'PAUSED') {
        return false;
      }

      const tony = this.tony;
      const canCoyoteJump =
        !tony.onGround &&
        now - tony.lastGroundedAt <= this.physics.coyoteTimeMs &&
        tony.vy >= -2;
      const isFreshStartRefresh =
        !tony.onGround &&
        now - this.lastStartTimestamp <= 280 &&
        tony.y >= this.groundY - 95;

      if (!tony.onGround && !canCoyoteJump && !isFreshStartRefresh && !options.force) {
        // Buffer the jump if Tony is about to land
        this.input.jumpBufferUntil = now + this.physics.jumpBufferMs;
        return false;
      }

      // Check if an approaching planet has an active Optimal Launch Window
      const nextObs = this.getNextPlanet();
      let inOptimalWindow = false;
      let launchQuality = 'STANDARD';

      if (nextObs && nextObs.x > tony.x) {
        const lw = this._computeLaunchWindow(nextObs);
        nextObs.launchWindow = lw;
        if (lw.active) {
          inOptimalWindow = true;
          launchQuality = lw.quality === 'PERFECT' ? 'PERFECT' : 'OPTIMAL';
          nextObs.launchedInOptimalWindow = true;
          nextObs.takeoffQuality = launchQuality;
        } else {
          nextObs.takeoffQuality = lw.quality;
        }
      }

      tony.onGround = false;
      tony.isGrounded = false;
      tony.isJumping = true;
      tony.holdingJump = true;
      tony.holdElapsedMs = 0;
      tony.launchQuality = launchQuality;

      // Precision takeoff in the launch window or for giant planets gives full apex velocity
      const baseVy = inOptimalWindow
        ? this.physics.jumpVelocityPrecision
        : this.physics.jumpVelocityTap;
      tony.vy = baseVy;

      // Squash & stretch launch impulse
      tony.squashX = 0.84;
      tony.squashY = 1.18;
      tony.scaleX = 0.84;
      tony.scaleY = 1.18;
      tony.eyeState =
        nextObs && (nextObs.sizeTier === 'LARGE' || nextObs.sizeTier === 'COLOSSAL')
          ? 'wide'
          : 'determined';

      // Spawn dust puff particles at takeoff hooves
      this._spawnDustParticles(tony.x - 8, this.groundY, inOptimalWindow ? 10 : 6, inOptimalWindow);

      if (inOptimalWindow && nextObs && (nextObs.sizeTier === 'LARGE' || nextObs.sizeTier === 'COLOSSAL')) {
        this._spawnPopup({
          text: launchQuality === 'PERFECT' ? 'PERFECT TAKEOFF!' : 'OPTIMAL LAUNCH!',
          x: tony.x + 20,
          y: tony.y - 54,
          color: '#00e676',
          sizeTier: nextObs.sizeTier,
          durationMs: 750
        });
      }

      this._playSound('playJump', inOptimalWindow ? 1.0 : 0.65);
      return true;
    }

    releaseJump() {
      this.input.spaceDown = false;
      if (this.tony) {
        this.tony.holdingJump = false;
      }
    }

    /**
     * Pure + deterministic score calculator for clearing a planet.
     * Ensures `COLOSSAL > LARGE > MEDIUM > SMALL > MINI` strictly.
     */
    calculateClearanceScore(obstacleOrTier, options = {}) {
      let sizeTierId = 'MEDIUM';
      let radius = 40;
      let launchedInOptimalWindow = Boolean(options.launchedInOptimalWindow);
      let minSurfaceClearancePx =
        typeof options.minSurfaceClearancePx === 'number' ? options.minSurfaceClearancePx : 25;

      if (typeof obstacleOrTier === 'string') {
        sizeTierId = obstacleOrTier.toUpperCase();
        const t = SIZE_TIERS[sizeTierId] || SIZE_TIERS.MEDIUM;
        radius = typeof options.radius === 'number' ? options.radius : Math.round((t.minRadius + t.maxRadius) / 2);
      } else if (obstacleOrTier && typeof obstacleOrTier === 'object') {
        sizeTierId = obstacleOrTier.sizeTier || obstacleOrTier.tier || 'MEDIUM';
        radius = obstacleOrTier.radius || 40;
        if (obstacleOrTier.launchedInOptimalWindow) launchedInOptimalWindow = true;
        if (typeof obstacleOrTier.minSurfaceClearancePx === 'number') {
          minSurfaceClearancePx = obstacleOrTier.minSurfaceClearancePx;
        }
      }

      const tier = SIZE_TIERS[sizeTierId] || SIZE_TIERS.MEDIUM;
      const basePoints = computePlanetClearancePoints(tier.id, radius);
      const isGiant = tier.id === 'LARGE' || tier.id === 'COLOSSAL';
      const isCloseCall = isGiant && minSurfaceClearancePx >= 0 && minSurfaceClearancePx <= 12;
      const closeCallBonus = isCloseCall ? 250 : 0;
      const precisionBonus = launchedInOptimalWindow ? Math.round(tier.basePoints * 0.1) : 0;

      const streakCount = typeof options.streak === 'number' ? options.streak : this.streak;
      const streakMult = Number((1 + Math.min(Math.max(0, streakCount) * 0.1, 0.5)).toFixed(2));

      const rawTotal = basePoints + precisionBonus + closeCallBonus;
      const totalPoints = Math.round(rawTotal * streakMult);

      return {
        sizeTier: tier.id,
        radius: radius,
        tierBasePoints: tier.basePoints,
        basePoints: basePoints,
        precisionBonus: precisionBonus,
        closeCall: isCloseCall,
        closeCallBonus: closeCallBonus,
        streakMultiplier: streakMult,
        totalPoints: totalPoints
      };
    }

    _handlePlanetCleared(obstacle) {
      if (obstacle.cleared) return null;
      obstacle.cleared = true;

      const calc = this.calculateClearanceScore(obstacle, {
        streak: this.streak
      });

      this.planetsCleared += 1;
      this.streak += 1;
      if (this.streak > this.maxStreak) {
        this.maxStreak = this.streak;
      }
      this.streakMultiplier = calc.streakMultiplier;

      this.bonusScore += calc.totalPoints;
      this.score = this.distanceScore + this.bonusScore;

      const prevHigh = this.highScore;
      if (this.score > this.highScore) {
        this.highScore = this.score;
        if (prevHigh > 0 && this.planetsCleared === 1) {
          this._playSound('playNewHighScore');
        }
      }

      const clearedRecord = {
        id: obstacle.planetId,
        name: obstacle.name,
        sizeTier: obstacle.sizeTier,
        tierLabel: obstacle.tierLabel,
        radius: obstacle.radius,
        diameter: obstacle.diameter,
        basePoints: calc.basePoints,
        points: calc.totalPoints,
        closeCall: calc.closeCall,
        closeCallBonus: calc.closeCallBonus,
        takeoffQuality: obstacle.takeoffQuality
      };

      this.clearedPlanetsHistory.push(clearedRecord);

      if (
        !this.biggestPlanetCleared ||
        obstacle.radius > this.biggestPlanetCleared.radius ||
        (obstacle.radius === this.biggestPlanetCleared.radius &&
          calc.totalPoints > this.biggestPlanetCleared.points)
      ) {
        this.biggestPlanetCleared = Object.assign({}, clearedRecord);
      }

      // Primary clearance popup (`+600 JUPITER (LARGE)!`)
      const headline = `+${calc.totalPoints} ${obstacle.name.toUpperCase()} (${obstacle.sizeTier})!`;
      let subtext = '';
      if (calc.closeCall) {
        subtext = 'CLOSE CALL! +250';
      } else if (obstacle.launchedInOptimalWindow) {
        subtext = 'PERFECT TIMING!';
      } else if (this.streak >= 3) {
        subtext = `${this.streak}x STREAK (${calc.streakMultiplier}x)!`;
      }

      this._spawnPopup({
        text: headline,
        subtext: subtext,
        x: clamp(obstacle.x, 120, this.width - 160),
        y: Math.min(obstacle.y - obstacle.radius - 14, this.tony.y - 36),
        color: obstacle.color || '#ffd740',
        sizeTier: obstacle.sizeTier,
        points: calc.totalPoints,
        durationMs: 1350
      });

      this._playSound('playClearPlanet', obstacle.sizeTier, calc.totalPoints);
      if (calc.closeCall) {
        this._playSound('playCloseCall');
      }

      if (typeof this.onPlanetCleared === 'function') {
        try {
          this.onPlanetCleared(clearedRecord, this.getState());
        } catch (_e) {}
      }
      if (typeof this.onScoreChange === 'function') {
        try {
          this.onScoreChange(this.score, this.getState());
        } catch (_e) {}
      }
      this._syncExternalHUD();
      return clearedRecord;
    }

    /**
     * Forgiving `circle-vs-capsule` collision detection between Tony's body capsule
     * and the planet's 82% inner core collision circle.
     */
    _checkCollisionAndProximity(obstacle) {
      const tony = this.tony;
      // Tony's horizontal capsule segment [ax, ay] -> [bx, by] with radius rTony
      const rTony = tony.capsuleRadius || 18;
      const centerY = tony.y - 22;
      const ax = tony.x - 10;
      const ay = centerY;
      const bx = tony.x + 12;
      const by = centerY - 2;

      const px = obstacle.x;
      const py = obstacle.y;

      const abx = bx - ax;
      const aby = by - ay;
      const apx = px - ax;
      const apy = py - ay;
      const abLenSq = abx * abx + aby * aby || 1;
      const t = clamp((apx * abx + apy * aby) / abLenSq, 0, 1);

      const closestX = ax + t * abx;
      const closestY = ay + t * aby;

      const dx = px - closestX;
      const dy = py - closestY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const planetCoreR = obstacle.collisionRadius || Math.round(obstacle.radius * this.physics.collisionCoreRatio);
      const surfaceClearance = dist - (planetCoreR + rTony);

      // Track closest skim distance when Tony is horizontally over the planet
      if (Math.abs(px - tony.x) <= obstacle.radius + 20) {
        if (surfaceClearance < obstacle.minSurfaceClearancePx) {
          obstacle.minSurfaceClearancePx = surfaceClearance;
        }
      }

      return {
        collided: surfaceClearance < 0,
        surfaceClearancePx: surfaceClearance,
        closestX: closestX,
        closestY: closestY,
        planetCoreRadius: planetCoreR,
        tonyCapsuleRadius: rTony
      };
    }

    triggerGameOver(reason = 'COLLISION', crashedPlanet = null) {
      if (this.status === 'GAMEOVER') return this.getState();

      this._setStatus('GAMEOVER');
      this.tony.isDead = true;
      this.tony.isCrashed = true;
      this.tony.eyeState = 'dizzy';
      this.tony.holdingJump = false;
      this.streak = 0;

      if (this.score > this.highScore) {
        this.highScore = this.score;
      }

      this._spawnDustParticles(this.tony.x + 10, this.tony.y - 20, 18, false, '#ff5252');
      this._playSound('playCrash');

      const summary = this.getRunSummary(reason, crashedPlanet);

      if (typeof this.onGameOver === 'function') {
        try {
          this.onGameOver(summary);
        } catch (_e) {}
      }

      // Notify TonyArcadeUI if present
      if (root && root.TonyArcadeUI) {
        const ui = root.TonyArcadeUI;
        try {
          if (typeof ui.handleGameOver === 'function') {
            ui.handleGameOver(summary);
          } else if (typeof ui.onGameOver === 'function') {
            ui.onGameOver(summary);
          } else if (typeof ui.showGameOverModal === 'function') {
            ui.showGameOverModal(summary);
          }
        } catch (_e) {}
      }

      this._syncExternalHUD();
      return summary;
    }

    getRunSummary(reason = 'COLLISION', crashedPlanet = null) {
      const biggest = this.biggestPlanetCleared;
      return {
        runId: this.runId,
        reason: reason,
        score: this.score,
        distanceScore: this.distanceScore,
        bonusScore: this.bonusScore,
        highScore: this.highScore,
        planetsCleared: this.planetsCleared,
        maxStreak: this.maxStreak,
        biggestPlanet: biggest
          ? `${biggest.name} (${biggest.sizeTier} ${biggest.diameter}px)`
          : 'None',
        biggestPlanetObj: biggest ? Object.assign({}, biggest) : null,
        crashedInto: crashedPlanet
          ? `${crashedPlanet.name} (${crashedPlanet.sizeTier})`
          : null,
        runPlanetManifest: this.getRunPlanetManifest(),
        date: new Date().toISOString().slice(0, 10)
      };
    }

    /**
     * Advances simulation by `dtMs` milliseconds (default 16.667ms = 1 frame at 60fps).
     */
    step(dtMs = 16.667) {
      const clampedDt = clamp(dtMs, 1, 50);
      const dtFrames = clampedDt / 16.667;
      this.frameCount += 1;

      // Always animate starfield & popups subtly
      this._updateStarfield(dtFrames);
      this._updatePopups(clampedDt, dtFrames);
      this._updateParticles(dtFrames);

      if (this.status === 'READY') {
        // Gentle idle trot animation on the starting line
        this.scrollOffset += 1.2 * dtFrames;
        this.tony.runCycle += 0.12 * dtFrames;
        this.tony.animTime = this.tony.runCycle;
        this.tony.legPhase = this.tony.runCycle;
        this.tony.animFrame = Math.floor(this.tony.runCycle) % 4;
        this.tony.scarfWave += 0.15 * dtFrames;
        for (const obs of this.obstacles) {
          obs.rotation += obs.rotationSpeed * dtFrames;
          obs.launchWindow = this._computeLaunchWindow(obs);
        }
        return this.getState();
      }

      if (this.status !== 'PLAYING') {
        return this.getState();
      }

      this.elapsedRunMs += clampedDt;
      this.scrollOffset += this.speed * dtFrames;
      const now = performance.now ? performance.now() : Date.now();

      // Gradual speed progression
      const elapsedSec = this.elapsedRunMs / 1000;
      this.speed = clamp(
        this.physics.baseSpeed + elapsedSec * this.physics.speedRampPerSecond,
        this.physics.baseSpeed,
        this.physics.maxSpeed
      );
      this.mach = Number((this.speed / this.physics.baseSpeed).toFixed(2));

      // Continuous survival distance score (+1 per frame tick scaled)
      this.distanceAccumulator += (this.speed / this.physics.baseSpeed) * dtFrames * 0.45;
      if (this.distanceAccumulator >= 1) {
        const gained = Math.floor(this.distanceAccumulator);
        this.distanceAccumulator -= gained;
        this.distanceScore += gained;
        this.score = this.distanceScore + this.bonusScore;
        if (this.score > this.highScore) {
          this.highScore = this.score;
        }
      }

      // Update Tony physics
      const tony = this.tony;
      tony.scarfWave += 0.24 * this.mach * dtFrames;

      if (!tony.onGround) {
        // Variable jump hold boost up to 160ms
        if (
          (tony.holdingJump || this.input.spaceDown) &&
          tony.holdElapsedMs < this.physics.maxHoldDurationMs &&
          tony.vy < 0
        ) {
          tony.vy += this.physics.holdBoostPerFrame * dtFrames;
          tony.holdElapsedMs += clampedDt;
          tony.chargeRatio = clamp(tony.holdElapsedMs / this.physics.maxHoldDurationMs, 0, 1);
        }

        tony.vy += this.physics.gravity * dtFrames;
        tony.y += tony.vy * dtFrames;
        tony.altitude = Math.max(0, Math.round(this.groundY - tony.y));

        // Subtle mid-air pitch rotation
        tony.rotation = clamp(tony.vy * 0.018, -0.22, 0.20);

        if (tony.y >= this.groundY) {
          tony.y = this.groundY;
          tony.altitude = 0;
          tony.vy = 0;
          tony.onGround = true;
          tony.isGrounded = true;
          tony.isJumping = false;
          tony.holdingJump = false;
          tony.rotation = 0;
          tony.lastGroundedAt = now;
          // Landing squash
          tony.squashX = 1.16;
          tony.squashY = 0.85;
          tony.scaleX = 1.16;
          tony.scaleY = 0.85;
          this._spawnDustParticles(tony.x, this.groundY, 5, false);

          // Execute buffered jump if player pressed Space just before touchdown
          if (this.input.jumpBufferUntil > now) {
            this.input.jumpBufferUntil = 0;
            this.jump();
          }
        }
      } else {
        tony.lastGroundedAt = now;
        tony.altitude = 0;
        tony.runCycle += 0.26 * this.mach * dtFrames;
        tony.animTime = tony.runCycle;
        tony.legPhase = tony.runCycle;
        tony.animFrame = Math.floor(tony.runCycle) % 4;
      }

      // Relax squash & stretch back to 1.0
      tony.squashX += (1.0 - tony.squashX) * 0.22 * dtFrames;
      tony.squashY += (1.0 - tony.squashY) * 0.22 * dtFrames;
      tony.scaleX = tony.squashX;
      tony.scaleY = tony.squashY;

      // Update planets & check clearances / collisions
      let nearGiant = false;
      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const obs = this.obstacles[i];
        obs.x -= this.speed * dtFrames;
        obs.rotation += obs.rotationSpeed * dtFrames;
        obs.launchWindow = this._computeLaunchWindow(obs);

        if (
          !obs.cleared &&
          (obs.sizeTier === 'LARGE' || obs.sizeTier === 'COLOSSAL') &&
          obs.x - tony.x < 320 &&
          obs.x - tony.x > -60
        ) {
          nearGiant = true;
        }

        // Collision check
        const hitInfo = this._checkCollisionAndProximity(obs);
        if (hitInfo.collided) {
          this.triggerGameOver('COLLISION', obs);
          return this.getState();
        }

        // Check if Tony's trailing hoof cleared the planet
        const trailingHoofX = tony.x - tony.width * 0.26;
        if (!obs.cleared && obs.x + obs.collisionRadius < trailingHoofX) {
          this._handlePlanetCleared(obs);
        }

        // Remove off-screen obstacles
        if (obs.x + obs.radius < -120) {
          this.obstacles.splice(i, 1);
        }
      }

      tony.nearGiantPlanet = nearGiant;
      if (!tony.isDead) {
        tony.eyeState = nearGiant || !tony.onGround ? 'wide' : 'determined';
      }

      // Ensure at least 2 upcoming obstacles are always queued on the track
      while (this.obstacles.length < 3) {
        this.spawnPlanet();
      }

      if (this.frameCount % 3 === 0) {
        this._syncExternalHUD();
      }

      return this.getState();
    }

    /**
     * Convenience helper for deterministic multi-frame advancing in tests.
     */
    tick(frames = 1, dtMs = 16.667) {
      for (let i = 0; i < frames; i++) {
        this.step(dtMs);
      }
      this.render();
      return this.getState();
    }

    _updateStarfield(dtFrames) {
      const mult = this.status === 'PLAYING' ? this.speed * 0.35 : 0.6;
      for (const s of this.stars) {
        s.x -= s.speedFactor * mult * dtFrames;
        s.twinklePhase += 0.05 * dtFrames;
        if (s.x < -4) {
          s.x = this.width + 4;
          s.y = Math.random() * (this.groundY - 28);
        }
      }
    }

    _spawnPopup(cfg) {
      const popup = {
        text: cfg.text || '+100',
        subtext: cfg.subtext || '',
        x: cfg.x || this.tony.x,
        y: cfg.y || this.tony.y - 48,
        vy: -1.15,
        alpha: 1.0,
        color: cfg.color || '#ffd740',
        sizeTier: cfg.sizeTier || 'MEDIUM',
        points: cfg.points || 0,
        ageMs: 0,
        durationMs: cfg.durationMs || 1200
      };
      this.popups.push(popup);
      return popup;
    }

    _updatePopups(dtMs, dtFrames) {
      for (let i = this.popups.length - 1; i >= 0; i--) {
        const p = this.popups[i];
        p.ageMs += dtMs;
        p.y += p.vy * dtFrames;
        const progress = p.ageMs / p.durationMs;
        p.alpha = clamp(1 - Math.pow(progress, 1.8), 0, 1);
        if (p.ageMs >= p.durationMs) {
          this.popups.splice(i, 1);
        }
      }
    }

    _spawnDustParticles(x, y, count = 6, isOptimal = false, customColor = null) {
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: x + randomInt(-10, 10),
          y: y + randomInt(-4, 2),
          vx: -Math.random() * 3.2 - 0.8,
          vy: -Math.random() * 2.8 - 0.4,
          size: Math.random() * 3.5 + 2.0,
          alpha: 0.9,
          color: customColor || (isOptimal ? '#69f0ae' : '#cfd8dc')
        });
      }
    }

    _updateParticles(dtFrames) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.x += pt.vx * dtFrames;
        pt.y += pt.vy * dtFrames;
        pt.alpha -= 0.04 * dtFrames;
        if (pt.alpha <= 0) {
          this.particles.splice(i, 1);
        }
      }
    }

    /**
     * Renders the entire scene onto the HTML5 Canvas.
     */
    render() {
      const ctx = this.ctx;
      if (!ctx) return;

      ctx.save();
      ctx.clearRect(0, 0, this.width, this.height);

      // 1. Deep Cosmic Background & Parallax Starfield
      this._renderBackgroundAndStars(ctx);

      // 2. Cosmic Ground Track & Optimal Takeoff / Launch Windows
      this._renderCosmicTrack(ctx);
      this._renderLaunchWindows(ctx);

      // 3. Approaching Planets (using window.TONY_ASSETS if available, else procedural 3D sphere)
      for (const obs of this.obstacles) {
        this._renderPlanetObstacle(ctx, obs);
      }

      // 4. Takeoff/landing dust particles
      this._renderParticles(ctx);

      // 5. Tony the Sheep
      this._renderTony(ctx);

      // 6. Floating Score Popups
      this._renderPopups(ctx);

      // 7. In-Canvas HUD Banner & Next Planet Radar Pill
      this._renderCanvasOverlayHUD(ctx);

      // 8. Hitbox & Jump Trajectory Debug Overlay (`H` key)
      if (this.debugHitboxes) {
        this._renderDebugOverlay(ctx);
      }

      ctx.restore();
    }

    _renderBackgroundAndStars(ctx) {
      // Check if TONY_ASSETS provides a custom starfield renderer
      const assets = root && root.TONY_ASSETS;
      if (assets && typeof assets.drawStarfield === 'function') {
        try {
          const timeSec = (this.elapsedRunMs || this.frameCount * 16.667) * 0.001;
          assets.drawStarfield(ctx, this.width, this.height, this.scrollOffset || 0, timeSec);
          return;
        } catch (_e) {}
      }

      const grad = ctx.createLinearGradient(0, 0, 0, this.height);
      grad.addColorStop(0, '#070913');
      grad.addColorStop(0.58, '#101730');
      grad.addColorStop(1, '#182246');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.width, this.height);

      // Subtle cosmic nebula glow
      const nebula = ctx.createRadialGradient(
        this.width * 0.72,
        this.height * 0.28,
        15,
        this.width * 0.72,
        this.height * 0.28,
        280
      );
      nebula.addColorStop(0, 'rgba(100, 181, 246, 0.11)');
      nebula.addColorStop(0.5, 'rgba(186, 104, 200, 0.06)');
      nebula.addColorStop(1, 'rgba(10, 14, 29, 0)');
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, this.width, this.height);

      for (const s of this.stars) {
        const twinkle = 0.55 + 0.45 * Math.sin(s.twinklePhase);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = twinkle;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
    }

    _renderCosmicTrack(ctx) {
      const assets = root && root.TONY_ASSETS;
      if (assets && typeof assets.drawGroundTrack === 'function') {
        try {
          assets.drawGroundTrack(ctx, this.width, this.height, this.groundY, this.scrollOffset || 0);
          return;
        } catch (_e) {}
      }

      const y = this.groundY;

      // Sub-track horizon glow
      const trackGrad = ctx.createLinearGradient(0, y - 4, 0, this.height);
      trackGrad.addColorStop(0, '#1e2c59');
      trackGrad.addColorStop(0.18, '#121936');
      trackGrad.addColorStop(1, '#090c1c');
      ctx.fillStyle = trackGrad;
      ctx.fillRect(0, y, this.width, this.height - y);

      // Primary glowing cyan rail
      ctx.strokeStyle = '#4dd0e1';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();

      // Scrolling perspective grid ticks along the cosmic runway
      const scrollOffset = ((this.distanceScore * 4) + (this.frameCount * this.speed * 0.5)) % 48;
      ctx.strokeStyle = 'rgba(77, 208, 225, 0.26)';
      ctx.lineWidth = 1.5;
      for (let gx = -scrollOffset; gx < this.width + 48; gx += 48) {
        ctx.beginPath();
        ctx.moveTo(gx, y + 2);
        ctx.lineTo(gx - 18, this.height);
        ctx.stroke();
      }
    }

    /**
     * Draws the visual "Launch Window / Optimal Takeoff Indicator" on the ground track
     * ahead of approaching planets (especially prominent for LARGE & COLOSSAL planets).
     */
    _renderLaunchWindows(ctx) {
      for (const obs of this.obstacles) {
        if (obs.cleared || obs.x + obs.radius < this.tony.x) continue;

        const lw = obs.launchWindow || this._computeLaunchWindow(obs);
        if (lw.endX < 20 || lw.startX > this.width - 20) continue;

        const isGiant = obs.sizeTier === 'LARGE' || obs.sizeTier === 'COLOSSAL';
        const isMedium = obs.sizeTier === 'MEDIUM';
        if (!isGiant && !isMedium && !this.debugHitboxes) continue;

        const y = this.groundY;
        const padX = Math.max(0, lw.startX);
        const padW = Math.min(this.width, lw.endX) - padX;
        if (padW <= 4) continue;

        ctx.save();
        const activeColor = lw.active ? '#00e676' : obs.color || '#ffb74d';
        ctx.fillStyle = lw.active
          ? 'rgba(0, 230, 118, 0.32)'
          : isGiant
          ? 'rgba(255, 171, 64, 0.22)'
          : 'rgba(255, 215, 64, 0.14)';
        ctx.fillRect(padX, y - 4, padW, 8);

        // Optimal center chevron on track
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = lw.active ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.moveTo(lw.optimalX, y - 8);
        ctx.lineTo(lw.optimalX, y + 8);
        ctx.stroke();

        // Connect dashed guide line from launch pad to giant planet base
        if (isGiant) {
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = lw.active ? 'rgba(0, 230, 118, 0.5)' : 'rgba(255, 171, 64, 0.35)';
          ctx.beginPath();
          ctx.moveTo(lw.optimalX, y);
          ctx.lineTo(obs.x - obs.radius * 0.6, y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.font = '700 10px "JetBrains Mono", "Inter", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = activeColor;
          const labelText = lw.active ? '▲ JUMP NOW! ▲' : 'TAKEOFF ZONE';
          ctx.fillText(labelText, lw.optimalX, y + 20);
        }
        ctx.restore();
      }
    }

    _renderPlanetObstacle(ctx, obs) {
      ctx.save();

      // Delegate to window.TONY_ASSETS planet renderer if available
      let renderedByAssets = false;
      const assets = root && root.TONY_ASSETS;
      if (assets) {
        try {
          const catalog = assets.PLANET_CATALOG;
          let entry = null;
          if (Array.isArray(catalog)) {
            entry = catalog.find(
              (p) =>
                (p.id && p.id.toLowerCase() === obs.planetId) ||
                (p.name && p.name.toLowerCase() === obs.name.toLowerCase())
            );
          } else if (catalog && typeof catalog === 'object') {
            entry = catalog[obs.planetId] || catalog[obs.name.toLowerCase()];
          }

          if (entry && typeof entry.renderSprite === 'function') {
            entry.renderSprite(ctx, obs.x, obs.y, obs.radius, obs.rotation);
            renderedByAssets = true;
          } else if (typeof assets.renderPlanet === 'function') {
            assets.renderPlanet(ctx, obs.planetId, obs.x, obs.y, obs.radius, obs.rotation);
            renderedByAssets = true;
          }
        } catch (_e) {
          renderedByAssets = false;
        }
      }

      if (!renderedByAssets) {
        this._renderFallbackPlanet(ctx, obs);
      }

      // Draw crisp planet label & size tier badge beneath or above planet
      const badgeY = this.groundY + 34;
      ctx.font = '700 11px "Space Grotesk", "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e8eaed';
      ctx.fillText(`${obs.name.toUpperCase()} · ${obs.sizeTier}`, obs.x, badgeY);

      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillStyle = obs.color || '#ffd740';
      ctx.fillText(`+${obs.basePoints} PTS (${obs.diameter}px)`, obs.x, badgeY + 13);

      ctx.restore();
    }

    _renderFallbackPlanet(ctx, obs) {
      const { x, y, radius, baseColor, accentColor, hasRings, rotation, planetId } = obs;

      // Outer atmospheric glow
      const glow = ctx.createRadialGradient(x, y, radius * 0.75, x, y, radius * 1.32);
      glow.addColorStop(0, baseColor);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Back half of rings if Saturn/Uranus
      if (hasRings) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(planetId === 'uranus' ? 1.15 : -0.32);
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = Math.max(3, radius * 0.16);
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 1.75, radius * 0.42, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Clipped 3D planet sphere
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.clip();

      const sphereGrad = ctx.createRadialGradient(
        x - radius * 0.35,
        y - radius * 0.35,
        radius * 0.1,
        x,
        y,
        radius * 1.08
      );
      sphereGrad.addColorStop(0, accentColor);
      sphereGrad.addColorStop(0.55, baseColor);
      sphereGrad.addColorStop(1, '#090d1e');
      ctx.fillStyle = sphereGrad;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

      // Banded details / craters rotated
      ctx.translate(x, y);
      ctx.rotate(rotation * 0.3);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
      for (let b = -radius * 0.6; b <= radius * 0.6; b += radius * 0.4) {
        ctx.fillRect(-radius, b, radius * 2, radius * 0.14);
      }
      ctx.restore();

      // Front half of rings
      if (hasRings) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(planetId === 'uranus' ? 1.15 : -0.32);
        ctx.strokeStyle = accentColor;
        ctx.lineWidth = Math.max(3, radius * 0.16);
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 1.75, radius * 0.42, 0, 0, Math.PI);
        ctx.stroke();
        ctx.restore();
      }
    }

    _renderTony(ctx) {
      const assets = root && root.TONY_ASSETS;
      if (assets && typeof assets.drawTony === 'function') {
        try {
          assets.drawTony(ctx, this.tony);
          return;
        } catch (_e) {}
      }

      // Built-in expressive fallback renderer for Tony the Sheep
      const t = this.tony;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rotation || 0);
      ctx.scale(t.squashX || 1, t.squashY || 1);

      // Cosmic scarf trailing behind Tony
      const wave = Math.sin(t.scarfWave || 0) * 4;
      ctx.fillStyle = '#ff5252';
      ctx.beginPath();
      ctx.moveTo(-14, -22);
      ctx.quadraticCurveTo(-28, -24 + wave, -38, -17 + wave);
      ctx.lineTo(-34, -11 + wave);
      ctx.quadraticCurveTo(-24, -17 + wave, -12, -16);
      ctx.closePath();
      ctx.fill();

      // 4 galloping black sheep legs
      const phase = t.onGround ? t.legPhase : 0.6;
      const legOffsets = [-12, -5, 5, 12];
      ctx.strokeStyle = '#1c2230';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const swing = t.onGround ? Math.sin(phase + i * 1.5) * 7 : (i < 2 ? -5 : 5);
        ctx.beginPath();
        ctx.moveTo(legOffsets[i], -14);
        ctx.lineTo(legOffsets[i] + swing, -2);
        ctx.stroke();
      }

      // Fluffy white wool body puffs
      ctx.fillStyle = '#f8f9fa';
      const puffs = [
        [-14, -24, 11],
        [-4, -28, 13],
        [7, -26, 12],
        [-8, -17, 11],
        [4, -17, 11],
        [-19, -20, 8]
      ];
      for (const [px, py, pr] of puffs) {
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }

      // Head & cute ear
      ctx.fillStyle = '#263238';
      ctx.beginPath();
      ctx.ellipse(17, -26, 10, 8.5, 0.15, 0, Math.PI * 2);
      ctx.fill();

      // Fluffy top wool tuft
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(14, -34, 6.5, 0, Math.PI * 2);
      ctx.fill();

      // Expressive eyes
      if (t.isDead || t.eyeState === 'dizzy') {
        ctx.strokeStyle = '#ffeb3b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(18, -30);
        ctx.lineTo(23, -25);
        ctx.moveTo(23, -30);
        ctx.lineTo(18, -25);
        ctx.stroke();
      } else {
        const eyeRadius = t.eyeState === 'wide' ? 3.4 : 2.6;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(20, -27, eyeRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0d1117';
        ctx.beginPath();
        ctx.arc(21, -27, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Floating "TONY" mini nameplate
      if (t.showNameplate) {
        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(128, 222, 234, 0.9)';
        ctx.fillText('TONY', 0, -45);
      }

      ctx.restore();
    }

    _renderParticles(ctx) {
      for (const pt of this.particles) {
        ctx.save();
        ctx.globalAlpha = clamp(pt.alpha, 0, 1);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    _renderPopups(ctx) {
      for (const p of this.popups) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.textAlign = 'center';

        ctx.font = '800 15px "Space Grotesk", "Inter", sans-serif';
        ctx.strokeStyle = 'rgba(7, 9, 19, 0.9)';
        ctx.lineWidth = 4;
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);

        if (p.subtext) {
          ctx.font = '700 11px "JetBrains Mono", monospace';
          ctx.strokeText(p.subtext, p.x, p.y + 15);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(p.subtext, p.x, p.y + 15);
        }
        ctx.restore();
      }
    }

    _renderCanvasOverlayHUD(ctx) {
      ctx.save();
      const nextObs = this.getNextPlanet();
      if (nextObs) {
        const pillX = 16;
        const pillY = 14;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.76)';
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(pillX, pillY, 278, 30, 8);
        } else {
          ctx.rect(pillX, pillY, 278, 30);
        }
        ctx.fill();

        ctx.font = '700 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#80deea';
        ctx.fillText('NEXT:', pillX + 10, pillY + 19);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(
          `${nextObs.name.toUpperCase()} [${nextObs.sizeTier} · ${nextObs.diameter}px]`,
          pillX + 52,
          pillY + 19
        );
      }

      if (this.status === 'READY') {
        ctx.fillStyle = 'rgba(7, 10, 22, 0.55)';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.textAlign = 'center';
        ctx.font = '800 26px "Space Grotesk", "Inter", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText("TONY'S JUMPING GAME", this.width * 0.5, this.height * 0.36);

        ctx.font = '600 14px "Inter", sans-serif';
        ctx.fillStyle = '#80deea';
        ctx.fillText(
          'PRESS SPACEBAR OR TAP TO LAUNCH TONY OVER THE SOLAR SYSTEM!',
          this.width * 0.5,
          this.height * 0.46
        );
      } else if (this.status === 'PAUSED') {
        ctx.fillStyle = 'rgba(7, 10, 22, 0.65)';
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.textAlign = 'center';
        ctx.font = '800 24px "Space Grotesk", monospace';
        ctx.fillStyle = '#ffd740';
        ctx.fillText('PAUSED — PRESS P OR SPACE TO RESUME', this.width * 0.5, this.height * 0.45);
      }
      ctx.restore();
    }

    /**
     * Draws the visual Hitbox & Parabolic Jump Trajectory Debug Overlay (`H` key).
     */
    _renderDebugOverlay(ctx) {
      ctx.save();
      const tony = this.tony;

      // 1. Tony's capsule collision circles
      ctx.strokeStyle = '#00e676';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(tony.x, tony.y - 22, tony.capsuleRadius || 18, 0, Math.PI * 2);
      ctx.stroke();

      // 2. Predicted parabolic jump arc from Tony's current position
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.75)';
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      let simX = tony.x;
      let simY = tony.onGround ? this.groundY : tony.y;
      let simVy = tony.onGround ? this.physics.jumpVelocityPrecision : tony.vy;
      ctx.moveTo(simX, simY);
      for (let f = 0; f < 62; f++) {
        simX += this.speed;
        simVy += this.physics.gravity;
        simY += simVy;
        if (simY > this.groundY) {
          simY = this.groundY;
          ctx.lineTo(simX, simY);
          break;
        }
        ctx.lineTo(simX, simY);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Planet visual radius vs 82% inner collision core radius
      for (const obs of this.obstacles) {
        // Outer visual radius
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
        ctx.stroke();

        // 82% inner core collision radius
        ctx.strokeStyle = '#ff1744';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.collisionRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillStyle = '#00e676';
      ctx.textAlign = 'right';
      ctx.fillText(
        `DEBUG [H] | VY:${tony.vy.toFixed(1)} | ALT:${tony.altitude}px | SPD:${this.speed.toFixed(1)}`,
        this.width - 16,
        28
      );
      ctx.restore();
    }

    _playSound(methodName, ...args) {
      if (this.muted) return;
      try {
        const audio =
          (root && root.TONY_ASSETS && root.TONY_ASSETS.TONY_AUDIO) ||
          (root && root.TONY_AUDIO);
        if (audio && typeof audio[methodName] === 'function') {
          audio[methodName](...args);
        }
      } catch (_e) {}
    }

    _syncExternalHUD() {
      if (root && root.TonyArcadeUI && typeof root.TonyArcadeUI.updateHUD === 'function') {
        try {
          root.TonyArcadeUI.updateHUD(this.getState());
        } catch (_e) {}
      }
    }

    startLoop() {
      if (this._rafId || typeof requestAnimationFrame === 'undefined') return;
      this._lastFrameTime = performance.now ? performance.now() : Date.now();
      const loop = (timestamp) => {
        const dt = timestamp - this._lastFrameTime;
        this._lastFrameTime = timestamp;
        this.step(dt > 0 ? dt : 16.667);
        this.render();
        this._rafId = requestAnimationFrame(loop);
      };
      this._rafId = requestAnimationFrame(loop);
    }

    stopLoop() {
      if (this._rafId && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
    }

    _isTypingInInput(event) {
      const target = event && event.target;
      if (!target) return false;
      const tag = (target.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
        return true;
      }
      // Also check if an arcade initials modal is actively capturing keys
      if (
        root &&
        root.TonyArcadeUI &&
        typeof root.TonyArcadeUI.isModalOpen === 'function' &&
        root.TonyArcadeUI.isModalOpen()
      ) {
        return true;
      }
      return false;
    }

    _handleKeyDown(event) {
      if (!this.input.bindKeyboard) return;
      if (this._isTypingInInput(event)) return;

      const code = event.code || '';
      const key = (event.key || '').toLowerCase();

      if (code === 'Space' || code === 'ArrowUp' || key === ' ' || key === 'arrowup') {
        event.preventDefault();
        if (!this.input.spaceDown) {
          this.input.spaceDown = true;
          this.input.spacePressedAt = performance.now ? performance.now() : Date.now();
          if (this.status === 'PAUSED') {
            this.resume();
          } else {
            this.jump({ allowRestartOnGameOver: false });
          }
        }
      } else if (key === 'h') {
        this.toggleHitboxes();
      } else if (key === 'p') {
        this.togglePause();
      } else if (key === 'r') {
        this.rerollPlanets();
      } else if (key === 'm') {
        this.toggleMute();
      }
    }

    _handleKeyUp(event) {
      const code = event.code || '';
      const key = (event.key || '').toLowerCase();
      if (code === 'Space' || code === 'ArrowUp' || key === ' ' || key === 'arrowup') {
        this.releaseJump();
      }
    }

    _handlePointerDown(event) {
      if (!this.input.bindPointer) return;
      if (event && event.button && event.button !== 0) return;
      this.input.spaceDown = true;
      this.input.spacePressedAt = performance.now ? performance.now() : Date.now();
      this.jump({ allowRestartOnGameOver: false });
    }

    _handlePointerUp() {
      this.releaseJump();
    }

    _attachListeners() {
      if (typeof window === 'undefined') return;
      window.addEventListener('keydown', this._boundKeyDown, { passive: false });
      window.addEventListener('keyup', this._boundKeyUp);
      if (this.canvas) {
        this.canvas.addEventListener('pointerdown', this._boundPointerDown);
        window.addEventListener('pointerup', this._boundPointerUp);
      }
    }

    destroy() {
      this.stopLoop();
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', this._boundKeyDown);
        window.removeEventListener('keyup', this._boundKeyUp);
        window.removeEventListener('pointerup', this._boundPointerUp);
      }
      if (this.canvas) {
        this.canvas.removeEventListener('pointerdown', this._boundPointerDown);
      }
    }

    /**
     * Returns a comprehensive snapshot of current engine, player, HUD, and planet state.
     */
    getState() {
      const nextObs = this.getNextPlanet();
      const biggest = this.biggestPlanetCleared;
      return {
        runId: this.runId,
        status: this.status,
        mode: this.mode,
        isReady: this.isReady,
        isPlaying: this.isPlaying,
        isRunning: this.isRunning,
        isPaused: this.isPaused,
        isGameOver: this.isGameOver,
        score: this.score,
        distanceScore: this.distanceScore,
        bonusScore: this.bonusScore,
        highScore: this.highScore,
        planetsCleared: this.planetsCleared,
        streak: this.streak,
        maxStreak: this.maxStreak,
        streakMultiplier: this.streakMultiplier,
        speed: this.speed,
        mach: this.mach,
        debugHitboxes: this.debugHitboxes,
        muted: this.muted,
        tony: Object.assign({}, this.tony),
        player: Object.assign({}, this.tony),
        nextPlanet: nextObs ? Object.assign({}, nextObs) : null,
        biggestPlanetCleared: biggest ? Object.assign({}, biggest) : null,
        biggestPlanet: biggest
          ? `${biggest.name} (${biggest.sizeTier} ${biggest.diameter}px)`
          : 'None',
        obstacles: this.obstacles.map((o) => Object.assign({}, o)),
        popups: this.popups.map((p) => Object.assign({}, p)),
        runPlanetManifest: this.getRunPlanetManifest()
      };
    }
  }

  // Static constants & factory/delegation helpers on TonyGameEngine
  TonyGameEngine.SIZE_TIERS = SIZE_TIERS;
  TonyGameEngine.SIZE_TIER_ORDER = SIZE_TIER_ORDER;
  TonyGameEngine.DEFAULT_PLANETS = DEFAULT_PLANETS;
  TonyGameEngine.computePlanetClearancePoints = computePlanetClearancePoints;
  TonyGameEngine.instance = null;

  TonyGameEngine.create = function (options) {
    return new TonyGameEngine(options);
  };

  TonyGameEngine.init = function (options) {
    if (TonyGameEngine.instance && !options) {
      return TonyGameEngine.instance;
    }
    return new TonyGameEngine(options);
  };

  TonyGameEngine.seedRunPlanets = function () {
    const inst = TonyGameEngine.instance || TonyGameEngine.init();
    return inst.seedRunPlanets();
  };

  TonyGameEngine.getRunPlanetManifest = function () {
    const inst = TonyGameEngine.instance || TonyGameEngine.init();
    return inst.getRunPlanetManifest();
  };

  TonyGameEngine.getState = function () {
    const inst = TonyGameEngine.instance || TonyGameEngine.init();
    return inst.getState();
  };

  TonyGameEngine.startNewRun = function (options) {
    const inst = TonyGameEngine.instance || TonyGameEngine.init();
    return inst.startNewRun(options);
  };

  TonyGameEngine.jump = function (options) {
    const inst = TonyGameEngine.instance || TonyGameEngine.init();
    return inst.jump(options);
  };

  if (root) {
    root.TonyGameEngine = TonyGameEngine;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TonyGameEngine;
  }
})(typeof window !== 'undefined' ? window : globalThis);
