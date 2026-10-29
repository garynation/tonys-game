#!/usr/bin/env python3
"""Galactic Sheep — Hybrid On-Prem (Local JSON) + Cloud Run (Firestore) Leaderboard Server.

Uses the exact same codebase and container image for both:
  1. On-Prem / Linux Docker (`local` mode): Persists to `/app/data/leaderboard.json`
     with an in-memory RAM cache so `GET /api/leaderboard` does 0 disk reads.
  2. Google Cloud Run (`firestore` mode): Automatically activates when
     `FIRESTORE_PROJECT` is set (or `USE_FIRESTORE=true` / `K_SERVICE` on Cloud Run
     with a valid GCP project). Uses the Firestore v1 REST API + Cloud Run
     Metadata Server OAuth2 token (zero external pip dependencies) with
     optimistic concurrency (`updateTime` precondition retry) and an in-memory
     TTL read cache so it stays 100% inside the Firestore $0 free tier.
"""

import argparse
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("GALACTIC_SHEEP_DATA_DIR", str(BASE_DIR / "data")))
LEADERBOARD_FILE = DATA_DIR / "leaderboard.json"
MAX_TOP_SCORES = 10
MAX_STORED_SCORES = 50

# Firestore configuration (optional; auto-detected on Cloud Run or via env vars)
FIRESTORE_DATABASE = os.environ.get("FIRESTORE_DATABASE", "(default)")
FIRESTORE_COLLECTION = os.environ.get("FIRESTORE_COLLECTION", "galactic_sheep")
FIRESTORE_DOC_ID = os.environ.get("FIRESTORE_DOC_ID", "leaderboard")
FIRESTORE_API_BASE = os.environ.get(
    "FIRESTORE_API_BASE", "https://firestore.googleapis.com/v1"
).rstrip("/")
FIRESTORE_CACHE_TTL_SEC = float(os.environ.get("FIRESTORE_CACHE_TTL_SEC", "5.0"))

LEADERBOARD_LOCK = threading.Lock()

# In-memory cache shared across worker threads
_MEM_CACHE = {
    "scores": None,          # List[dict] sorted & ranked
    "loaded_at": 0.0,        # monotonic timestamp
    "backend": "local",      # 'local' or 'firestore'
    "project_id": "",        # resolved GCP project ID if using Firestore
    "doc_update_time": None, # Firestore document updateTime for atomic precondition
}

_TOKEN_CACHE = {
    "access_token": "",
    "expires_at": 0.0,
}

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
  entry_id = str(
      raw.get("id")
      or raw.get("runKey")
      or f"run-{int(datetime.now(timezone.utc).timestamp() * 1000)}-{idx}"
  )

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
      "updatedAt": raw.get("updatedAt") or now_iso(),
  }


def sort_and_rank(entries: list) -> list:
  dedup = {}
  for e in entries:
    if not isinstance(e, dict) or is_legacy_seed_entry(e):
      continue
    norm = normalize_entry(e)
    if norm["score"] <= 0:
      continue
    eid = norm["id"]
    if eid in dedup:
      prev = dedup[eid]
      norm["score"] = max(prev["score"], norm["score"])
      norm["planetsCleared"] = max(prev["planetsCleared"], norm["planetsCleared"])
      norm["perfectJumps"] = max(prev["perfectJumps"], norm["perfectJumps"])
      norm["starsCollected"] = max(prev["starsCollected"], norm["starsCollected"])
      if norm["biggestPlanet"].get("name") == "None" and prev["biggestPlanet"].get("name") != "None":
        norm["biggestPlanet"] = prev["biggestPlanet"]
    dedup[eid] = norm

  valid = list(dedup.values())
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


