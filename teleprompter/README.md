# Teleprompter — seed bundle

Bundled artifact for `seeds/teleprompter.seed.md`. A local, no-auth,
multi-device teleprompter for recording videos:

- **backend/** — FastAPI + WebSocket state server (port 9000). Single shared
  state; `POST /api/content` (X-API-Key) swaps the script text live on every
  connected display.
- **frontend/** — Vite + React teleprompter UI (port 9001).
  Controller: `http://<host>:9001/` · Display (phone at camera):
  `http://<host>:9001/?mode=display`. The WS URL is derived from the page's
  hostname — no frontend env needed.
- **scripts/send_roteiros.py** — ENTER-per-take recording flow. Parses a
  banco-de-gravação roteiro markdown, sends one piece at a time; ENTER
  advances. Stdlib only. Reads `CONTENT_API_KEY` from env or `backend/.env`.
- **sample-roteiro.md** — 5-piece sample recording bank (parser fixture +
  demo content).

Origin: stripped from the private `delattre1/video-producing` monorepo
(`tp_flow/teleprompter`, commit `aace0de`) — Supabase auth, AbacatePay
payments and marketing pages removed. Do not edit here without re-running
the seed's Verify.

Install/run instructions live in the seed: `../SEED.md`.
