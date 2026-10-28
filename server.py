#!/usr/bin/env python3
"""Galactic Sheep — Centralised Multi-Player Leaderboard & Static Web Server.

Serves the Galactic Sheep game files with strict no-cache headers and provides a
thread-safe, persistent multi-player leaderboard REST API at `/api/leaderboard`
backed by `data/leaderboard.json`.
"""

import argparse
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import threading
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("GALACTIC_SHEEP_DATA_DIR", str(BASE_DIR / "data")))
LEADERBOARD_FILE = DATA_DIR / "leaderboard.json"
MAX_TOP_SCORES = 10
MAX_STORED_SCORES = 50

LEADERBOARD_LOCK = threading.Lock()

LEGACY_SEED_PAIRS = {
    ("TNY", 14850),
    ("SHP", 11400),
    ("JUP", 9250),
    ("SAT", 7600),
    ("MAR", 6150),
    ("BAH", 4900),
    ("WOL", 3450),
    ("SOL", 2100),
}


def now_iso() -> str:
  return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def today_str() -> str:
  return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def is_legacy_seed_entry(entry: dict) -> bool:
  if not isinstance(entry, dict):
    return True
  if entry.get("isSeed") or entry.get("seeded"):
    return True
  entry_id = str(entry.get("id") or "")
  if entry_id.startswith("seed-"):
    return True
  raw_name = str(
      entry.get("name") or entry.get("playerName") or entry.get("initials") or ""
  ).strip().upper()
  try:
    score_val = int(float(entry.get("score") or 0))
  except (ValueError, TypeError):
    score_val = 0
  return (raw_name, score_val) in LEGACY_SEED_PAIRS


def normalize_biggest_planet(bp, fallback_obj=None) -> dict:
  src = fallback_obj if isinstance(fallback_obj, dict) else bp
  if not src or src == "None":
    return {"name": "None", "diameter": 0, "radius": 0, "tier": "MINI"}
  if isinstance(src, str):
    match = re.match(
        r"^([^(]+)\((MINI|SMALL|MEDIUM|LARGE|COLOSSAL)?[^0-9]*(\d+)?",
        src,
        re.IGNORECASE,
    )
    if match:
      name = (match.group(1) or "").strip() or src
      tier = (match.group(2) or "MEDIUM").upper()
      diameter = int(match.group(3) or 0)
      radius = round(diameter / 2) if diameter else 0
      return {"name": name, "diameter": diameter, "radius": radius, "tier": tier}
    return {"name": src.strip(), "diameter": 0, "radius": 0, "tier": "MEDIUM"}
  if isinstance(src, dict):
    name = str(src.get("name") or src.get("planetName") or "Planet").strip()
    try:
      radius = int(float(src.get("radius") or 0))
    except (ValueError, TypeError):
      radius = 0
    try:
      diameter = int(float(src.get("diameter") or (radius * 2 if radius else 0)))
    except (ValueError, TypeError):
      diameter = radius * 2
    if not radius and diameter:
      radius = round(diameter / 2)
    tier = str(src.get("tier") or src.get("sizeTier") or "MEDIUM").upper()
    return {"name": name, "diameter": diameter, "radius": radius, "tier": tier}
  return {"name": "None", "diameter": 0, "radius": 0, "tier": "MINI"}


def normalize_player_name(raw_name) -> str:
  cleaned = re.sub(r"[\x00-\x1f\x7f]+", "", str(raw_name or "")).strip()
  cleaned = re.sub(r"\s+", " ", cleaned)[:24]
  return cleaned if cleaned else "Tony"


def normalize_entry(raw: dict, idx: int = 0) -> dict:
  name = normalize_player_name(
      raw.get("name") or raw.get("playerName") or raw.get("initials") or "Tony"
  )
  try:
    score = max(0, int(float(raw.get("score") or 0)))
  except (ValueError, TypeError):
    score = 0
  try:
    planets_cleared = max(0, int(float(raw.get("planetsCleared") or 0)))
  except (ValueError, TypeError):
    planets_cleared = 0
  try:
    perfect_jumps = max(0, int(float(raw.get("perfectJumps") or 0)))
  except (ValueError, TypeError):
    perfect_jumps = 0
  try:
    stars_collected = max(0, int(float(raw.get("starsCollected") or 0)))
  except (ValueError, TypeError):
    stars_collected = 0

  bp = normalize_biggest_planet(raw.get("biggestPlanet"), raw.get("biggestPlanetObj"))
  entry_id = str(raw.get("id") or raw.get("runKey") or f"run-{int(datetime.now(timezone.utc).timestamp() * 1000)}-{idx}")

  return {
      "id": entry_id,
      "rank": idx + 1,
      "name": name,
      "playerName": name,
      "initials": name,
      "score": score,
      "planetsCleared": planets_cleared,
      "perfectJumps": perfect_jumps,
      "starsCollected": stars_collected,
      "biggestPlanet": bp,
      "date": str(raw.get("date") or today_str())[:10],
      "updatedAt": now_iso(),
  }