def merge_entry_into_list(existing: list, candidate: dict) -> list:
  merged_list = [dict(x) for x in existing if isinstance(x, dict)]
  updated_existing = False
  for i, item in enumerate(merged_list):
    if item.get("id") and item.get("id") == candidate["id"]:
      merged = dict(item)
      merged["name"] = candidate["name"]
      merged["playerName"] = candidate["playerName"]
      merged["initials"] = candidate["initials"]
      merged["score"] = max(int(item.get("score") or 0), candidate["score"])
      merged["planetsCleared"] = max(
          int(item.get("planetsCleared") or 0), candidate["planetsCleared"]
      )
      merged["perfectJumps"] = max(
          int(item.get("perfectJumps") or 0), candidate["perfectJumps"]
      )
      merged["starsCollected"] = max(
          int(item.get("starsCollected") or 0), candidate["starsCollected"]
      )
      if candidate["biggestPlanet"].get("name") != "None":
        merged["biggestPlanet"] = candidate["biggestPlanet"]
      merged["updatedAt"] = now_iso()
      merged_list[i] = merged
      updated_existing = True
      break

  if not updated_existing:
    merged_list.append(candidate)

  return sort_and_rank(merged_list)


# ---------------------------------------------------------------------------
# Local Disk Backend (`data/leaderboard.json`)
# ---------------------------------------------------------------------------

def ensure_storage_file() -> None:
  DATA_DIR.mkdir(parents=True, exist_ok=True)
  if not LEADERBOARD_FILE.exists():
    LEADERBOARD_FILE.write_text("[]\n", encoding="utf-8")


def load_local_file_unlocked() -> list:
  ensure_storage_file()
  try:
    raw = LEADERBOARD_FILE.read_text(encoding="utf-8")
    parsed = json.loads(raw)
    if isinstance(parsed, list):
      return sort_and_rank(parsed)
  except Exception:
    pass
  return []


def save_local_file_unlocked(entries: list) -> list:
  ensure_storage_file()
  ranked = sort_and_rank(entries)
  tmp_file = LEADERBOARD_FILE.with_suffix(".json.tmp")
  tmp_file.write_text(json.dumps(ranked, indent=2) + "\n", encoding="utf-8")
  tmp_file.replace(LEADERBOARD_FILE)
  return ranked


# ---------------------------------------------------------------------------
# Google Cloud Firestore REST Backend (Zero external dependencies)
# ---------------------------------------------------------------------------

def _fetch_metadata(path: str, timeout: float = 0.8) -> str:
  req = urllib.request.Request(
      f"http://metadata.google.internal/computeMetadata/v1/{path.lstrip('/')}",
      headers={"Metadata-Flavor": "Google"},
  )
  with urllib.request.urlopen(req, timeout=timeout) as resp:
    return resp.read().decode("utf-8").strip()


def resolve_firestore_project() -> str:
  explicit = (
      os.environ.get("FIRESTORE_PROJECT")
      or os.environ.get("GOOGLE_CLOUD_PROJECT")
      or os.environ.get("GCP_PROJECT")
      or ""
  ).strip()
  use_fs_flag = os.environ.get("USE_FIRESTORE", "").strip().lower()
  if use_fs_flag in ("0", "false", "no", "local"):
    return ""
  if explicit:
    return explicit
  # Auto-detect if running inside Google Cloud Run (`K_SERVICE` is always set on Cloud Run)
  if os.environ.get("K_SERVICE") or use_fs_flag in ("1", "true", "yes"):
    try:
      return _fetch_metadata("project/project-id")
    except Exception:
      return ""
  return ""


def get_firestore_access_token() -> str:
  env_token = os.environ.get("FIRESTORE_BEARER_TOKEN", "").strip()
  if env_token:
    return env_token
  now = time.monotonic()
  if _TOKEN_CACHE["access_token"] and now < _TOKEN_CACHE["expires_at"]:
    return _TOKEN_CACHE["access_token"]
  raw = _fetch_metadata("instance/service-accounts/default/token", timeout=1.5)
  data = json.loads(raw)
  token = data.get("access_token") or ""
  expires_in = float(data.get("expires_in") or 300.0)
  _TOKEN_CACHE["access_token"] = token
  _TOKEN_CACHE["expires_at"] = now + max(30.0, expires_in - 60.0)
  return token


