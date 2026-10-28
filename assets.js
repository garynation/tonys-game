/**
 * Galactic Sheep — Visual & Audio Assets Module (assets.js)
 * Starring Tony the Galactic Sheep!
 * Exposes window.TONY_ASSETS ( plus aliases window.PLANET_CATALOG, window.STAR_CATALOG & window.TONY_AUDIO )
 *
 * Includes:
 * 1. PLANET_CATALOG: 8 well-known solar system planets (Mercury, Venus, Earth, Mars,
 *    Jupiter, Saturn, Uranus, Neptune) with verified NASA/Wikimedia Commons URLs,
 *    instant SVG/Canvas procedural textures for 100% offline/CSP reliability, and
 *    3D-shaded sphere + ring rendering via renderSprite(ctx, x, y, radius, rotationAngle, opts).
 * 2. STAR_CATALOG & drawCollectibleStar(ctx, star, opts): 6 surprise floating collectible
 *    stars of different sizes (MINI 14px to COLOSSAL 26px), point counts (4 to 8 points),
 *    and vivid colors across Positive (Gold Supernova, Cyan Pulsar, Emerald Quasar) and
 *    Negative (Crimson Dwarf, Violet Hazard Nova, Amber Eclipse) categories.
 * 3. drawTony(ctx, state): Expressive Galactic Sheep renderer with 4-frame gallop cycle,
 *    fluffy wool puffs, fluttering cosmic scarf, dynamic sizeScale/tonyScale (0.68x shrunk
 *    to 1.38x enlarged), activeEffectTint/auraColor cosmic aura ring, squash-and-stretch
 *    physics, floating "TONY" nameplate, and dynamic eye expressions ('determined', 'wide', 'dizzy').
 * 4. Starfield & Cosmic Track renderers: drawStarfield() and drawGroundTrack().
 * 5. TONY_AUDIO: Zero-dependency Web Audio API retro arcade sound effects synthesizer
 *    including playPerfectJump(), playStarPositive(), and playStarNegative().
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. DETERMINISTIC PSEUDO-RANDOM HELPER FOR PROCEDURAL TEXTURES
  // ---------------------------------------------------------------------------
  function createSeededRandom(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // ---------------------------------------------------------------------------
  // 2. PLANET CATALOG DEFINITIONS (8 WELL-KNOWN SOLAR SYSTEM PLANETS)
  // ---------------------------------------------------------------------------
  const RAW_PLANETS = [
    {
      id: 'mercury',
      name: 'Mercury',
      order: 1,
      tagline: 'Cratered Iron Core World',
      baseColor: '#9ea3ad',
      accentColor: '#d8dde6',
      shadowColor: '#3a3e47',
      atmosphereColor: 'rgba(200, 210, 225, 0.22)',
      hasRings: false,
      ringTilt: 0,
      naturalScaleHint: 'MINI',
      imageUrl:
        'https://upload.wikimedia.org/wikipedia/commons/3/3f/Mercury_Globe-MESSENGER_mosaic_centered_at_0degN-0degE.jpg',
    },
    {
      id: 'venus',
      name: 'Venus',
      order: 2,
      tagline: 'Golden Sulfuric Cloud Hothouse',
      baseColor: '#e3a857',
      accentColor: '#fbe09c',
      shadowColor: '#6b3e12',
      atmosphereColor: 'rgba(251, 191, 36, 0.35)',
      hasRings: false,
      ringTilt: 0,
      naturalScaleHint: 'SMALL',
      imageUrl:
        'https://upload.wikimedia.org/wikipedia/commons/0/08/Venus_from_Mariner_10.jpg',
    },
    {
      id: 'earth',
      name: 'Earth',
      order: 3,
      tagline: 'Blue Marble Terran Biosphere',
      baseColor: '#2563eb',
      accentColor: '#34d399',
      shadowColor: '#0c1e4a',
      atmosphereColor: 'rgba(56, 189, 248, 0.42)',
      hasRings: false,
      ringTilt: 0,
      naturalScaleHint: 'MEDIUM',
      imageUrl:
        'https://upload.wikimedia.org/wikipedia/commons/9/97/The_Earth_seen_from_Apollo_17.jpg',
    },
    {
      id: 'mars',
      name: 'Mars',
      order: 4,
      tagline: 'Rust-Red Dusty Canyons & Polar Cap',
      baseColor: '#d95338',
      accentColor: '#f7a072',
      shadowColor: '#5c190d',
      atmosphereColor: 'rgba(249, 115, 22, 0.30)',
      hasRings: false,
      ringTilt: 0,
      naturalScaleHint: 'SMALL',
      imageUrl:
        'https://upload.wikimedia.org/wikipedia/commons/0/02/OSIRIS_Mars_true_color.jpg',
    },
    {
      id: 'jupiter',
      name: 'Jupiter',
      order: 5,
      tagline: 'Banded Gas Giant & Great Red Spot',
      baseColor: '#d49b6a',
      accentColor: '#e85d3f',
      shadowColor: '#4f2c14',
      atmosphereColor: 'rgba(245, 158, 11, 0.32)',
      hasRings: false,
      ringTilt: 0,
      naturalScaleHint: 'COLOSSAL',
      imageUrl:
        'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2b/Jupiter_and_its_shrunken_Great_Red_Spot.jpg/250px-Jupiter_and_its_shrunken_Great_Red_Spot.jpg',
    },
    {
      id: 'saturn',
      name: 'Saturn',
      order: 6,
      tagline: 'Crown Jewel Ringed Gas Giant',
      baseColor: '#e4c27a',
      accentColor: '#fef0c7',
      shadowColor: '#594218',
      atmosphereColor: 'rgba(253, 224, 71, 0.30)',
      hasRings: true,
      ringTilt: -0.30,
      ringInnerRatio: 1.24,
      ringOuterRatio: 2.15,
      naturalScaleHint: 'LARGE',
      imageUrl:
        'https://upload.wikimedia.org/wikipedia/commons/4/45/Saturn_closeup.jpg',
    },
    {
      id: 'uranus',
      name: 'Uranus',
      order: 7,
      tagline: 'Sideways Pale-Cyan Ice Giant',
      baseColor: '#67e8f9',
      accentColor: '#cffafe',
      shadowColor: '#0e4f63',
      atmosphereColor: 'rgba(34, 211, 238, 0.36)',
      hasRings: true,
      ringTilt: 1.28,
      ringInnerRatio: 1.28,
      ringOuterRatio: 1.72,
      naturalScaleHint: 'LARGE',
      imageUrl:
        'https://upload.wikimedia.org/wikipedia/commons/c/c9/Uranus_as_seen_by_NASA%27s_Voyager_2_%28remastered%29_-_JPEG_converted.jpg',
    },
    {
      id: 'neptune',
      name: 'Neptune',
      order: 8,
      tagline: 'Supersonic Azure Windswept Giant',
      baseColor: '#3b82f6',
      accentColor: '#93c5fd',
      shadowColor: '#0f2361',
      atmosphereColor: 'rgba(59, 130, 246, 0.42)',
      hasRings: false,
      ringTilt: 0,
      naturalScaleHint: 'MEDIUM',
      imageUrl:
        'https://upload.wikimedia.org/wikipedia/commons/5/56/Neptune_Full.jpg',
    },
  ];

  // ---------------------------------------------------------------------------
  // 3. PROCEDURAL HIGH-RES PLANET TEXTURE GENERATOR (OFFSCREEN CANVAS + SVG)
  // ---------------------------------------------------------------------------
  function buildProceduralPlanetTexture(planet) {
    if (typeof document === 'undefined') return null;
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const rng = createSeededRandom(planet.order * 98765 + 1337);

    ctx.fillStyle = planet.baseColor;
    ctx.fillRect(0, 0, size, size);

    if (planet.id === 'mercury') {
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, '#b8bec8');
      grad.addColorStop(0.5, '#8e949f');
      grad.addColorStop(1, '#636872');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      for (let i = 0; i < 65; i++) {
        const cx = rng() * size;
        const cy = rng() * size;
        const r = 3 + rng() * 22;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = rng() > 0.5 ? 'rgba(60, 64, 72, 0.45)' : 'rgba(195, 202, 214, 0.32)';
        ctx.fill();
        ctx.lineWidth = Math.max(1, r * 0.14);
        ctx.strokeStyle = 'rgba(225, 230, 240, 0.45)';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx - r * 0.15, cy - r * 0.15, r * 0.65, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(40, 44, 52, 0.35)';
        ctx.fill();
      }
    } else if (planet.id === 'venus') {
      const bg = ctx.createLinearGradient(0, 0, 0, size);
      bg.addColorStop(0, '#f3c677');
      bg.addColorStop(0.3, '#d9933d');
      bg.addColorStop(0.5, '#f6d58e');
      bg.addColorStop(0.75, '#c87d28');
      bg.addColorStop(1, '#eab664');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size, size);

      for (let y = 0; y < size; y += 6) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= size; x += 16) {
          const wave = Math.sin((x / size) * Math.PI * 2 + y * 0.05) * 8;
          ctx.lineTo(x, y + wave);
        }
        ctx.strokeStyle =
          y % 12 === 0 ? 'rgba(255, 243, 199, 0.35)' : 'rgba(146, 78, 15, 0.25)';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    } else if (planet.id === 'earth') {
      const ocean = ctx.createLinearGradient(0, 0, 0, size);
      ocean.addColorStop(0, '#1d4ed8');
      ocean.addColorStop(0.5, '#1e40af');
      ocean.addColorStop(1, '#172554');
      ctx.fillStyle = ocean;
      ctx.fillRect(0, 0, size, size);

      const continents = [
        { x: 65, y: 78, rx: 38, ry: 28, rot: -0.3, color: '#22c55e' },
        { x: 92, y: 145, rx: 24, ry: 42, rot: 0.2, color: '#16a34a' },
        { x: 165, y: 72, rx: 48, ry: 26, rot: 0.15, color: '#4ade80' },
        { x: 158, y: 132, rx: 28, ry: 35, rot: -0.1, color: '#d97706' },
        { x: 215, y: 175, rx: 22, ry: 16, rot: 0.4, color: '#ca8a04' },
      ];
      continents.forEach((c) => {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, c.rx, c.ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = c.color;
        ctx.fill();
        ctx.restore();
      });

      ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
      ctx.fillRect(0, 0, size, 18);
      ctx.fillRect(0, size - 20, size, 20);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      for (let i = 0; i < 14; i++) {
        ctx.beginPath();
        const cy = 24 + rng() * (size - 48);
        const cx = rng() * size;
        ctx.arc(cx, cy, 14 + rng() * 28, 0.2, Math.PI * 1.25);
        ctx.lineWidth = 3 + rng() * 4;
        ctx.stroke();
      }
    } else if (planet.id === 'mars') {
      const marsGrad = ctx.createLinearGradient(0, 0, 0, size);
      marsGrad.addColorStop(0, '#f08c65');
      marsGrad.addColorStop(0.45, '#d95338');
      marsGrad.addColorStop(0.75, '#b83b22');
      marsGrad.addColorStop(1, '#8c2814');
      ctx.fillStyle = marsGrad;
      ctx.fillRect(0, 0, size, size);

      for (let i = 0; i < 18; i++) {
        ctx.beginPath();
        ctx.ellipse(
          rng() * size,
          40 + rng() * (size - 80),
          15 + rng() * 35,
          8 + rng() * 18,
          rng() * Math.PI,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = 'rgba(75, 22, 12, 0.35)';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.moveTo(60, 128);
      ctx.bezierCurveTo(105, 122, 150, 136, 198, 126);
      ctx.strokeStyle = 'rgba(58, 14, 7, 0.72)';
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 250, 245, 0.92)';
      ctx.beginPath();
      ctx.ellipse(size / 2, 10, 75, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(size / 2, size - 8, 65, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (planet.id === 'jupiter') {
      const bands = [
        { h: 0.10, c: '#9d7c5d' },
        { h: 0.08, c: '#e8d5b7' },
        { h: 0.09, c: '#c47d4e' },
        { h: 0.11, c: '#f5ead6' },
        { h: 0.12, c: '#b86135' },
        { h: 0.10, c: '#f2dec2' },
        { h: 0.14, c: '#c97a4b' },
        { h: 0.09, c: '#e8d0b3' },
        { h: 0.09, c: '#a67b5b' },
        { h: 0.08, c: '#7d5c44' },
      ];
      let yCursor = 0;
      bands.forEach((b) => {
        const bh = b.h * size;
        ctx.fillStyle = b.c;
        ctx.fillRect(0, yCursor, size, bh + 2);
        yCursor += bh;
      });

      for (let y = 24; y < size - 24; y += 22) {
        ctx.beginPath();
        for (let x = 0; x <= size; x += 12) {
          const wy = y + Math.sin(x * 0.08 + y) * 3.5;
          if (x === 0) ctx.moveTo(x, wy);
          else ctx.lineTo(x, wy);
        }
        ctx.strokeStyle = 'rgba(255, 245, 230, 0.35)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(size * 0.62, size * 0.64);
      ctx.rotate(-0.08);
      ctx.beginPath();
      ctx.ellipse(0, 0, 30, 19, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#fef3c7';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, 0, 25, 15, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#dc4c2c';
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-3, -2, 14, 8, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f97316';
      ctx.fill();
      ctx.restore();
    } else if (planet.id === 'saturn') {
      const satBands = [
        ['#9e8c6c', 0.0],
        ['#cfb582', 0.16],
        ['#ecd69f', 0.32],
        ['#fdf0c4', 0.48],
        ['#dfc184', 0.62],
        ['#c7a467', 0.78],
        ['#8f7853', 1.0],
      ];
      const sg = ctx.createLinearGradient(0, 0, 0, size);
      satBands.forEach(([col, stop]) => sg.addColorStop(stop, col));
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, size, size);

      for (let y = 12; y < size; y += 10) {
        ctx.fillStyle = y % 20 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(90,65,20,0.10)';
        ctx.fillRect(0, y, size, 4);
      }
    } else if (planet.id === 'uranus') {
      const ug = ctx.createLinearGradient(0, 0, size, size);
      ug.addColorStop(0, '#cffafe');
      ug.addColorStop(0.45, '#67e8f9');
      ug.addColorStop(0.8, '#22d3ee');
      ug.addColorStop(1, '#0891b2');
      ctx.fillStyle = ug;
      ctx.fillRect(0, 0, size, size);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 6;
      for (let y = 45; y < size - 40; y += 38) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }
    } else if (planet.id === 'neptune') {
      const ng = ctx.createLinearGradient(0, 0, 0, size);
      ng.addColorStop(0, '#1d4ed8');
      ng.addColorStop(0.35, '#2563eb');
      ng.addColorStop(0.65, '#1e40af');
      ng.addColorStop(1, '#172554');
      ctx.fillStyle = ng;
      ctx.fillRect(0, 0, size, size);

      ctx.beginPath();
      ctx.ellipse(size * 0.42, size * 0.56, 26, 15, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 62, 0.72)';
      ctx.fill();

      ctx.strokeStyle = 'rgba(224, 242, 254, 0.78)';
      ctx.lineWidth = 3;
      const streaks = [
        [size * 0.35, size * 0.49, 42],
        [size * 0.55, size * 0.34, 55],
        [size * 0.25, size * 0.72, 48],
      ];
      streaks.forEach(([sx, sy, len]) => {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + len * 0.5, sy - 4, sx + len, sy + 2);
        ctx.stroke();
      });
    }

    return canvas;
  }

  // ---------------------------------------------------------------------------
  // 4. RING RENDERING HELPER (SATURN & URANUS BACK/FRONT RING HALVES)
  // ---------------------------------------------------------------------------
  function drawPlanetaryRings(ctx, planet, radius, rotationAngle, isFrontHalf) {
    if (!planet.hasRings) return;

    ctx.save();
    const tilt = (planet.ringTilt || -0.3) + Math.sin(rotationAngle * 0.35) * 0.04;
    ctx.rotate(tilt);

    const rxOuter = radius * (planet.ringOuterRatio || 2.1);
    const ryOuter = rxOuter * (planet.id === 'uranus' ? 0.22 : 0.34);
    const rxInner = radius * (planet.ringInnerRatio || 1.25);
    const ryInner = rxInner * (planet.id === 'uranus' ? 0.22 : 0.34);

    const startAngle = isFrontHalf ? 0 : Math.PI;
    const endAngle = isFrontHalf ? Math.PI : Math.PI * 2;

    if (planet.id === 'saturn') {
      const ringBands = [
        { rScale: 1.0, width: Math.max(2, radius * 0.16), color: 'rgba(234, 210, 158, 0.78)' },
        { rScale: 0.86, width: Math.max(1.5, radius * 0.05), color: 'rgba(28, 22, 12, 0.65)' },
        { rScale: 0.76, width: Math.max(2.5, radius * 0.22), color: 'rgba(250, 232, 184, 0.90)' },
        { rScale: 0.62, width: Math.max(1.5, radius * 0.10), color: 'rgba(198, 170, 118, 0.45)' },
      ];
      ringBands.forEach((band) => {
        ctx.beginPath();
        ctx.ellipse(
          0,
          0,
          rxOuter * band.rScale,
          ryOuter * band.rScale,
          0,
          startAngle,
          endAngle
        );
        ctx.strokeStyle = band.color;
        ctx.lineWidth = band.width;
        ctx.stroke();
      });
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 0, rxOuter, ryOuter, 0, startAngle, endAngle);
      ctx.strokeStyle = 'rgba(165, 243, 252, 0.75)';
      ctx.lineWidth = Math.max(1.5, radius * 0.08);
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(0, 0, rxInner, ryInner, 0, startAngle, endAngle);
      ctx.strokeStyle = 'rgba(207, 250, 254, 0.45)';
      ctx.lineWidth = Math.max(1, radius * 0.04);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 5. INITIALIZE PLANET CATALOG WITH PRELOADED IMAGES + SPRITE RENDERER
  // ---------------------------------------------------------------------------
  const PLANET_CATALOG = RAW_PLANETS.map((raw) => {
    const planet = Object.assign({}, raw);
    planet.proceduralCanvas = buildProceduralPlanetTexture(planet);
    planet.imageLoaded = false;
    planet.remoteImage = null;

    if (typeof Image !== 'undefined') {
      const fallbackImg = new Image();
      if (planet.proceduralCanvas) {
        try {
          fallbackImg.src = planet.proceduralCanvas.toDataURL('image/png');
        } catch (e) {}
      }
      planet.img = fallbackImg;
      planet.image = fallbackImg;

      const netImg = new Image();
      netImg.crossOrigin = 'anonymous';
      netImg.onload = function () {
        planet.imageLoaded = true;
        planet.remoteImage = netImg;
      };
      netImg.onerror = function () {
        planet.imageLoaded = false;
      };
      netImg.src = planet.imageUrl;
    }

    planet.renderSprite = function (ctx, x, y, radius, rotationAngle, options) {
      if (!ctx || radius <= 0) return;
      const rot = Number.isFinite(rotationAngle) ? rotationAngle : 0;
      const opts = options || {};

      ctx.save();
      ctx.translate(x, y);

      if (planet.hasRings) {
        drawPlanetaryRings(ctx, planet, radius, rot, false);
      }

      if (opts.glow !== false) {
        const glowRadius = radius * 1.28;
        const glowGrad = ctx.createRadialGradient(0, 0, radius * 0.82, 0, 0, glowRadius);
        glowGrad.addColorStop(0, planet.atmosphereColor || 'rgba(255,255,255,0.25)');
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.beginPath();
        ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = glowGrad;
        ctx.fill();
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.clip();

      ctx.save();
      ctx.rotate(rot * 0.25);

      if (planet.proceduralCanvas) {
        const shift = ((rot * 28) % 256 + 256) % 256;
        const d = radius * 2.08;
        ctx.drawImage(
          planet.proceduralCanvas,
          shift,
          0,
          256 - shift,
          256,
          -radius * 1.04,
          -radius * 1.04,
          d * ((256 - shift) / 256),
          d
        );
        if (shift > 0) {
          ctx.drawImage(
            planet.proceduralCanvas,
            0,
            0,
            shift,
            256,
            -radius * 1.04 + d * ((256 - shift) / 256),
            -radius * 1.04,
            d * (shift / 256),
            d
          );
        }
      } else {
        ctx.fillStyle = planet.baseColor;
        ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
      }

      if (planet.imageLoaded && planet.remoteImage && planet.remoteImage.complete) {
        try {
          ctx.globalAlpha = 0.52;
          ctx.drawImage(
            planet.remoteImage,
            -radius * 1.12,
            -radius * 1.12,
            radius * 2.24,
            radius * 2.24
          );
          ctx.globalAlpha = 1;
        } catch (err) {
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();

      const shadeGrad = ctx.createRadialGradient(
        -radius * 0.35,
        -radius * 0.35,
        radius * 0.08,
        0,
        0,
        radius * 1.05
      );
      shadeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.38)');
      shadeGrad.addColorStop(0.28, 'rgba(255, 255, 255, 0.05)');
      shadeGrad.addColorStop(0.70, 'rgba(0, 0, 0, 0.18)');
      shadeGrad.addColorStop(1, 'rgba(2, 6, 23, 0.72)');
      ctx.fillStyle = shadeGrad;
      ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

      ctx.beginPath();
      ctx.arc(0, 0, radius - 0.75, 0, Math.PI * 2);
      ctx.strokeStyle = planet.accentColor || 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1.25;
      ctx.globalAlpha = 0.55;
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.restore();

      if (planet.hasRings) {
        drawPlanetaryRings(ctx, planet, radius, rot, true);
      }

      ctx.restore();
    };

    planet.draw = planet.renderSprite;

    planet.getThumbnailDataUrl = function (thumbSize) {
      if (typeof document === 'undefined') return planet.imageUrl;
      const sz = thumbSize || 64;
      const c = document.createElement('canvas');
      c.width = sz;
      c.height = sz;
      const cctx = c.getContext('2d');
      const r = planet.hasRings ? sz * 0.25 : sz * 0.38;
      planet.renderSprite(cctx, sz / 2, sz / 2, r, 0.4);
      return c.toDataURL('image/png');
    };

    return planet;
  });

  const PLANET_MAP = {};
  PLANET_CATALOG.forEach((p) => {
    PLANET_MAP[p.id] = p;
    PLANET_MAP[p.name.toLowerCase()] = p;
  });

  function getPlanetById(idOrName) {
    if (!idOrName) return PLANET_CATALOG[0];
    const key = String(idOrName).toLowerCase();
    return PLANET_MAP[key] || PLANET_CATALOG[0];
  }

  // ---------------------------------------------------------------------------
  // 6. SURPRISE FLOATING COLLECTIBLE STARS (STAR_CATALOG & RENDERER)
  // ---------------------------------------------------------------------------
  const RAW_STARS = [
    // 3 Positive Stars
    {
      id: 'GOLD_SUPERNOVA',
      name: 'Gold Supernova',
      category: 'positive',
      isPositive: true,
      color: '#FFD700',
      glowColor: '#FFF3B0',
      radius: 22,
      sizeLabel: 'LARGE',
      points: 5,
      scoreDelta: 500,
      effectType: 'BONUS_POINTS',
      shortTag: '+500 PTS',
      description: 'Instant +500 bonus points!',
    },
    {
      id: 'CYAN_PULSAR',
      name: 'Cyan Pulsar',
      category: 'positive',
      isPositive: true,
      color: '#00E5FF',
      glowColor: '#B2F2FF',
      radius: 18,
      sizeLabel: 'MEDIUM',
      points: 6,
      scoreDelta: 250,
      effectType: 'HIGHER_JUMP',
      jumpMultiplier: 1.25,
      durationSec: 10,
      shortTag: 'HIGH JUMP',
      description: 'Higher jumps (+25% apex) for 10s & +250 pts!',
    },
    {
      id: 'EMERALD_QUASAR',
      name: 'Emerald Quasar',
      category: 'positive',
      isPositive: true,
      color: '#2ECC71',
      glowColor: '#A9DFBF',
      radius: 14,
      sizeLabel: 'MINI',
      points: 4,
      scoreDelta: 300,
      effectType: 'SHRINK_AND_WIDE_GAPS',
      tonyScale: 0.68,
      gapMultiplier: 1.30,
      durationSec: 10,
      shortTag: 'MINI + WIDE GAP',
      description: 'Makes Tony smaller (0.68x) & widens planet gaps (+30%) for 10s!',
    },
    // 3 Negative Hazard Stars
    {
      id: 'CRIMSON_DWARF',
      name: 'Crimson Dwarf',
      category: 'negative',
      isPositive: false,
      color: '#FF3366',
      glowColor: '#FF8FA3',
      radius: 21,
      sizeLabel: 'LARGE',
      points: 8,
      scoreDelta: -150,
      effectType: 'GROW_AND_TIGHT_GAPS',
      tonyScale: 1.38,
      gapMultiplier: 0.90,
      durationSec: 8,
      shortTag: 'BIG SHEEP + TIGHT GAP',
      description: 'Makes Tony bigger (1.38x), narrows planet gaps (-10%), & -150 pts!',
    },
    {
      id: 'VIOLET_NOVA',
      name: 'Violet Hazard Nova',
      category: 'negative',
      isPositive: false,
      color: '#C77DFF',
      glowColor: '#F72585',
      radius: 26,
      sizeLabel: 'COLOSSAL',
      points: 7,
      scoreDelta: -300,
      effectType: 'FIVE_BIGGER_PLANETS',
      enlargedPlanetsCount: 5,
      planetRadiusBoost: 1.32,
      shortTag: '5x GIANT PLANETS -300',
      description: 'Next 5 planets in a row grow larger (+32%) & loses 300 pts!',
    },
    {
      id: 'AMBER_ECLIPSE',
      name: 'Amber Eclipse',
      category: 'negative',
      isPositive: false,
      color: '#FF7B00',
      glowColor: '#FFD166',
      radius: 16,
      sizeLabel: 'SMALL',
      points: 5,
      scoreDelta: -200,
      effectType: 'TIGHT_GAPS_PENALTY',
      gapMultiplier: 0.91,
      durationSec: 8,
      shortTag: 'TIGHT GAPS -200',
      description: 'Narrows planet gaps slightly (-9%) for 8s & loses 200 pts!',
    },
  ];

  /**
   * Renders a floating collectible star at `(star.x, star.y)` with its specific `radius`,
   * `color`, `glowColor`, multi-point star geometry, pulsing corona, orbiting sparkles,
   * and a crisp floating tag above/below it (`star.shortTag`).
   */
  function drawCollectibleStar(ctx, starInput, options) {
    if (!ctx || !starInput) return;
    const opts = options || {};
    const template =
      typeof starInput === 'string'
        ? getStarById(starInput)
        : getStarById(starInput.id || starInput.typeId || starInput.starId) || starInput;

    const x = Number.isFinite(starInput.x) ? starInput.x : opts.x || 0;
    const y = Number.isFinite(starInput.y) ? starInput.y : opts.y || 0;
    const radius = Number.isFinite(starInput.radius)
      ? starInput.radius
      : Number.isFinite(opts.radius)
      ? opts.radius
      : template.radius || 18;
    const points = Number.isFinite(starInput.points)
      ? starInput.points
      : template.points || 5;
    const color = starInput.color || template.color || '#FFD700';
    const glowColor = starInput.glowColor || template.glowColor || '#FFF3B0';
    const category =
      starInput.category ||
      template.category ||
      (starInput.scoreDelta < 0 ? 'negative' : 'positive');
    const isNegative = category === 'negative';
    const shortTag =
      starInput.shortTag !== undefined ? starInput.shortTag : template.shortTag || '';

    const phase = Number.isFinite(starInput.phase)
      ? starInput.phase
      : Number.isFinite(starInput.rotation)
      ? starInput.rotation
      : (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.004;

    const pulse = 1 + Math.sin(phase * 1.8) * 0.08;
    const outerR = radius * pulse;
    const innerR = outerR * (points >= 7 ? 0.44 : points === 4 ? 0.36 : 0.46);

    ctx.save();
    ctx.translate(x, y);

    // 1. Pulsing Outer Corona Glow
    if (opts.glow !== false) {
      const haloR = outerR * 1.65;
      const haloGrad = ctx.createRadialGradient(0, 0, outerR * 0.2, 0, 0, haloR);
      haloGrad.addColorStop(0, glowColor);
      haloGrad.addColorStop(0.45, color);
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.globalAlpha = 0.42;
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(0, 0, haloR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 2. Orbiting Ring / Sparkles (distinguishes positive vs negative hazard)
    ctx.save();
    ctx.rotate(phase * (isNegative ? -0.8 : 0.6));
    if (isNegative) {
      // Dashed warning orbit ring for negative hazard stars
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.72;
      ctx.beginPath();
      ctx.arc(0, 0, outerR * 1.22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // 3 bright orbiting starlight sparkles for positive stars
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 3; i++) {
        const ang = (i * Math.PI * 2) / 3;
        const sx = Math.cos(ang) * (outerR * 1.18);
        const sy = Math.sin(ang) * (outerR * 1.18);
        ctx.beginPath();
        ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // 3. Multi-Point Star Polygon Geometry
    ctx.save();
    ctx.rotate(Math.sin(phase * 0.7) * 0.18);
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    const starGrad = ctx.createRadialGradient(
      -outerR * 0.18,
      -outerR * 0.18,
      outerR * 0.05,
      0,
      0,
      outerR
    );
    starGrad.addColorStop(0, '#ffffff');
    starGrad.addColorStop(0.35, glowColor);
    starGrad.addColorStop(0.85, color);
    starGrad.addColorStop(1, isNegative ? '#4a0420' : '#0f172a');

    ctx.fillStyle = starGrad;
    ctx.fill();
    ctx.lineWidth = Math.max(1.4, radius * 0.08);
    ctx.strokeStyle = isNegative ? '#ffe3ec' : '#ffffff';
    ctx.stroke();

    // Inner core emblem (bright sparkle core for positive, dark hazard core for negative)
    ctx.beginPath();
    ctx.arc(0, 0, innerR * 0.48, 0, Math.PI * 2);
    ctx.fillStyle = isNegative ? 'rgba(24, 6, 36, 0.78)' : 'rgba(255, 255, 255, 0.88)';
    ctx.fill();
    ctx.restore();

    // 4. Crisp Floating Tag Pill above/below the Star
    if (opts.showTag !== false && shortTag) {
      const tagY = -outerR - 13;
      ctx.font = '700 9px "JetBrains Mono", "Space Grotesk", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textWidth = ctx.measureText(shortTag).width;
      const padX = 6;
      const pillW = Math.max(44, textWidth + padX * 2);
      const pillH = 14;

      ctx.fillStyle = isNegative ? 'rgba(45, 6, 24, 0.88)' : 'rgba(8, 28, 36, 0.88)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(-pillW / 2, tagY - pillH / 2, pillW, pillH, 4);
      } else {
        ctx.rect(-pillW / 2, tagY - pillH / 2, pillW, pillH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isNegative ? '#ffd6e0' : '#ffffff';
      ctx.fillText(shortTag, 0, tagY + 0.5);
    }

    ctx.restore();
  }

  const STAR_CATALOG = RAW_STARS.map((raw) => {
    const star = Object.assign({}, raw);
    star.renderSprite = function (ctx, x, y, radiusOverride, rotationOverride, opts) {
      drawCollectibleStar(
        ctx,
        Object.assign({}, star, {
          x: x,
          y: y,
          radius: radiusOverride || star.radius,
          phase: rotationOverride || 0,
        }),
        opts
      );
    };
    star.getThumbnailDataUrl = function (size) {
      return getStarThumbnailDataUrl(star, size);
    };
    return star;
  });

  const STAR_MAP = {};
  STAR_CATALOG.forEach((st) => {
    STAR_MAP[st.id] = st;
    STAR_MAP[st.id.toLowerCase()] = st;
    STAR_MAP[st.name.toLowerCase()] = st;
  });

  function getStarById(idOrName) {
    if (!idOrName) return STAR_CATALOG[0];
    if (typeof idOrName === 'object' && idOrName.id) {
      return STAR_MAP[idOrName.id] || idOrName;
    }
    const key = String(idOrName);
    return STAR_MAP[key] || STAR_MAP[key.toLowerCase()] || STAR_CATALOG[0];
  }

  function getStarThumbnailDataUrl(starIdOrObj, size) {
    if (typeof document === 'undefined') return '';
    const st = getStarById(starIdOrObj);
    const sz = size || 48;
    const c = document.createElement('canvas');
    c.width = sz;
    c.height = sz;
    const cctx = c.getContext('2d');
    if (!cctx) return '';
    const thumbRadius = Math.max(8, Math.min(sz * 0.34, st.radius * (sz / 64)));
    drawCollectibleStar(
      cctx,
      Object.assign({}, st, {
        x: sz / 2,
        y: sz / 2,
        radius: thumbRadius,
        phase: 0.3,
      }),
      { showTag: false, glow: true }
    );
    return c.toDataURL('image/png');
  }

  // ---------------------------------------------------------------------------
  // 7. TONY THE GALACTIC SHEEP RENDERER — drawTony(ctx, state)
  // ---------------------------------------------------------------------------
  /**
   * Draws Tony the Galactic Sheep with 4-frame gallop cycle, fluffy wool puffs,
   * cosmic scarf, dynamic sizeScale/tonyScale (e.g. 0.68x shrunk, 1.38x enlarged),
   * activeEffectTint / auraColor cosmic ring, squash-and-stretch physics,
   * expressive eyes, and floating "TONY" badge.
   */
  function drawTony(ctx, state) {
    if (!ctx) return;
    const s = state || {};

    const sizeScale = Number.isFinite(s.sizeScale)
      ? s.sizeScale
      : Number.isFinite(s.tonyScale)
      ? s.tonyScale
      : Number.isFinite(s.scale)
      ? s.scale
      : 1.0;

    const baseH = 52;
    const w = s.width || 56 * sizeScale;
    const h = s.height || baseH * sizeScale;

    let cx = s.x !== undefined ? s.x : 120;
    let cy = s.y !== undefined ? s.y : 300;

    if (Number.isFinite(s.centerX) && Number.isFinite(s.centerY)) {
      cx = s.centerX;
      cy = s.centerY;
    } else if (s.anchor === 'center') {
      cx = s.x;
      cy = s.y;
    } else if (s.anchor === 'bottom-center' || s.width === undefined) {
      cx = s.x;
      cy = s.y - baseH * 0.48 * sizeScale;
    } else {
      cx = s.x + w * 0.5;
      cy = s.y + h * 0.5;
    }

    const vy = Number.isFinite(s.vy) ? s.vy : 0;
    const isDead = Boolean(s.isDead || s.isCrashed || s.crashed || s.expression === 'dizzy');
    const isJumping =
      s.isJumping !== undefined
        ? Boolean(s.isJumping)
        : s.onGround !== undefined
        ? !s.onGround
        : s.isGrounded !== undefined
        ? !s.isGrounded
        : Math.abs(vy) > 0.5;

    const animTick =
      s.animTime !== undefined
        ? s.animTime
        : s.tick !== undefined
        ? s.tick * 0.22
        : s.animFrame !== undefined
        ? s.animFrame * 0.9
        : (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.014;

    let scaleX = Number.isFinite(s.scaleX) ? s.scaleX : Number.isFinite(s.squashX) ? s.squashX : 1;
    let scaleY = Number.isFinite(s.scaleY) ? s.scaleY : Number.isFinite(s.squashY) ? s.squashY : 1;
    if (!Number.isFinite(s.scaleX) && !Number.isFinite(s.scaleY) && isJumping) {
      const stretch = Math.max(-0.14, Math.min(0.16, -vy * 0.012));
      scaleX = 1 - stretch * 0.55;
      scaleY = 1 + stretch;
    }

    const pitch = isDead
      ? -0.25
      : isJumping
      ? Math.max(-0.28, Math.min(0.24, vy * 0.018))
      : Math.sin(animTick * 2) * 0.03;

    // Resolve active cosmic effect aura color if any star modifier is active
    const auraColor =
      s.activeEffectTint ||
      s.auraColor ||
      (sizeScale < 0.92 ? '#2ECC71' : sizeScale > 1.08 ? '#FF3366' : null);

    ctx.save();
    ctx.translate(cx, cy);

    // Optional Glowing Cosmic Aura Ring when a Star Effect is active
    if (auraColor) {
      ctx.save();
      const auraRadius = 31 * sizeScale;
      const auraGrad = ctx.createRadialGradient(0, 0, auraRadius * 0.35, 0, 0, auraRadius * 1.25);
      auraGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      auraGrad.addColorStop(0.65, auraColor);
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.globalAlpha = 0.34 + 0.12 * Math.sin(animTick * 2.5);
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, 0, auraRadius * 1.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.78;
      ctx.strokeStyle = auraColor;
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.ellipse(0, 0, 29 * sizeScale, 22 * sizeScale, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Draw floating "TONY" arcade badge above sheep (unrotated so text stays crisp)
    if (s.showNameplate !== false) {
      ctx.save();
      const badgeY = -baseH * 0.68 * sizeScale - (isJumping ? 4 : 0);
      ctx.font = '700 9px "Space Grotesk", "Inter", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
      ctx.strokeStyle = isDead ? '#f87171' : auraColor || '#38bdf8';
      ctx.lineWidth = 1.2;
      const labelText =
        sizeScale < 0.85 ? 'TONY · MINI' : sizeScale > 1.15 ? 'TONY · GIANT' : 'TONY';
      const bw = labelText.length > 4 ? 58 : 34;
      const bh = 13;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(-bw / 2, badgeY - bh / 2, bw, bh, 4);
      } else {
        ctx.rect(-bw / 2, badgeY - bh / 2, bw, bh);
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(labelText, 0, badgeY + 0.5);
      ctx.restore();
    }

    ctx.rotate(pitch);
    ctx.scale(scaleX * sizeScale, scaleY * sizeScale);

    // 1. Trailing Cosmic Bandana / Scarf
    ctx.save();
    const wave1 = Math.sin(animTick * 2.4) * 5;
    const wave2 = Math.cos(animTick * 2.4) * 7;
    ctx.beginPath();
    ctx.moveTo(-4, 2);
    ctx.quadraticCurveTo(-20, -4 + wave1, -34, -2 + wave2);
    ctx.lineTo(-30, 7 + wave2);
    ctx.quadraticCurveTo(-18, 5 + wave1, -4, 8);
    ctx.closePath();
    const scarfGrad = ctx.createLinearGradient(-4, 0, -34, 0);
    scarfGrad.addColorStop(0, '#ef4444');
    scarfGrad.addColorStop(0.6, '#f97316');
    scarfGrad.addColorStop(1, '#facc15');
    ctx.fillStyle = scarfGrad;
    ctx.fill();
    ctx.restore();

    // 2. 4-Frame Galloping Black Legs & Cloven Hooves
    const legOffsets = [
      { x: -12, phase: 0, isBack: true },
      { x: -5, phase: Math.PI * 0.5, isBack: false },
      { x: 6, phase: Math.PI, isBack: true },
      { x: 13, phase: Math.PI * 1.5, isBack: false },
    ];

    legOffsets.forEach((leg) => {
      ctx.save();
      ctx.translate(leg.x, 10);
      let swing = 0;
      let lift = 0;
      if (isDead) {
        swing = leg.isBack ? 0.6 : -0.6;
      } else if (isJumping) {
        swing = vy < 0 ? -0.42 : 0.35;
        lift = -3;
      } else {
        swing = Math.sin(animTick * 2.2 + leg.phase) * 0.48;
        lift = Math.min(0, Math.cos(animTick * 2.2 + leg.phase) * 4);
      }
      ctx.rotate(swing);
      ctx.fillStyle = leg.isBack ? '#1e293b' : '#0f172a';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(-2.8, lift, 5.6, 14, 2.5);
      } else {
        ctx.rect(-2.8, lift, 5.6, 14);
      }
      ctx.fill();

      ctx.fillStyle = '#475569';
      ctx.fillRect(-3, lift + 11, 6, 3.2);
      ctx.restore();
    });

    // 3. Cute Fluffy Tail
    ctx.save();
    const tailWag = Math.sin(animTick * 3) * 2.5;
    ctx.beginPath();
    ctx.arc(-21, -1 + tailWag, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.fill();
    ctx.restore();

    // 4. Fluffy Wool Body
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(-2, 2, 20, 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#cbd5e1';
    ctx.fill();

    const woolPuffs = [
      { x: -14, y: -4, r: 9.5 },
      { x: -6, y: -9, r: 10.5 },
      { x: 4, y: -8, r: 10 },
      { x: 11, y: -2, r: 9 },
      { x: -15, y: 4, r: 8.5 },
      { x: -5, y: 6, r: 9.5 },
      { x: 5, y: 5, r: 9 },
      { x: -2, y: -1, r: 11 },
    ];

    woolPuffs.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.strokeStyle = auraColor || 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = auraColor ? 1.2 : 1;
      ctx.stroke();
    });
    ctx.restore();

    // 5. Bandana Collar around Neck
    ctx.save();
    ctx.beginPath();
    ctx.arc(11, 2, 8.5, 0.3, Math.PI * 0.95);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();

    // 6. Sheep Head, Ears, Wool Tuft & Expressive Eyes
    ctx.save();
    ctx.translate(16, -6);

    ctx.save();
    const earFlop = Math.max(-0.35, Math.min(0.4, -vy * 0.03));
    ctx.rotate(-0.35 + earFlop);
    ctx.beginPath();
    ctx.ellipse(-7, 0, 6.5, 3.2, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.ellipse(2, 1, 10.5, 8.2, 0.18, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(9.5, 1.5, 1.3, 0, Math.PI * 2);
    ctx.fillStyle = '#fda4af';
    ctx.fill();

    ctx.beginPath();
    if (isDead) {
      ctx.arc(6.5, 5.5, 2.2, 0, Math.PI * 2);
      ctx.strokeStyle = '#fda4af';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else {
      ctx.arc(6.5, 3.8, 3, 0.15, Math.PI * 0.85);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }

    const eyeMode = isDead
      ? 'dizzy'
      : s.expression === 'wide' || s.eyeState === 'wide' || s.nearGiantPlanet || (isJumping && vy < -6)
      ? 'wide'
      : 'determined';

    if (eyeMode === 'dizzy') {
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -3.5);
      ctx.lineTo(5, 1.5);
      ctx.moveTo(5, -3.5);
      ctx.lineTo(0, 1.5);
      ctx.stroke();
    } else if (eyeMode === 'wide') {
      ctx.beginPath();
      ctx.arc(3, -1, 4.2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(4, -1, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(3.2, -2, 0.9, 0, Math.PI * 2);
      ctx.arc(4.8, -0.2, 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(3, -1, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(4.1, -0.8, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(3.5, -1.6, 0.75, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-0.5, -4.2);
      ctx.lineTo(6.5, -2.8);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    const headPuffs = [
      { x: -4, y: -7.5, r: 5 },
      { x: 1, y: -8.5, r: 5.5 },
      { x: 5.5, y: -7, r: 4.2 },
    ];
    headPuffs.forEach((hp) => {
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, hp.r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    });

    if (isDead) {
      for (let i = 0; i < 3; i++) {
        const ang = animTick * 3 + (i * Math.PI * 2) / 3;
        const sx = Math.cos(ang) * 14;
        const sy = -13 + Math.sin(ang) * 4;
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(sx, sy, 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 8. PARALLAX COSMIC STARFIELD & GROUND TRACK HELPERS
  // ---------------------------------------------------------------------------
  const STAR_LAYERS = (function () {
    const rng = createSeededRandom(424242);
    const stars = [];
    for (let i = 0; i < 95; i++) {
      stars.push({
        xFrac: rng(),
        yFrac: rng() * 0.85,
        radius: 0.6 + rng() * 1.8,
        parallax: 0.12 + rng() * 0.55,
        twinkleSpeed: 1.5 + rng() * 3.5,
        phase: rng() * Math.PI * 2,
        hue: rng() > 0.75 ? '#bae6fd' : rng() > 0.5 ? '#fef08a' : '#f8fafc',
      });
    }
    return stars;
  })();

  function drawStarfield(ctx, width, height, scrollOffset, timeSec) {
    if (!ctx) return;
    const w = width || 800;
    const h = height || 400;
    const scroll = Number.isFinite(scrollOffset) ? scrollOffset : 0;
    const t = Number.isFinite(timeSec)
      ? timeSec
      : (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;

    ctx.save();
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#040714');
    bgGrad.addColorStop(0.55, '#0b112c');
    bgGrad.addColorStop(1, '#131c3e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const nebX = ((w * 0.7 - scroll * 0.04) % (w + 300) + (w + 300)) % (w + 300) - 150;
    const nebGrad = ctx.createRadialGradient(nebX, h * 0.32, 10, nebX, h * 0.32, 190);
    nebGrad.addColorStop(0, 'rgba(99, 102, 241, 0.16)');
    nebGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.07)');
    nebGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = nebGrad;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < STAR_LAYERS.length; i++) {
      const st = STAR_LAYERS[i];
      const sx = ((st.xFrac * w - scroll * st.parallax) % w + w) % w;
      const sy = st.yFrac * h;
      const alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * st.twinkleSpeed + st.phase));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = st.hue;
      ctx.beginPath();
      ctx.arc(sx, sy, st.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawGroundTrack(ctx, width, height, groundY, scrollOffset) {
    if (!ctx) return;
    const w = width || 800;
    const h = height || 400;
    const gy = groundY || h - 56;
    const scroll = Number.isFinite(scrollOffset) ? scrollOffset : 0;

    ctx.save();
    const deckGrad = ctx.createLinearGradient(0, gy, 0, h);
    deckGrad.addColorStop(0, '#0f172a');
    deckGrad.addColorStop(1, '#020617');
    ctx.fillStyle = deckGrad;
    ctx.fillRect(0, gy, w, h - gy);

    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    const spacing = 48;
    const offset = ((scroll % spacing) + spacing) % spacing;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.24)';
    ctx.lineWidth = 1.5;
    for (let x = -offset; x < w + spacing; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, gy + 2);
      ctx.lineTo(x - 18, h);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // 9. WEB AUDIO SYNTHESIZER (TONY_AUDIO) — RETRO ARCADE SOUND EFFECTS
  // ---------------------------------------------------------------------------
  const TONY_AUDIO = {
    ctx: null,
    isMuted: false,

    _ensureContext: function () {
      if (this.isMuted) return null;
      if (typeof window === 'undefined') return null;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.ctx) {
        try {
          this.ctx = new AudioCtx();
        } catch (e) {
          return null;
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        try {
          this.ctx.resume();
        } catch (e) {}
      }
      return this.ctx;
    },

    setMuted: function (muted) {
      this.isMuted = Boolean(muted);
      return this.isMuted;
    },

    toggleMute: function () {
      this.isMuted = !this.isMuted;
      if (!this.isMuted) {
        this.playButton();
      }
      return this.isMuted;
    },

    playJump: function (chargeRatio) {
      const ctx = this._ensureContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const boost = Math.max(0, Math.min(1, Number(chargeRatio) || 0.5));
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220 + boost * 60, now);
        osc.frequency.exponentialRampToValueAtTime(580 + boost * 180, now + 0.14);

        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      } catch (e) {}
    },

    playPerfectJump: function () {
      const ctx = this._ensureContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const notes = [587.33, 880.0, 1174.66, 1760.0];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = idx === notes.length - 1 ? 'sine' : 'triangle';
          const start = now + idx * 0.038;
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.13, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.11);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.11);
        });
      } catch (e) {}
    },

    playStarPositive: function () {
      const ctx = this._ensureContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          const start = now + idx * 0.042;
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.13, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.13);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.13);
        });
      } catch (e) {}
    },

    playStarNegative: function () {
      const ctx = this._ensureContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const notes = [392.0, 311.13, 233.08, 174.61];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          const start = now + idx * 0.055;
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.12, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.14);
        });
      } catch (e) {}
    },

    playClearPlanet: function (sizeTier, points) {
      const ctx = this._ensureContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const tierStr = String(sizeTier || 'MEDIUM').toUpperCase();
        const tierPitchMap = {
          MINI: [523.25, 659.25],
          SMALL: [587.33, 783.99],
          MEDIUM: [659.25, 880.0, 1046.5],
          LARGE: [659.25, 880.0, 1174.66, 1318.5],
          COLOSSAL: [523.25, 659.25, 783.99, 1046.5, 1567.98],
        };
        const notes = tierPitchMap[tierStr] || tierPitchMap.MEDIUM;
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = tierStr === 'COLOSSAL' || tierStr === 'LARGE' ? 'square' : 'triangle';
          const start = now + idx * 0.055;
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.11, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.12);
        });
      } catch (e) {}
    },

    playCloseCall: function () {
      const ctx = this._ensureContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        [880, 1318.5, 1760].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          const start = now + idx * 0.04;
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.12, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.09);
        });
      } catch (e) {}
    },

    playNewHighScore: function () {
      const ctx = this._ensureContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const fanfare = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
        const durations = [0.09, 0.09, 0.09, 0.16, 0.08, 0.28];
        let offset = 0;
        fanfare.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, now + offset);
          gain.gain.setValueAtTime(0.10, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + durations[i]);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + offset);
          osc.stop(now + offset + durations[i]);
          offset += durations[i] * 0.92;
        });
      } catch (e) {}
    },

    playCrash: function () {
      const ctx = this._ensureContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.exponentialRampToValueAtTime(42, now + 0.36);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.38);
      } catch (e) {}
    },

    playButton: function () {
      const ctx = this._ensureContext();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(740, now);
        osc.frequency.setValueAtTime(987.77, now + 0.035);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } catch (e) {}
    },
  };

  // ---------------------------------------------------------------------------
  // 10. EXPORT CONTRACT ON WINDOW
  // ---------------------------------------------------------------------------
  const TONY_ASSETS = {
    GAME_TITLE: 'Galactic Sheep',
    PLANET_CATALOG: PLANET_CATALOG,
    PLANET_MAP: PLANET_MAP,
    getPlanetById: getPlanetById,
    STAR_CATALOG: STAR_CATALOG,
    STAR_MAP: STAR_MAP,
    getStarById: getStarById,
    drawCollectibleStar: drawCollectibleStar,
    getStarThumbnailDataUrl: getStarThumbnailDataUrl,
    drawTony: drawTony,
    drawStarfield: drawStarfield,
    drawGroundTrack: drawGroundTrack,
    TONY_AUDIO: TONY_AUDIO,
  };

  global.TONY_ASSETS = TONY_ASSETS;
  global.PLANET_CATALOG = PLANET_CATALOG;
  global.STAR_CATALOG = STAR_CATALOG;
  global.TONY_AUDIO = TONY_AUDIO;
})(typeof window !== 'undefined' ? window : globalThis);
