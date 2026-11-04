# Galactic Sheep 🐑🪐⭐

A modern browser-based cosmic endless runner starring **Tony the Galactic Sheep** (`https://galacticsheep.co.uk`). Leap across randomized solar system planets with precision takeoff timing, snatch floating cosmic stars with positive and negative powers, and compete across the household or on Google Cloud Run on a centralized multi-player arcade leaderboard!

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
    - 🔴 **Crimson Dwarf (`LARGE`, Crimson)**: **Big Tony (`1.38x` size), Tighter Planet Gaps (`-10%`)** for `8s` & **`-150 PTS`**.
    - 🟣 **Violet Hazard Nova (`COLOSSAL`, Violet)**: **Next 5 Planets in a Row Grow Larger (`+32%` radius)** & **`-300 PTS`**.
    - 🟠 **Amber Eclipse (`SMALL`, Amber)**: **Tighter Planet Gaps (`-9%`)** for `8s` & **`-200 PTS`**.
- **8 Solar System Planets & Per-Run Randomized Sizes**:
  - **Mercury**, **Venus**, **Earth**, **Mars**, **Jupiter**, **Saturn** (tilted ring system), **Uranus** (vertical ring system), and **Neptune** randomized on every run across `MINI`, `SMALL`, `MEDIUM`, `LARGE`, and `COLOSSAL` tiers (`+100` to `+1000+ pts`).
- **Hardened Hybrid On-Prem + Google Cloud Firestore Leaderboard (`server.py` + `arcade.js`)**:
  - **On-Prem / Linux Docker (`local` mode)**: Automatically uses `/app/data/leaderboard.json` + an in-memory RAM read cache (`0` disk reads on `GET /api/leaderboard`).
  - **Google Cloud Run (`firestore` mode)**: Automatically activates when `FIRESTORE_PROJECT` is set (or when running on Cloud Run `K_SERVICE`). Uses the Firestore v1 REST API + Cloud Run Metadata Server OAuth2 token (zero external `pip` packages) with optimistic concurrency (`updateTime` precondition retry) and a 5-second in-memory read cache so it stays 100% inside the `$0/month` Firestore free tier.
  - **Security Hardening (`v8`)**: Non-root container execution (`UID 10001`), static file allowlist, `4 KB` request payload cap, per-IP rate limiting (`12 POSTs/min`), server-side score plausibility validation, one-way hashed public entry IDs, CSP / `X-Frame-Options: DENY` / `nosniff` headers, and Origin-restricted CORS (`https://galacticsheep.co.uk`, `https://www.galacticsheep.co.uk`, Cloud Run, and local LAN).

## Quick Start

### 1. On-Prem / Linux Box (Docker GHCR Container — Same Unified Image)

```bash
docker pull ghcr.io/garynation/tonys-game:latest && \
docker rm -f tonys-jumping-game 2>/dev/null || true && \
docker run -d \
  --name tonys-jumping-game \
  --restart unless-stopped \
  -p 8765:80 \
  -v galactic_sheep_data:/app/data \
  ghcr.io/garynation/tonys-game:latest
```

### 2. Google Cloud Run + Firestore + `galacticsheep.co.uk` (One-Shot Bootstrap)

In your personal [Google Cloud Shell](https://console.cloud.google.com/?cloudshell=true), run:

```bash
git clone https://github.com/garynation/tonys-game.git && cd tonys-game
export PROJECT_ID="your-personal-gcp-project-id"
bash deploy_gcp_setup.sh
```

This enables Cloud Run + Firestore (`eur3` free tier), creates a least-privilege service account (`galactic-sheep-sa` with `roles/datastore.user`), and deploys `galactic-sheep` with Denial-of-Wallet caps (`--max-instances=2 --memory=256Mi --cpu=1`).

## Controls

| Key | Action |
| :--- | :--- |
| `Space` / `ArrowUp` / Click | Jump / Launch Run (hit the green **Optimal Launch Zone** for **Perfect Timing Bonus!**) |
| `R` | Re-Randomize Planet Sizes / New Run |
| `M` | Toggle Retro Synth Audio |
| `P` | Pause / Resume |
