# Teleprompter — intent-spec product seed

**Teleprompter** is the CEO's proven video-recording workflow, packaged: a local, no-auth,
multi-device teleprompter. The **controller** runs on your computer, the **display** runs on a
phone (or any second browser page) at the camera, and a script bank (*roteiro*) live-swaps the
text on every connected display — by **ENTER** in the sender terminal or by **clicking a roteiro
part** in the controller — one take at a time, no refresh, no login.

This repo is **one file that matters**: [`SEED.md`](SEED.md) — a self-contained
**intent-spec SEED**. It contains a complete product specification and **zero application
source**: the data model, the WebSocket/REST wire contract, the rendering math, every UI
constant and color, and the roteiro format — all pinned by **absolute value**. Hand it to a
coding agent and it **builds the whole FastAPI + Vite/React app from the spec alone**, then
authors and runs the seed's own `## Verify` until it passes.

> **The spec is the asset — there is no shipped bundle.** A blind agent reconstructs the product
> from `SEED.md` with no reference code anywhere.

## Use it

**Recommended:** paste `SEED.md` into your Claude Code session (host or container) and say:

> *Read this seed and execute it.*

The seed's own `## Steps` do everything: a one-turn **Interview** (detects `uv`, Node 18+, free
ports 9000/9001), then autonomously scaffolds the backend, frontend, and roteiro sender **from
the spec**, generates a `backend/.env` (`CONTENT_API_KEY`, chmod 600), `uv sync`,
`npm install`, starts both services, smoke-tests the sample roteiro, and prints an operator
card. No accounts, no operator-supplied API keys, no Docker required.

## What "done" looks like — the 7-point Definition of a Working Teleprompter

"Done" is not green check-marks — it is a human able to **record a video** with it, proven by a
**real user-drive** across two independent clients (`§15`/`§16`):

1. **2-device sync** — controller and display in separate browser contexts/origins stay in
   lock-step; every controller action shows on the display ≤ 1000 ms over the WS.
2. **Script-in** — paste/type/pick a script → it appears on the display; opens on a real sample
   roteiro (never a placeholder).
3. **Roteiro real-time** — clicking a roteiro **part** on the controller swaps the display
   content ≤ 1000 ms and resets to the top (in parallel with the terminal sender; `POST
   /api/content` guards: wrong key → 401, unset → 503, empty → 422).
4. **Present + read legibly** — one click into recording (no calibration gate); the **single
   current word** is the cyan→violet **glowing box** advancing **word-by-word**, kept
   **centered** via per-word `scrollIntoView`; all reading text is **bright white on solid
   black** (readable at camera distance — no dark-on-dark).
5. **Mid-take control / drift recovery** — pause keeps your place, scrub by word/line, the
   display follows; the take is recoverable, not lost.
6. **No dead controls / no scaffold** — every control acts; no starfield, no status/units chrome
   on the display.
7. **Survives a real session** — sustained swap/play/scrub/settings with zero console errors,
   the display stays in sync.

## Self-contained & proven (blind, from spec alone)

A blind, zero-context agent — handed **only `SEED.md`**, with **no reference implementation
anywhere** — rebuilds the product from scratch and proves it by the 7-point real user-drive plus
a Layer-1 protocol harness (health; 5-piece roteiro parse; the 401/422/503 content-API guards;
the live `state:sync` contract for piece-load + ENTER-advance; two-client broadcast), both
self-contained against the build's own `localhost`/LAN — no reference instance.

## Automated verify harness

[`verify/hydrate-and-verify.sh`](verify/hydrate-and-verify.sh) runs the whole stranger flow in a
throwaway container (needs Docker + a `claude` CLI with auth): it hands **only `SEED.md`** to a
fresh blind agent, which **builds** the app from the spec and runs the seed's `## Verify`, then
prints the seed's final `SEED_RESULT=` line. See the script header for usage.

## Provenance

The product is the CEO's teleprompter (originally `tp_flow/teleprompter` in the private
`delattre1/video-producing` monorepo). `SEED.md` is a clean-room **specification** of that
product — it carries **no application source** and has **zero coupling** to that monorepo or any
Plow service. The spec is the source of truth; the product is rebuilt from it.