def sort_and_rank(entries: list) -> list:
  valid = [e for e in entries if isinstance(e, dict) and not is_legacy_seed_entry(e) and int(e.get("score") or 0) > 0]
  valid.sort(
      key=lambda item: (
          int(item.get("score") or 0),
          int(item.get("planetsCleared") or 0),
          int(item.get("perfectJumps") or 0),
      ),
      reverse=True,
  )
  ranked = []
  for idx, item in enumerate(valid[:MAX_STORED_SCORES]):
    copy_item = dict(item)
    copy_item["rank"] = idx + 1
    ranked.append(copy_item)
  return ranked


def ensure_storage_file() -> None:
  DATA_DIR.mkdir(parents=True, exist_ok=True)
  if not LEADERBOARD_FILE.exists():
    LEADERBOARD_FILE.write_text("[]\n", encoding="utf-8")


def load_scores_unlocked() -> list:
  ensure_storage_file()
  try:
    raw = LEADERBOARD_FILE.read_text(encoding="utf-8")
    parsed = json.loads(raw)
    if isinstance(parsed, list):
      normalized = [normalize_entry(item, i) for i, item in enumerate(parsed) if isinstance(item, dict) and not is_legacy_seed_entry(item)]
      return sort_and_rank(normalized)
  except Exception:
    pass
  return []


def save_scores_unlocked(entries: list) -> list:
  ensure_storage_file()
  ranked = sort_and_rank(entries)
  tmp_file = LEADERBOARD_FILE.with_suffix(".json.tmp")
  tmp_file.write_text(json.dumps(ranked, indent=2) + "\n", encoding="utf-8")
  tmp_file.replace(LEADERBOARD_FILE)
  return ranked


