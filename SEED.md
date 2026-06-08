# SEED: teleprompter

> seed-format: 1

> **You're an AI agent reading this seed.** Your job: run `## Steps` Step 0
> (Interview), then execute every Step in order, then perform `## Verify`.
> When all Verify evidence is in hand print `SEED_RESULT=DONE`; on a blocker
> print `BLOCKED_REASON=<short reason>` and stop. Do not ask the human
> anything outside the single Interview turn.

## Goal

A fresh machine ends with a running **local teleprompter the operator can
record videos with**: the controller page on the computer, the display page on
a phone (or any second browser page) at the camera, and a script bank
(roteiro) loaded so that each **ENTER** in the sender terminal live-swaps the
text every display shows — one ENTER per take, no refresh, no login. This is
the CEO's proven recording workflow, packaged.

## Done

All observable, proven by `## Verify`:

- Backend (FastAPI + WebSocket) healthy on **:9000** — `GET /` returns
  `{"status":"ok", ...}`.
- Frontend (Vite + React) serves on **:9001** — controller at
  `http://<host>:9001/`, display at `http://<host>:9001/?mode=display`; both
  show a green **Online** connection indicator with **zero frontend env
  config** (the WS URL is derived from the page's hostname).
- `POST /api/content` with the generated `CONTENT_API_KEY` swaps the script
  text on every connected client **live** (an open WebSocket receives a
  `state:sync` carrying the new text, position reset to 0). Wrong key → 401;
  unset key in backend `.env` → 503.
- `scripts/send_roteiros.py` parses the bundled `sample-roteiro.md` into
  **5 pieces** (2 hooks, 1 body, 2 CTAs) and the ENTER-advance loop swaps the
  displayed piece live each time.
- The bundled verify harness exits **0**:
  `cd $TP_WORKSPACE/backend && uv run python ../scripts/verify_teleprompter.py`
- Idempotent: re-running this seed where it already succeeded verifies state
  (reuses the existing `.env`, restarts services if needed) instead of
  breaking it.

## Inputs

| name | required | default | detect | ask |
|---|---|---|---|---|
| `seeds/teleprompter/` bundle | yes | seed-supplied | `[ -f <seed-dir>/teleprompter/backend/api/main.py ] && [ -f <seed-dir>/teleprompter/sample-roteiro.md ]` | "The source bundle ships next to this seed file in the seedlab checkout (`seeds/teleprompter/`). If absent, the seedlab checkout is incomplete — obtain the full `seeds/` directory from whoever delivered this seed (repo `delattre1/seedlab` is private; the bundle travels with the seed, it is never fetched from the network)." |
| `TP_WORKSPACE` | no | `$HOME/teleprompter` | `[ -n "${TP_WORKSPACE:-}" ] \|\| true` | "Install target directory. Created if missing. If it already exists, the prior-install row decides." |
| `CONTENT_API_KEY` | yes | generated | `[ -s "$TP_WORKSPACE/backend/.env" ] && grep -q '^CONTENT_API_KEY=..' "$TP_WORKSPACE/backend/.env"` | "Auto-generated at install (`openssl rand -hex 16`) and written to `backend/.env` (chmod 600). Not a human-provided secret — only confirm whether to reuse an existing one on re-install." |
| `uv` on PATH | yes | none | `command -v uv >/dev/null 2>&1` | "Astral's uv manages the backend env AND the Python toolchain (it downloads Python ≥3.11 itself if the host lacks it). Install: `curl -LsSf https://astral.sh/uv/install.sh \| sh` (macOS/Linux)." |
| Node.js ≥ 18 + npm | yes | none | `node -e 'process.exit(process.versions.node.split(".")[0]>=18?0:1)' 2>/dev/null` | "Node 18+ for the Vite frontend. macOS: `brew install node`. Debian/Ubuntu: `curl -fsSL https://deb.nodesource.com/setup_22.x \| sudo -E bash - && sudo apt install -y nodejs`." |
| Ports 9000 + 9001 free | yes | none | `! (lsof -i :9000 -i :9001 2>/dev/null \| grep -q LISTEN)` | "Backend binds :9000, frontend :9001 — both hardcoded contracts (the frontend derives the WS URL as `ws://<page-hostname>:9000/ws`). Stop whatever holds them, or abort." |
| Prior `$TP_WORKSPACE` install | conditional | preserve `.env`, refresh code | `[ -d "$TP_WORKSPACE" ]` | "A workspace already exists. Default: refresh source from the bundle, PRESERVE the existing `backend/.env` (key keeps working for any operator muscle memory), re-run Verify. Say 'reset' to wipe it including the key." |
| LAN IP (phone display) | no | auto-detected | — | "Only needed to put the display on a physical phone: the seed prints `http://<lan-ip>:9001/?mode=display` at the end. Verification itself uses local browser pages — no phone required." |

Substrate assumptions: macOS (Darwin) or Linux, internet for `uv sync` /
`npm install` package downloads. No accounts, no API keys from the operator,
no Docker required.

## Components

| Component | Role | Source |
|---|---|---|
| `backend/` | FastAPI + native WebSocket state server. Single shared state; `POST /api/content` (X-API-Key) swaps content + broadcasts `state:sync` to all clients. | Bundled: `seeds/teleprompter/backend/`. Origin: private `delattre1/video-producing` monorepo (`tp_flow/teleprompter`, commit `aace0de`), SaaS accretions (Supabase JWT, AbacatePay, marketing pages) stripped. |
| `frontend/` | Vite + React + TS + Tailwind teleprompter UI. Controller edits/controls; display renders read-only and auto-syncs. WS URL always derived from page hostname — no env file. | Bundled: `seeds/teleprompter/frontend/`. Same origin/strip. `npm run build` passes clean (tsc + vite). |
| `scripts/send_roteiros.py` | The ENTER-per-take recording flow. Parses banco-de-gravação roteiro markdown, sends one piece per ENTER. Stdlib-only; key auto-read from `backend/.env` or `CONTENT_API_KEY` env. | Bundled: `seeds/teleprompter/scripts/send_roteiros.py`. |
| `scripts/verify_teleprompter.py` | Acceptance harness (exit code = truth). Proves health, parse fixture, and the live `state:sync` contract for piece-load + ENTER-advance over an open WebSocket. | Bundled: `seeds/teleprompter/scripts/verify_teleprompter.py`. |
| `sample-roteiro.md` | 5-piece sample recording bank — parser fixture AND demo content. | Bundled: `seeds/teleprompter/sample-roteiro.md`. |

## Steps

The agent may substitute equivalent commands but must preserve the contracts:
**ports 9000/9001; `.env` chmod 600; key never echoed to logs; the bundle is
the source of truth (do not re-derive code from the private monorepo).**

### Step 0: Interview

Run `detect` for every `## Inputs` row. Send ONE consolidated message listing
✓ satisfied inputs, ✗ missing tools with their `ask` text, and ⚠ prior-install
state (existing `$TP_WORKSPACE`: preserve-key default vs reset). After the
reply, run everything below autonomously to `SEED_RESULT=DONE` or one
`BLOCKED_REASON=` line.

### Step 1: Materialize the bundle

*What:* copy `seeds/teleprompter/` → `$TP_WORKSPACE`. *Why:* the install must
not depend on the seedlab checkout staying around.

```sh
mkdir -p "$TP_WORKSPACE"
cp -R <seed-dir>/teleprompter/. "$TP_WORKSPACE"/
rm -rf "$TP_WORKSPACE"/backend/.venv "$TP_WORKSPACE"/frontend/node_modules "$TP_WORKSPACE"/frontend/dist
```
(On a prior install with preserve: keep the existing `backend/.env` aside and
restore it after the copy.)

### Step 2: Backend env + deps

*What:* generate the content API key and sync the Python env. *Why:* the
`/api/content` endpoint returns 503 until `CONTENT_API_KEY` is set — this is
the seed closing the fresh-install gap, not the operator's job.

```sh
cd "$TP_WORKSPACE/backend"
[ -s .env ] || printf 'LOCAL_MODE=true\nCONTENT_API_KEY=%s\n' "$(openssl rand -hex 16)" > .env
chmod 600 .env
uv sync
```

### Step 3: Frontend deps

```sh
cd "$TP_WORKSPACE/frontend"
npm install
```
*Why:* dev-mode Vite serves the UI on :9001. No `.env` is needed — the
frontend has no configurable env at all.

### Step 4: Start both services (supervised)

```sh
cd "$TP_WORKSPACE/backend" && nohup uv run uvicorn api.main:app --host 0.0.0.0 --port 9000 > /tmp/teleprompter-backend.log 2>&1 &
cd "$TP_WORKSPACE/frontend" && nohup npm run dev > /tmp/teleprompter-frontend.log 2>&1 &
```
Wait until `curl -sf http://localhost:9000/` and
`curl -sf http://localhost:9001/` both succeed (give Vite ~10s). *Why
`--host 0.0.0.0`:* the phone on the LAN must reach both ports.

### Step 5: Load the sample roteiro (one piece)

*What:* prove the recording flow the way the operator runs it.

```sh
cd "$TP_WORKSPACE" && printf 'q\n' | python3 scripts/send_roteiros.py
```
Expect `Total de peças: 5` and `✅ Enviado ao teleprompter`. *Why `printf`:* 
sends piece 1 then quits — the interactive ENTER loop is exercised fully by
Verify and by the operator at recording time.

### Step 6: Print the operator card

Print for the human: controller URL, display URL with the LAN IP
(`http://<lan-ip>:9001/?mode=display`), and the recording command
(`python3 scripts/send_roteiros.py [your-roteiro.md]` — ENTER advances takes;
in the controller use **Skip Calibration → Start Presenting** to enter
recording view).

## Verify

Two layers; **both** are required when a browser is obtainable, layer 1 alone
is the minimum bar otherwise.

**1. Acceptance harness (exit code = truth):**

```sh
cd "$TP_WORKSPACE/backend" && uv run python ../scripts/verify_teleprompter.py
```

Exit 0 = backend healthy, frontend serving, sample parses to 5 pieces, and an
**open WebSocket observes the live `state:sync`** for piece-1 load and the
piece-2 ENTER advance — the exact broadcast every display renders from.

**2. Agent-driven browser observation (the user's eyes):** open
`http://localhost:9001/?mode=display` and `http://localhost:9001/` in a real
browser (install one if needed, e.g. `npx playwright install chromium` or a
headless Chrome already on the host). Observe and capture as evidence:

- both pages show the green **Online** indicator;
- run `printf '\nq\n' | python3 scripts/send_roteiros.py` and watch the
  display text swap pieces **live, with no refresh**;
- on the controller: **Skip Calibration → Start Presenting** renders the
  presentation view (Play / Reset / speed / font / countdown), and a piece
  sent while presenting swaps the text **without leaving presentation mode**;
- screenshot the display showing a sample piece.

A pass you did not observe is not a pass. If layer 2 is impossible (no
browser installable), say so explicitly in the report next to the layer-1
proof.

## Failure modes

**Symptom: display/controller shows "Offline" (red indicator).**
- Detect: `curl -sf http://localhost:9000/` fails, or the page was opened via
  a hostname that can't reach port 9000 (the WS URL is
  `ws://<page-hostname>:9000/ws`).
- Fix: start the backend (Step 4); open the page via the same host/IP that
  serves both ports; check `/tmp/teleprompter-backend.log`.

**Symptom: `POST /api/content` returns 503 "Content API not configured".**
- Detect: `grep -c '^CONTENT_API_KEY=..' "$TP_WORKSPACE/backend/.env"` is 0,
  or backend was started from a different cwd than `$TP_WORKSPACE/backend`
  (pydantic-settings reads `.env` relative to cwd).
- Fix: Step 2; restart the backend **from** `$TP_WORKSPACE/backend`.

**Symptom: `POST /api/content` returns 401.**
- Detect: sender key ≠ backend key (stale env var `CONTENT_API_KEY` shadowing
  the `.env` value).
- Fix: `unset CONTENT_API_KEY` so the script falls back to `backend/.env`,
  or set it to the `.env` value.

**Symptom: port already in use on 9000/9001.**
- Detect: `lsof -i :9000 -i :9001 | grep LISTEN`.
- Fix: kill the stale process (a previous run of this seed:
  `pkill -f 'uvicorn api.main:app'; pkill -f vite`) or free the port.

**Symptom: controller's "Start Recording" / calibration errors.**
- Detect: clicking **Start Recording** in the speed-training panel fails or
  hangs — it posts audio to the CEO's external STT service
  (`stt.tpflow.ngrok.app`), which a fresh install cannot reach.
- Fix: not a seed defect — click **Skip Calibration**; the fallback pacing
  profile is the default and fully works. Presenting is gated on
  calibrate-OR-skip, so Skip is the supported path.

**Symptom: `vite: command not found` / esbuild platform errors after copying
a workspace between machines.**
- Detect: `npm run dev` fails inside `$TP_WORKSPACE/frontend`.
- Fix: `rm -rf node_modules && npm install` (never copy `node_modules`
  across hosts — Step 1 deletes it for this reason).

## Cleanup

```sh
pkill -f 'uvicorn api.main:app' 2>/dev/null; pkill -f 'vite' 2>/dev/null
rm -rf "$TP_WORKSPACE"
```
