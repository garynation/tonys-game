# Galactic Sheep 🐑🪐⭐

A modern browser-based cosmic endless runner starring **Tony the Galactic Sheep**. Leap across randomized solar system planets with precision takeoff timing, snatch floating cosmic stars with positive and negative powers, and compete across the household on a centralized multi-player arcade leaderboard!

## Key Features

- **Tony the Galactic Sheep (`assets.js`)**: Expressive 60fps HTML5 Canvas character with 4-frame galloping animation, fluffy wool puffs, fluttering cosmic scarf, dynamic squash-and-stretch physics, size scaling (`0.68x` Mini Sheep to `1.38x` Giant Sheep), and glowing star-power auras.
- **Spacebar Precision Jump & Perfect Timing Bonus (`engine.js`)**:
  - Press **`Space`** (or **`ArrowUp`** / click-tap on the canvas) to jump.
  - Jumping inside the ground **Optimal Launch Zone** ahead of an approaching planet triggers a **⚡ Perfect Timing Bonus (`+150` to `+350 pts`)** and maximum apex boost.
- **Surprise Floating Collectible Stars (`STAR_CATALOG`)**:
  - **Positive Stars**:
    - 🌟 **Gold Supernova (`LARGE`, Gold)**: Instant **`+500 PTS`** bonus.
    - 💠 **Cyan Pulsar (`MEDIUM`, Cyan)**: **Higher Jumps (`1.25x` apex)** for `10s` + **`+250 PTS`**.
    - 💚 **Emerald Quasar (`MINI`, Emerald)**: **Mini Tony (`0.68x` size) & Wider Planet Gaps (`+30%`)** for `10s` + **`+300 PTS`**.
  - **Negative Hazard Stars**:
    -  Crimson Dwarf (`LARGE`, Crimson): **Big Tony (`1.38x` size), Tighter Planet Gaps (`-10%`)** for `8s` & **`-150 PTS`**.
    - 🟣 **Violet Hazard Nova (`COLOSSAL`, Violet)**: **Next 5 Planets in a Row Grow Larger (`+32%` radius)** & **`-300 PTS`**.
    - 🟠 **Amber Eclipse (`SMALL`, Amber)**: **Tighter Planet Gaps (`-9%`)** for `8s` & **`-200 PTS`**.
- **8 Solar System Planets & Per-Run Randomized Sizes**:
  - **Mercury**, **Venus**, **Earth**, **Mars**, **Jupiter**, **Saturn** (tilted ring system), **Uranus** (vertical ring system), and **Neptune** randomized on every run across `MINI`, `SMALL`, `MEDIUM`, `LARGE`, and `COLOSSAL` tiers (`+100` to `+1000+ pts`).
- **Centralised Multi-Player Household Leaderboard (`server.py` + `arcade.js`)**:
  - Backed by `GET / POST / DELETE /api/leaderboard` and persisted in `data/leaderboard.json`.
  - Syncs automatically at the start of every game run (and every 4 seconds in the background) so everyone playing across the house sees live high scores.
  - Automatically records each completed run's score to the server at Game Over and lets players enter or update their full name (`#arcade-player-name-input`, up to 24 characters).

## Quick Start

### Python Server (Recommended for Multi-Player Leaderboard)

```bash
python3 server.py --port 8765
# Open http://localhost:8765/index.html
```

### Docker Compose

```bash
docker compose up -d --build
# Open http://localhost:8765/index.html (scores persist in ./data/leaderboard.json)
```

## Controls

| Key | Action |
| :--- | :--- |
| `Space` / `ArrowUp` / Click | Jump / Launch Run (hit the green **Optimal Launch Zone** for **Perfect Timing Bonus!**) |
| `R` | Re-Randomize Planet Sizes / New Run |
| `H` | Toggle Hitbox & Jump Trajectory Guide |
| `M` | Toggle Retro Synth Audio |
| `P` | Pause / Resume |