def _firestore_doc_url(project_id: str) -> str:
  db = urllib.parse.quote(FIRESTORE_DATABASE, safe="()")
  col = urllib.parse.quote(FIRESTORE_COLLECTION, safe="")
  doc = urllib.parse.quote(FIRESTORE_DOC_ID, safe="")
  return f"{FIRESTORE_API_BASE}/projects/{project_id}/databases/{db}/documents/{col}/{doc}"


def firestore_load_unlocked(project_id: str) -> tuple[list, str | None]:
  """Returns (ranked_scores, doc_update_time). Raises on network/auth failure."""
  url = _firestore_doc_url(project_id)
  headers = {"Accept": "application/json"}
  token = get_firestore_access_token()
  if token:
    headers["Authorization"] = f"Bearer {token}"
  req = urllib.request.Request(url, headers=headers, method="GET")
  try:
    with urllib.request.urlopen(req, timeout=3.0) as resp:
      doc = json.loads(resp.read().decode("utf-8"))
      update_time = doc.get("updateTime")
      fields = doc.get("fields") or {}
      scores_json = (fields.get("scoresJson") or {}).get("stringValue") or "[]"
      parsed = json.loads(scores_json)
      return sort_and_rank(parsed if isinstance(parsed, list) else []), update_time
  except urllib.error.HTTPError as err:
    if err.code == 404:
      return [], None
    raise


def firestore_save_unlocked(
    project_id: str, entries: list, expected_update_time: str | None = None
) -> tuple[list, str | None]:
  """Writes ranked scores to Firestore with optional optimistic concurrency precondition."""
  ranked = sort_and_rank(entries)
  url = _firestore_doc_url(project_id)
  if expected_update_time:
    qs = urllib.parse.urlencode({"currentDocument.updateTime": expected_update_time})
    url = f"{url}?{qs}"

  payload = {
      "fields": {
          "scoresJson": {"stringValue": json.dumps(ranked)},
          "highScore": {"integerValue": str(ranked[0]["score"] if ranked else 0)},
          "totalEntries": {"integerValue": str(len(ranked))},
          "updatedAt": {"stringValue": now_iso()},
      }
  }
  body = json.dumps(payload).encode("utf-8")
  headers = {
      "Content-Type": "application/json",
      "Accept": "application/json",
  }
  token = get_firestore_access_token()
  if token:
    headers["Authorization"] = f"Bearer {token}"

  req = urllib.request.Request(url, data=body, headers=headers, method="PATCH")
  with urllib.request.urlopen(req, timeout=4.0) as resp:
    doc = json.loads(resp.read().decode("utf-8"))
    return ranked, doc.get("updateTime")


# ---------------------------------------------------------------------------
# Unified Hybrid Storage Manager (RAM Cache + Firestore / Local File)
# ---------------------------------------------------------------------------

def get_scores_unlocked(force_refresh: bool = False) -> list:
  now = time.monotonic()
  project_id = _MEM_CACHE["project_id"]

  if not project_id:
    if _MEM_CACHE["scores"] is None or force_refresh:
      _MEM_CACHE["scores"] = load_local_file_unlocked()
      _MEM_CACHE["loaded_at"] = now
    return list(_MEM_CACHE["scores"])

  # Firestore mode with in-memory TTL cache (avoids reading Firestore on every 4s poll)
  if (
      not force_refresh
      and _MEM_CACHE["scores"] is not None
      and (now - _MEM_CACHE["loaded_at"]) < FIRESTORE_CACHE_TTL_SEC
  ):
    return list(_MEM_CACHE["scores"])

  try:
    scores, update_time = firestore_load_unlocked(project_id)
    _MEM_CACHE["scores"] = scores
    _MEM_CACHE["doc_update_time"] = update_time
    _MEM_CACHE["loaded_at"] = now
    _MEM_CACHE["backend"] = "firestore"
    save_local_file_unlocked(scores)
    return list(scores)
  except Exception as exc:
    print(f"[GalacticSheep] Firestore read fallback to local file: {exc}", flush=True)
    if _MEM_CACHE["scores"] is None:
      _MEM_CACHE["scores"] = load_local_file_unlocked()
      _MEM_CACHE["loaded_at"] = now
    return list(_MEM_CACHE["scores"])