class GalacticSheepHTTPRequestHandler(SimpleHTTPRequestHandler):
  """Serves static assets and the `/api/leaderboard` multi-player REST endpoints."""

  def __init__(self, *args, **kwargs):
    super().__init__(*args, directory=str(BASE_DIR), **kwargs)

  def end_headers(self):
    self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
    self.send_header("Pragma", "no-cache")
    self.send_header("Expires", "0")
    self.send_header("Access-Control-Allow-Origin", "*")
    self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
    self.send_header("Access-Control-Allow-Headers", "Content-Type")
    super().end_headers()

  def _send_json(self, status_code: int, payload: dict) -> None:
    body = (json.dumps(payload) + "\n").encode("utf-8")
    self.send_response(status_code)
    self.send_header("Content-Type", "application/json; charset=utf-8")
    self.send_header("Content-Length", str(len(body)))
    self.end_headers()
    self.wfile.write(body)

  def do_OPTIONS(self):
    self.send_response(204)
    self.end_headers()

  def do_GET(self):
    parsed = urlparse(self.path)
    if parsed.path in ("/api/leaderboard", "/api/leaderboard/"):
      with LEADERBOARD_LOCK:
        all_scores = load_scores_unlocked()
        top_scores = all_scores[:MAX_TOP_SCORES]
        top_score = top_scores[0]["score"] if top_scores else 0
      self._send_json(
          200,
          {
              "ok": True,
              "scores": top_scores,
              "highScore": top_score,
              "totalEntries": len(all_scores),
              "updatedAt": now_iso(),
          },
      )
      return

    if parsed.path == "/api/health":
      self._send_json(200, {"ok": True, "service": "galactic-sheep", "updatedAt": now_iso()})
      return

    return super().do_GET()

  def do_POST(self):
    parsed = urlparse(self.path)
    if parsed.path in ("/api/leaderboard/clear", "/api/leaderboard/reset"):
      with LEADERBOARD_LOCK:
        save_scores_unlocked([])
      self._send_json(
          200,
          {
              "ok": True,
              "scores": [],
              "highScore": 0,
              "totalEntries": 0,
              "updatedAt": now_iso(),
          },
      )
      return

    if parsed.path in ("/api/leaderboard", "/api/leaderboard/"):
      content_len = int(self.headers.get("Content-Length") or 0)
      raw_body = self.rfile.read(content_len).decode("utf-8") if content_len > 0 else "{}"
      try:
        data = json.loads(raw_body) if raw_body.strip() else {}
      except json.JSONDecodeError:
        self._send_json(400, {"ok": False, "error": "Invalid JSON payload"})
        return

      if not isinstance(data, dict):
        self._send_json(400, {"ok": False, "error": "Payload must be a JSON object"})
        return

      if data.get("action") in ("clear", "reset") or data.get("reset") is True:
        with LEADERBOARD_LOCK:
          save_scores_unlocked([])
        self._send_json(
            200,
            {
                "ok": True,
                "scores": [],
                "highScore": 0,
                "totalEntries": 0,
                "updatedAt": now_iso(),
            },
        )
        return

      if is_legacy_seed_entry(data):
        with LEADERBOARD_LOCK:
          all_scores = load_scores_unlocked()
          top_scores = all_scores[:MAX_TOP_SCORES]
          top_score = top_scores[0]["score"] if top_scores else 0
        self._send_json(
            200,
            {
                "ok": True,
                "ignoredSeed": True,
                "scores": top_scores,
                "highScore": top_score,
                "totalEntries": len(all_scores),
                "updatedAt": now_iso(),
            },
        )
        return

      candidate = normalize_entry(data)
      if candidate["score"] <= 0:
        with LEADERBOARD_LOCK:
          all_scores = load_scores_unlocked()
          top_scores = all_scores[:MAX_TOP_SCORES]
          top_score = top_scores[0]["score"] if top_scores else 0
        self._send_json(
            200,
            {
                "ok": True,
                "entry": None,
                "scores": top_scores,
                "highScore": top_score,
                "totalEntries": len(all_scores),
                "updatedAt": now_iso(),
            },
        )
        return

      with LEADERBOARD_LOCK:
        existing = load_scores_unlocked()
        updated_existing = False
        for i, item in enumerate(existing):
          if item.get("id") and item.get("id") == candidate["id"]:
            merged = dict(item)
            merged["name"] = candidate["name"]
            merged["playerName"] = candidate["playerName"]
            merged["initials"] = candidate["initials"]
            merged["score"] = max(int(item.get("score") or 0), candidate["score"])
            merged["planetsCleared"] = max(int(item.get("planetsCleared") or 0), candidate["planetsCleared"])
            merged["perfectJumps"] = max(int(item.get("perfectJumps") or 0), candidate["perfectJumps"])
            merged["starsCollected"] = max(int(item.get("starsCollected") or 0), candidate["starsCollected"])
            if candidate["biggestPlanet"].get("name") != "None":
              merged["biggestPlanet"] = candidate["biggestPlanet"]
            merged["updatedAt"] = now_iso()
            existing[i] = merged
            updated_existing = True
            break

        if not updated_existing:
          existing.append(candidate)

        all_scores = save_scores_unlocked(existing)
        top_scores = all_scores[:MAX_TOP_SCORES]
        top_score = top_scores[0]["score"] if top_scores else 0
        saved_entry = next((e for e in all_scores if e.get("id") == candidate["id"]), candidate)

      self._send_json(
          200,
          {
              "ok": True,
              "entry": saved_entry,
              "rank": saved_entry.get("rank"),
              "madeTop10": bool(saved_entry.get("rank") and saved_entry["rank"] <= MAX_TOP_SCORES),
              "scores": top_scores,
              "highScore": top_score,
              "totalEntries": len(all_scores),
              "updatedAt": now_iso(),
          },
      )
      return

    self._send_json(404, {"ok": False, "error": f"Unknown endpoint {parsed.path}"})

  def do_DELETE(self):
    parsed = urlparse(self.path)
    if parsed.path in ("/api/leaderboard", "/api/leaderboard/"):
      with LEADERBOARD_LOCK:
        save_scores_unlocked([])
      self._send_json(
          200,
          {
              "ok": True,
              "scores": [],
              "highScore": 0,
              "totalEntries": 0,
              "updatedAt": now_iso(),
          },
      )
      return

    self._send_json(404, {"ok": False, "error": f"Unknown endpoint {parsed.path}"})


def main():
  parser = argparse.ArgumentParser(description="Galactic Sheep Centralised Leaderboard & Web Server")
  parser.add_argument(
      "--port",
      type=int,
      default=int(os.environ.get("PORT", "8765")),
      help="Port to listen on (default: 8765 or $PORT)",
  )
  parser.add_argument(
      "--host",
      type=str,
      default="0.0.0.0",
      help="Host interface to bind (default: 0.0.0.0)",
  )
  args = parser.parse_args()

  with LEADERBOARD_LOCK:
    ensure_storage_file()
    cleaned = load_scores_unlocked()
    save_scores_unlocked(cleaned)

  os.chdir(BASE_DIR)
  ThreadingHTTPServer.allow_reuse_address = True
  server = ThreadingHTTPServer((args.host, args.port), GalacticSheepHTTPRequestHandler)
  print(
      f"Galactic Sheep server listening on http://{args.host}:{args.port} "
      f"(leaderboard={LEADERBOARD_FILE})",
      flush=True,
  )
  server.serve_forever()


if __name__ == "__main__":
  main()
