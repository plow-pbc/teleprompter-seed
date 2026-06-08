# Teleprompter — standalone product seed

**Teleprompter** is the CEO's proven video-recording workflow, packaged: a local, no-auth,
multi-device teleprompter. The **controller** runs on your computer, the **display** runs on a
phone (or any second browser page) at the camera, and a script bank (*roteiro*) is loaded so
that each **ENTER** in the sender terminal live-swaps the text on every connected display — one
ENTER per take, no refresh, no login.

This repo is **one file that matters**: [`SEED.md`](SEED.md) — a self-contained, one-shot
**SEED**: a complete product specification (the *recipe*) plus the app **bundle** it installs.
Hand it to a coding agent; the agent "hydrates" it — installing and running the whole
FastAPI + Vite/React app until the seed's `## Verify` passes.

> Unlike a from-scratch seed, this one ships its application source alongside the spec in
> [`teleprompter/`](teleprompter/) — the seed materializes that bundle into a workspace,
> installs deps, and self-verifies. The bundle travels **with** the seed; nothing is fetched
> from a private network.

## Use it

**Recommended:** paste `SEED.md` into your Claude Code session (host or container), with this
repo's `teleprompter/` bundle sitting next to it, and say:

> *Read this seed and execute it.*

The seed's own `## Steps` do everything: a one-turn **Interview** (detects `uv`, Node 18+, free
ports 9000/9001), then autonomously materialize the `teleprompter/` bundle into
`$TP_WORKSPACE` (`~/teleprompter` by default), generate a `backend/.env` (`CONTENT_API_KEY`,
chmod 600), `uv sync`, `npm install`, start both services, load the sample roteiro, and print an
operator card. No accounts, no operator-supplied API keys, no Docker required.

## What "done" looks like

- Backend (FastAPI + WebSocket) healthy on **:9000** — `GET /` returns `{"status":"ok", ...}`.
- Frontend (Vite + React) serving on **:9001** — controller at `http://<host>:9001/`, display at
  `http://<host>:9001/?mode=display`; both show a green **Online** indicator with **zero
  frontend env config** (the WS URL is derived from the page hostname).
- `POST /api/content` with the generated key swaps the script text on every connected client
  **live** over an open WebSocket (`state:sync`, position reset to 0). Wrong key → 401; unset → 503.
- `scripts/send_roteiros.py` parses `sample-roteiro.md` into **5 pieces** (2 hooks, 1 body,
  2 CTAs); each ENTER advances the displayed piece live.
- The bundled acceptance harness exits **0**:
  `cd $TP_WORKSPACE/backend && uv run python ../scripts/verify_teleprompter.py`

## Self-contained & proven

A blind, zero-context agent on a clean slate — fresh device-login auth, no minted tokens, no
pre-baked product state — followed this seed and reached `SEED_RESULT=DONE` in one shot,
independently re-verified, with zero fixes needed. Verification is two layers: a Layer-1
acceptance harness (exit code = truth: health, fixture parse to 5 pieces, and the live
`state:sync` contract for piece-load + ENTER-advance over an open WebSocket), and a Layer-2
real-browser observation (both pages Online, live no-reload swap, Skip Calibration → Start
Presenting, piece swap while presenting).

## Automated verify harness

[`verify/hydrate-and-verify.sh`](verify/hydrate-and-verify.sh) runs the whole stranger flow in a
throwaway `node:20-slim` container (needs Docker + a `claude` CLI with auth): it hands `SEED.md`
plus the `teleprompter/` bundle to a fresh blind agent, which installs and runs the app and the
seed's `## Verify`, then prints the seed's final `SEED_RESULT=` line. See the script header for
usage.

## A note on calibration

The controller has an optional speed-calibration step that posts audio to the CEO's external STT
service, which a fresh install cannot reach. This is **not** a defect: presenting is gated on
calibrate-**or**-skip, and **Skip Calibration** is the fully-supported path with a working
default pacing profile. The seed documents this in its `## Failure modes`.

## Provenance

The application bundle was stripped from the private `delattre1/video-producing` monorepo
(`tp_flow/teleprompter`, commit `aace0de`) — Supabase auth, AbacatePay payments and marketing
pages removed. The seed has **zero** coupling to that monorepo or to any Plow service; the
bundle here is the source of truth.