def upsert_score_unlocked(candidate: dict) -> list:
  project_id = _MEM_CACHE["project_id"]

  if project_id:
    # Optimistic concurrency loop across Cloud Run instances (up to 4 attempts)
    for attempt in range(4):
      try:
        if attempt > 0 or _MEM_CACHE["scores"] is None:
          base_scores, update_time = firestore_load_unlocked(project_id)
        else:
          base_scores = list(_MEM_CACHE["scores"])
          update_time = _MEM_CACHE["doc_update_time"]

        merged = merge_entry_into_list(base_scores, candidate)
        saved_scores, new_update_time = firestore_save_unlocked(
            project_id, merged, expected_update_time=update_time
        )
        _MEM_CACHE["scores"] = saved_scores
        _MEM_CACHE["doc_update_time"] = new_update_time
        _MEM_CACHE["loaded_at"] = time.monotonic()
        _MEM_CACHE["backend"] = "firestore"
        save_local_file_unlocked(saved_scores)
        return list(saved_scores)
      except urllib.error.HTTPError as err:
        if err.code in (400, 409, 412) and attempt < 3:
          # Precondition failed (concurrent write from another Cloud Run instance); re-read & retry
          continue
        print(f"[GalacticSheep] Firestore write fallback to local file: {err}", flush=True)
        break
      except Exception as exc:
        print(f"[GalacticSheep] Firestore write fallback to local file: {exc}", flush=True)
        break

  # Local file mode (or fallback)
  current = _MEM_CACHE["scores"] if _MEM_CACHE["scores"] is not None else load_local_file_unlocked()
  merged = merge_entry_into_list(current, candidate)
  saved = save_local_file_unlocked(merged)
  _MEM_CACHE["scores"] = saved
  _MEM_CACHE["loaded_at"] = time.monotonic()
  return list(saved)


