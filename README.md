# Tony's Jumping Game 🐑🪐

A modern browser-based cosmic endless runner inspired by the Chrome Dinosaur game. Help **Tony the Sheep** jump across randomized solar system planets with precision timing and compete on a retro arcade high score leaderboard.

## Features

- **Tony the Sheep (`assets.js`)**: Expressive 60fps HTML5 Canvas character with 4-frame galloping animation, fluffy wool puffs, fluttering cosmic scarf, squash-and-stretch physics, and dynamic facial expressions.
- **Spacebar Precision Jump (`engine.js`)**:
  - Press **`Space`** (or **`ArrowUp`** / click-tap on the canvas) to jump.
  - Variable-hold jump height (`160ms`), coyote time (`95ms`), jump buffer (`130ms`), and an **Optimal Launch Zone** ground indicator ahead of large planets.
- **8 Solar System Planets (`PLANET_CATALOG`)**:
  - **Mercury**, **Venus**, **Earth**, **Mars**, **Jupiter**, **Saturn** (tilted ring system), **Uranus** (vertical ring system), and **Neptune**.
- **Per-Run Randomized Planet Sizes**:
  - Every game run re-rolls planet sizes across **5 Size Tiers**:
    - `MINI` (`R: 18–24px`, `+100 pts`, `1x`)
    - `SMALL` (`R: 26–33px`, `+200 pts`, `2x`)
    - `MEDIUM` (`R: 35–44px`, `+350 pts`, `3.5x`)
    - `LARGE` (`R: 46–56px`, `+600 pts`, `6x`)
    - `COLOSSAL` (`R: 58–70px`, `+1000 pts`, `10x` — requires precision takeoff timing)
- **Retro Arcade High Score Table (`arcade.js`)**:
  - Starts clean (`0` default seed entries, `HI 000000`).
  - Full player name entry (`#arcade-player-name-input`, no 3-letter limit).
  - Persistent browser storage (`localStorage`) with instant **↺ Clear Board** reset.

## Quick Start

Open `index.html` (or the self-contained single-file `bundle.html`) in any modern browser, or serve locally:

```bash
python3 -m http.server 8765
# Open http://localhost:8765/index.html
```

## Controls

| Key | Action |
| :--- | :--- |
| `Space` / `ArrowUp` / Click | Jump / Start Run |
| `R` | Re-Randomize Planet Sizes / New Run |
| `H` | Toggle Hitbox & Jump Trajectory Guide |
| `M` | Toggle Retro Synth Audio |
| `P` | Pause / Resume |
