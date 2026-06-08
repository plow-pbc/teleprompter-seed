# Teleprompter — intent-spec product seed

**Teleprompter** is the CEO's proven video-recording workflow, packaged: a local, no-auth,
multi-device teleprompter. The **controller** runs on your computer, the **display** runs on a
phone (or any second browser page) at the camera, and a script bank (*roteiro*) is loaded so
that each **ENTER** in the sender terminal live-swaps the text on every connected display — one
ENTER per take, no refresh, no login.

This repo is **one file that matters**: [`SEED.md`](SEED.md) — a self-contained
**intent-spec SEED**. It contains a complete product specification and **zero application
source**: the data model, the WebSocket/REST wire contract, the rendering math, every UI
constant and color, and the roteiro format — all pinned by **absolute value**. Hand it to a
coding agent and it **builds the whole FastAPI + Vite/React app from the spec alone**, then
authors and runs the seed's own `## Verify` until it passes.

> **The spec is the asset — there is no shipped bundle.** Earlier this repo carried the app
> source in a `teleprompter/` directory and the seed merely *installed* it. That has been
> removed: a true seed is the *recipe*, not the dish. `SEED.md` now stands alone, and a blind
> agent reconstructs the product from it with no reference code anywhere.

## Use it

**Recommended:** paste `SEED.md` into your Claude Code session (host or container) and say:

> *Read this seed and execute it.*

The seed's own `## Steps` do everything: a one-turn **Interview** (detects `uv`, Node 18+, free
ports 9000/9001), then autonomously scaffolds the backend, frontend, and roteiro sender **from
the spec**, generates a `backend/.env` (`CONTENT_API_KEY`, chmod 600), `uv sync`,
`npm install`, starts both services, smoke-tests the sample roteiro, and prints an operator
card. No accounts, no operator-supplied API keys, no Docker required.

## What "done" looks like

- Backend (FastAPI + WebSocket) healthy on **:9000** — `GET /` returns `{"status":"ok", ...}`.
- Frontend (Vite + React) serving on **:9001** — controller at `http://<host>:9001/`, display at
  `http://<host>:9001/?mode=display`; both show a green **Online** indicator with **zero
  frontend env config** (the WS URL is derived from the page hostname).
- `POST /api/content` with the generated key swaps the script text on every connected client
  **live** over an open WebSocket (`state:sync`, position reset to 0). Wrong key → 401; unset →
  503; empty content → 422.
- The roteiro sender parses `sample-roteiro.md` into **5 pieces** (2 hooks, 1 body, 2 CTAs);
  each ENTER advances the displayed piece live — selecting a script piece modifies the
  teleprompter content in real time.
- A self-authored acceptance harness (Layer 1, exit code = truth) and a browser fidelity pass
  (Layer 2, computed-style/DOM vs the spec's §11/§7 absolute values) both pass against only the
  build's own `localhost` — no reference instance.

## Self-contained & proven (blind, from spec alone)

A blind, zero-context agent — handed **only `SEED.md`**, with **no reference implementation
anywhere** — rebuilt the product from scratch and reached `SEED_RESULT=DONE` **in one shot**,
independently re-verified, with zero fixes. Verification is two layers, both self-contained:
Layer 1 (protocol: health, 5-piece roteiro parse, the 401/422/503 content-API guards, and the
live `state:sync` contract for piece-load + ENTER-advance over an open WebSocket) and Layer 2
(real browser: both pages Online, live no-reload swap, Skip Calibration → Start Presenting via
the local pacing profile, piece swap while presenting, and the §11 look — black + CSS
starfield + cyan word-active highlight — asserted by computed style).

## Automated verify harness

[`verify/hydrate-and-verify.sh`](verify/hydrate-and-verify.sh) runs the whole stranger flow in a
throwaway `node:20-slim` container (needs Docker + a `claude` CLI with auth): it hands **only
`SEED.md`** to a fresh blind agent, which **builds** the app from the spec and runs the seed's
`## Verify`, then prints the seed's final `SEED_RESULT=` line. See the script header for usage.

## A note on calibration

The controller has an **optional** speed-calibration step. The **canonical, supported path is
the local default pacing profile** — "Skip Calibration / Use Default Profile" enables Start
Presenting with no network and is the only path required for "done." An optional external
speech-to-text integration is described in the seed as a stub contract (behind an unset config
switch) and is explicitly **cut from the done definition**; the spec details this in `§9`.

## Provenance

The product is the CEO's teleprompter (originally `tp_flow/teleprompter` in the private
`delattre1/video-producing` monorepo). `SEED.md` is a clean-room **specification** of that
product — it carries **no application source** and has **zero coupling** to that monorepo or any
Plow service. The spec is the source of truth; the product is rebuilt from it.