def clear_scores_unlocked() -> list:
  project_id = _MEM_CACHE["project_id"]
  if project_id:
    try:
      _, new_update_time = firestore_save_unlocked(project_id, [], expected_update_time=None)
      _MEM_CACHE["doc_update_time"] = new_update_time
      _MEM_CACHE["backend"] = "firestore"
    except Exception as exc:
      print(f"[GalacticSheep] Firestore clear fallback to local file: {exc}", flush=True)

  save_local_file_unlocked([])
  _MEM_CACHE["scores"] = []
  _MEM_CACHE["loaded_at"] = time.monotonic()
  return []


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
    parsed = urllib.parse.urlparse(self.path)
    if parsed.path in ("/api/leaderboard", "/api/leaderboard/"):
      with LEADERBOARD_LOCK:
        all_scores = get_scores_unlocked()
        top_scores = all_scores[:MAX_TOP_SCORES]
        top_score = top_scores[0]["score"] if top_scores else 0
        backend = _MEM_CACHE["backend"]
      self._send_json(
          200,
          {
              "ok": True,
              "backend": backend,
              "scores": top_scores,
              "highScore": top_score,
              "totalEntries": len(all_scores),
              "updatedAt": now_iso(),
          },
      )
      return

    if parsed.path == "/api/health":
      self._send_json(
          200,
          {
              "ok": True,
              "service": "galactic-sheep",
              "backend": _MEM_CACHE["backend"],
              "firestoreProject": _MEM_CACHE["project_id"] or None,
              "updatedAt": now_iso(),
          },
      )
      return

    return super().do_GET()

  def do_POST(self):
    parsed = urllib.parse.urlparse(self.path)
    if parsed.path in ("/api/leaderboard/clear", "/api/leaderboard/reset"):
      with LEADERBOARD_LOCK:
        clear_scores_unlocked()
        backend = _MEM_CACHE["backend"]
      self._send_json(
          200,
          {
              "ok": True,
              "backend": backend,
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
          clear_scores_unlocked()
          backend = _MEM_CACHE["backend"]
        self._send_json(
            200,
            {
                "ok": True,
                "backend": backend,
                "scores": [],
                "highScore": 0,
                "totalEntries": 0,
                "updatedAt": now_iso(),
            },
        )
        return

      if is_legacy_seed_entry(data):
        with LEADERBOARD_LOCK:
          all_scores = get_scores_unlocked()
          top_scores = all_scores[:MAX_TOP_SCORES]
          top_score = top_scores[0]["score"] if top_scores else 0
          backend = _MEM_CACHE["backend"]
        self._send_json(
            200,
            {
                "ok": True,
                "backend": backend,
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
          all_scores = get_scores_unlocked()
          top_scores = all_scores[:MAX_TOP_SCORES]
          top_score = top_scores[0]["score"] if top_scores else 0
          backend = _MEM_CACHE["backend"]
        self._send_json(
            200,
            {
                "ok": True,
                "backend": backend,
                "entry": None,
                "scores": top_scores,
                "highScore": top_score,
                "totalEntries": len(all_scores),
                "updatedAt": now_iso(),
            },
        )
        return

      with LEADERBOARD_LOCK:
        all_scores = upsert_score_unlocked(candidate)
        top_scores = all_scores[:MAX_TOP_SCORES]
        top_score = top_scores[0]["score"] if top_scores else 0
        saved_entry = next((e for e in all_scores if e.get("id") == candidate["id"]), candidate)
        backend = _MEM_CACHE["backend"]

      self._send_json(
          200,
          {
              "ok": True,
              "backend": backend,
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
    parsed = urllib.parse.urlparse(self.path)
    if parsed.path in ("/api/leaderboard", "/api/leaderboard/"):
      with LEADERBOARD_LOCK:
        clear_scores_unlocked()
        backend = _MEM_CACHE["backend"]
      self._send_json(
          200,
          {
              "ok": True,
              "backend": backend,
              "scores": [],
              "highScore": 0,
              "totalEntries": 0,
              "updatedAt": now_iso(),
          },
      )
      return

    self._send_json(404, {"ok": False, "error": f"Unknown endpoint {parsed.path}"})


def init_storage_backend() -> None:
  with LEADERBOARD_LOCK:
    ensure_storage_file()
    project_id = resolve_firestore_project()
    _MEM_CACHE["project_id"] = project_id
    if project_id:
      _MEM_CACHE["backend"] = "firestore"
      scores = get_scores_unlocked(force_refresh=True)
    else:
      _MEM_CACHE["backend"] = "local"
      cleaned = load_local_file_unlocked()
      scores = save_local_file_unlocked(cleaned)
      _MEM_CACHE["scores"] = scores
      _MEM_CACHE["loaded_at"] = time.monotonic()


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

  init_storage_backend()

  os.chdir(BASE_DIR)
  ThreadingHTTPServer.allow_reuse_address = True
  server = ThreadingHTTPServer((args.host, args.port), GalacticSheepHTTPRequestHandler)
  print(
      f"Galactic Sheep server listening on http://{args.host}:{args.port} "
      f"(backend={_MEM_CACHE['backend']}, project={_MEM_CACHE['project_id'] or 'none'}, "
      f"local_file={LEADERBOARD_FILE})",
      flush=True,
  )
  server.serve_forever()


if __name__ == "__main__":
  main()
