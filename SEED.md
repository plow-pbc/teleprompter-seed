# SEED: teleprompter

> A self-contained **product-spec "seed"** for **TPFlow Teleprompter** — a local,
> no-auth, multi-device teleprompter for recording videos: a controller page on the
> computer drives a read-only display page (a phone at the camera, or any second browser
> page). The operator **pastes a Markdown script** into the controller; it parses into
> **segments**, and **clicking a segment** (or advancing with the keys) live-swaps the
> displayed text on every connected client.
> **To build:** hand this file to a coding agent — it builds the backend + frontend
> from this spec alone and self-runs the §16 acceptance journeys.
> **Self-contained & self-verifying.** A blind, zero-context agent — with **no access to
> any reference implementation** (no original codebase, no golden screenshots, no second
> app) — must rebuild the product from this spec and pass the seed's own `## Verify`. This
> file contains **NO application source on purpose**: the data model (§5), the wire
> contract (§4), the rendering math (§7), the UI constants and design tokens (§8, §11), and
> the Markdown script format (§10) are **fixed and load-bearing** — asserted by **absolute
> value**, never by diffing a reference app. Everything else (file layout, component split,
> idiomatic React/FastAPI wiring) is yours to choose.

> seed-format: 1

> **This seed builds a PRODUCT, not a dev-scaffold.** The single most important rule a blind
> rebuild must internalize: **the recording surface is a finished teleprompter a creator
> films against, not a demo harness.** That means (and §7/§8/§11 pin every value): one-click
> into recording with **no calibration gate**; a **solid pure-black** reading surface (no
> starfield, no decorative layers); the **CEO-original word-display model** — a **single
> highlighted current word** (the cyan→violet **glowing box**) that advances **word-by-word** and
> is kept **centered** via per-word `scrollIntoView` (§7.4/§11.2), NOT a continuous crawl and NOT
> a fade; a **real, readable** teleprompter font; **mirror mode** for glass rigs; **manual pace /
> drift-recovery** controls so a take is never lost; and a **display that shows ONLY the
> script** — no status pills, no units, no jargon. If a rebuild ships a gate, a starfield, debug
> chrome on the display, or **replaces the original word-by-word highlight with a crawl/fade**, it
> has misread this seed.

> **You're an AI agent reading this seed.** Your job: build the **TPFlow Teleprompter** —
> backend (FastAPI + WebSocket on **:9000**) and frontend (Vite + React on **:9001**, the
> paste-Markdown controller + display) — from this specification alone, until every §16
> acceptance journey passes.
> Run **`## Steps` Step 0 (autonomous preflight: detect-and-install every dependency)**, then
> execute every Step in order, then perform `## Verify`. When all Verify evidence is in hand
> print `SEED_RESULT=DONE`; on an unrecoverable blocker print `BLOCKED_REASON=<short reason>`
> and stop.
>
> **RUN FULLY AUTONOMOUSLY — ZERO HUMAN TURNS, ZERO QUESTIONS, ZERO AD-HOC FIXES.** There is
> **no interview, no decision menu, no confirmation prompt, no human in the loop.** A fresh
> substrate executes this seed **start-to-finish on its own** and only ever emits
> `SEED_RESULT=DONE` or one `BLOCKED_REASON=`. Specifically:
> - **Install every dependency yourself, unconditionally.** Detect-and-install `uv`, Node ≥18,
>   and a Layer-2 browser (Playwright Chromium) — and anything else you need — without asking.
>   If `uv` is missing, run `curl -LsSf https://astral.sh/uv/install.sh | sh` and add
>   `$HOME/.local/bin` to `PATH`, then continue. Never present options ("install uv? / use
>   pip?"), never pause for a human to choose — the seed already chose: **install it and move
>   on.** A missing tool is a step to execute, not a question to ask.
> - **Never stop to ask "how should I proceed?"** — the Steps and the §16 acceptance bar fully
>   specify the build. Any pause for a human decision **contaminates the run and fails the
>   seed.** If you hit something the spec does not cover, pick the choice that satisfies §15/§16
>   and keep going; do not escalate.
> - **Do NOT emit AskUserQuestion / confirmation menus — not for scope, not for "submit?", not
>   for anything.** These exact stalls fail the seed: (a) *"install uv? / use pip?"* → just
>   install uv; (b) *"build it all now / backend-first / confirm the plan?"* → **build it all
>   now, in one pass**; (c) *"ready to submit / proceed?"* → there is nothing to confirm, keep
>   going. This **IS** a "run the install recipe and build to spec" job: treat the whole seed as
>   one uninterrupted execution from Step 0 through `## Verify`. Do not announce a plan and wait,
>   do not checkpoint, do not request go/no-go. The only outputs that ever stop you are the final
>   `SEED_RESULT=DONE` or one `BLOCKED_REASON=`.
> - Do not ask the human anything, at any point, for any reason.
>
> **Definition of done.** A fresh machine ends with a running teleprompter: the **controller**
> at `http://<host>:9001/` shows a green **Online** indicator with **zero frontend env
> config**, opens on a **real sample script** (not a placeholder/test string), and goes from
> **paste a Markdown script → click a segment → Start Presenting in ONE click** (no calibration,
> no gate) into a recording view that **plays, scrolls, and highlights the active word**. The
> **display** at `http://<host>:9001/?mode=display` shows **only the script** on **solid pure
> black** — no Online pill, no readouts, no units — and follows the controller live. The pasted
> script parses into **segments**; **clicking a segment** (or advancing with the keys)
> live-swaps the displayed text on every connected client, no refresh — the CEO's recording
> workflow. There is **no script library** and **no draggable word-bar**. All of this observable
> and green in §16; the seed is proven only when a blind rebuild from this spec passes as a
> **quality product**.

---

## 1. Purpose & context

**TPFlow Teleprompter** is the CEO's recording rig, packaged. The CEO records short-form ad
videos: a phone sits on the camera showing the teleprompter **display**; the laptop runs the
**controller**. The operator **pastes a Markdown script** into the controller; it parses into
**segments**, and **clicking a segment** (or advancing with the keys) swaps the displayed text
instantly on the phone. No login, no cloud, no refresh between takes.

The product has exactly two moving parts:

1. **Backend** — a tiny FastAPI app holding **one shared teleprompter state** in memory and
   broadcasting it over a WebSocket. It is a local recording tool: **no authentication**, all
   connected clients (controller + every display) share the **same** state. A small content API
   (`POST /api/content`, X-API-Key) is the sync door clients write through.
2. **Frontend** — a Vite/React single-page app that renders in one of two modes off a URL
   query param: **controller** (the **paste-Markdown box** + segments panel + presentation +
   controls) or **display** (read-only, auto-syncs, lives on the phone, shows **only the
   script**). The controller **parses the pasted Markdown into segments** (§10.1) client-side;
   clicking a segment pushes its text as the shared content. The WebSocket URL is **derived from
   the page's own hostname** — no frontend env file, so the phone reaches the backend at the
   same IP it loaded the page from. (There is **no terminal sender** and **no script library**.)

Character traits the rebuild must preserve:
- **One shared state, broadcast to all.** Any mutation (paste/edit, play/pause, a segment
  select) reflects on **every** connected client with no refresh.
- **Zero-config display.** The display page derives its backend URL from its own hostname —
  open it on a phone via the LAN IP and it just connects.
- **One click into recording.** Paste a script → click a segment → **Start Presenting**. No
  calibration, no "speed training," no gate. The pacing engine ships preconfigured (§9).
- **Paste → segments → click-to-swap.** The recording loop is: phone on camera → paste the
  Markdown script → click a segment (or next/prev keys) → the display swaps to that segment and
  resets to the top.
- **Recoverable takes.** Auto-scroll paces from a speech profile, but the operator can always
  take the wheel — pause/resume (pause keeps your place), jump between **segments**, nudge speed
  — so a take that drifts off the speaker's pace is **recovered, not lost** (§8.4). (There is no
  word-scrub bar — navigation is by segment, §8.3/§8.4.)
- **Finished reading surface.** Solid pure-black background (no decorative layers), the
  CEO-original **single highlighted current word** (cyan→violet **glowing box**) advancing
  word-by-word and kept centered via per-word `scrollIntoView` (§7.4/§11.2), a real readable
  teleprompter font, **mirror mode** for glass rigs, and a display free of any status/diagnostic
  chrome.

It is **local-only**: no Supabase/JWT auth, no payments, no marketing pages, no Docker, no
external services on the done path, and **no speech-to-text / calibration service** (cut
entirely — see §9).

---

## 2. Technical approach (stack, prerequisites, constraints)

- **Backend**: **FastAPI** with a native `@app.websocket` endpoint, **Pydantic v2** models,
  **pydantic-settings** for config. Managed by **uv** (Astral). Python **≥ 3.11**. ASGI
  server **uvicorn** with the **websockets** library. Binds **`0.0.0.0:9000`** (the phone on
  the LAN must reach it). Backend deps (pin floors): `fastapi`, `uvicorn`, `websockets`,
  `pydantic`, `pydantic-settings`, `python-dotenv`.
- **Frontend**: **Vite + React 18/19 + TypeScript (strict) + TailwindCSS**. npm, Node **≥
  18**. Vite dev server binds **`0.0.0.0:9001`** with `allowedHosts: true` (so the phone can
  load it by LAN IP/hostname). Path alias `@ → src`. **No CSS-in-JS state libs, no particle
  engine, no animation library, no decorative background layers** — the reading surface is
  **solid pure black** (see §11). A build that pulls in `@tsparticles`/`framer-motion`, or
  that renders a starfield/sparkles/shooting-stars behind the text, is **wrong**.
- **No terminal sender, no script library.** Input is the in-page **paste-Markdown box** +
  **segments panel** (§8.1/§8.7); there is no `send_scripts.py` and no saved-scripts UI (§10.3/§8.2).
- **Ports are fixed contracts.** Backend **9000**, frontend **9001**. The frontend derives
  its WS URL as `ws(s)://<page-hostname>:9000/ws` — **9000 is hardcoded in the client**;
  do not make it configurable, do not read it from env.
- **No frontend env at all.** There is no `.env`/`.env.local` for the frontend. Any "WS URL
  env var" is a bug (it was the #1 historical fresh-install failure). Derive from hostname.
  There is **no STT/calibration env** either — that feature is cut (§9).
- **Backend env is one generated secret.** `backend/.env` carries `LOCAL_MODE=true` and
  `CONTENT_API_KEY=<generated>` (chmod 600). pydantic-settings reads `.env` **relative to the
  process cwd**, so the backend must be started from the backend dir.
- **Substrate**: macOS (Darwin) or Linux; internet for `uv sync` / `npm install` only. No
  accounts, no operator-supplied keys, no Docker required.

---

## 3. Architecture & mental model

```
            ┌─────────────────────────────────────────────┐
            │  Backend :9000  (one shared TeleprompterState)│
            │  - GET /            health                    │
            │  - POST /api/content  (X-API-Key) external sync│
            │  - WS  /ws          state:sync to ALL clients │
            └───────▲───────────────────────▲───────────────┘
        WS state:update│        WS (read-only)│  state:sync (broadcast)
                       │                      │
        ┌──────────────┴───────────────┐   ┌──────────┴───────────────┐
        │ Controller :9001/            │   │ Display :9001/?mode=display│
        │ paste MD → segments → click; │   │ phone at camera, SCRIPT-ONLY│
        │ present, drive               │   │                            │
        └──────────────────────────────┘   └────────────────────────────┘
```

**Two front doors into one store:**
1. **WebSocket door** (`/ws`, no auth) — the controller pushes partial `state:update`s; the
   server merges into the single shared state and **broadcasts the full `state:sync`** to
   every connected client (controller + displays). **The in-page flow uses this door:** an
   inline paste-box edit sends `state:update {content}` (no `position` → keeps place); clicking
   a segment / advancing sends `state:update {content, isPlaying:false, position:0}` (new take,
   top).
2. **Content-API door** (`POST /api/content`, `X-API-Key`) — an **external** push (integrations
   / scripts) sets the content, **resets scroll position to 0**, pauses, and **broadcasts
   `state:sync`**. Nothing in the shipped product drives it (no terminal sender), but it remains
   the documented sync seam and is exercised by Verify Layer 1 (§16).

Both doors mutate the **same** `TeleprompterState`; content pushed through either renders on
every display through the same broadcast path.

**One subtlety that is load-bearing for "inline editing must not reset scroll":** a *content
edit* arriving over the **WS door** as `state:update {content}` **without `position`** does
**NOT** touch `position` — the operator editing a typo mid-take keeps their place. A **segment
take-swap** (WS `state:update` *with* `position:0`) or the **content-API door** resets `position`
to 0. Clients must mirror this: re-render text on any content change, but **clamp & keep the
current word index** when no `position` is sent; **only** jump to the
top when `position` itself arrives as 0 (take-swap / Reset). See §6, §7.4.

The shared-state scope is a single fixed user id **`"local-shared"`** — there is no
per-user/session partitioning. Every WS connection and every content POST targets that one
state.

---

## 4. Backend contract (port 9000) — FIXED

All endpoints on a single FastAPI app. **CORS**: `allow_origins=["*"]`, allow credentials,
all methods, all headers (LAN access from a phone).

### 4.1 Health
`GET /` → **200** `{"status": "ok", "message": "Teleprompter Sync API"}`.

### 4.2 Content API (the script live-swap door)
`POST /api/content`, header **`X-API-Key`** (required), JSON body
`{"content": "<string>"}`. The `content` field is **required and non-empty** — declare it
with **`min_length=1`** so the framework's **body validation runs BEFORE the handler** and an
empty or missing `content` returns **422** *regardless of the key* (validation precedes the
key checks). This precedence is fixed.

Behavior, in order (after the 422 body-validation gate):
1. Read `CONTENT_API_KEY` from settings. **If unset/empty → 503** `{"detail":"Content API
   not configured"}`.
2. **If `X-API-Key` ≠ `CONTENT_API_KEY` → 401** `{"detail":"Invalid API key"}`.
3. On match: set `state.content = body.content`; **`state.position = 0.0`** (reset to
   beginning — this is a *new take*); **`state.is_playing = false`** (pause). **`state.is_presenting`
   is left UNCHANGED** — a segment swap sent while presenting must NOT kick the operator out of the
   presentation view.
4. **Broadcast `state:sync`** (full state) to every connected client.
5. Return **200** `{"success": true, "message": "Content updated. <N> characters. Position
   reset to 0."}` where `<N> = len(content)`.

### 4.3 WebSocket `/ws` (no auth)
On connect: `accept()`, register the socket under `"local-shared"`, then **immediately send
the current state** as a `state:sync` frame. Then loop reading text frames; each frame is
`{"type": <str>, "data": <object>}`.

**Inbound message types (client → server):**

| type | data fields (see §5 for types) | server action |
|---|---|---|
| `state:update` | any subset of the state fields | partial-merge into shared state (rules below), then broadcast `state:sync` |
| `ntp:request` | `t0`, optional `clientRtt` | reply (to that socket only) `ntp:response {t0, t1, t2}`; update the socket's smoothed RTT |
| `play:start` | optional `position`, `playbackRate`, `wpm`, `desiredStartMs` | apply provided fields; `is_playing=true`; broadcast `state:sync`; then broadcast a `play:schedule` (see §4.4) |
| `play:pause` | optional `position` | apply position if present; `is_playing=false`; broadcast `state:sync` |
| `play:reset` | — | `position=0`, `is_playing=false`; broadcast `state:sync` |
| anything else | — | log a warning, ignore |

**`state:update` partial-merge rules (apply only fields that are present):**
- `content`, `isPlaying`, `isPresenting` → set directly. **Setting `content` does NOT change
  `position`** (inline edit keeps the operator's place — §3).
- `position` → apply `isPlaying` **first**, then set `position` **only if** present **and**
  (the state was **not playing** before this message **OR** this same message sets
  `isPlaying:false`). During sustained playback the client owns position locally, so a stale
  position push while playing is ignored — **BUT a take-swap `{content, isPlaying:false,
  position:0}` sent mid-play MUST still reset to the top**: the same message turning playing
  OFF unlocks the position write. This is the seam that lets a controller move the displays to
  a new segment/position from **either paused or playing** (§8.4, §8.7). (Fold: card
  add834d5fd3c — POINT-5 take-swap-mid-play, surfaced by the pinned uniform Verify on a fresh
  node; an `{isPlaying:false, position:0}` arriving while `is_playing` was true previously
  failed to reset, losing the segment swap.)
- `fontSizeVh`, `backgroundColor`, `textColor`, `playbackRate`, `speechProfile` → set
  directly when present.
- `wpm` → if present, set it; **else if** `playbackRate` or `speechProfile` changed this
  message, recompute `wpm` from the profile (§4.5).
- `countdownSeconds` → set (as int) when present.

**Outbound message types (server → client):** `state:sync` (full state, broadcast),
`ntp:response` (single socket), `play:schedule` (broadcast).

**Disconnect / send-failure:** prune the socket from the connection list; broadcasting to a
dead socket must not crash the loop (catch per-send and remove).

### 4.4 Play scheduling + NTP (multi-display sync) — pin the constants
The display(s) and controller run a small NTP-style clock-sync so a `play:start` begins at
the same wall-clock instant on every device. **This is a refinement, not a done-gate** (a
single display works without tight sync), but rebuild it to keep the protocol intact:

- On `ntp:request`: record `t1 = now_ms` on receipt, `t2 = now_ms` on reply; respond
  `ntp:response {t0: <echoed>, t1, t2}`. Smooth the socket's round-trip with
  `rtt = rtt*(1-α) + clientRtt*α`, **α = 0.2**.
- On `play:start`: compute `schedule_delay_ms = clamp(max(MIN, maxRTT*1.5 + JITTER), .., CAP)`
  with **MIN = 400 ms, JITTER = 200 ms, CAP = 3000 ms**, where `maxRTT` is the max smoothed
  RTT across that user's sockets. The **CAP bounds only the RTT-derived delay**; if
  `desiredStartMs` is given, raise the final delay to honor it via
  `schedule_delay_ms = max(capped_delay, desiredStartMs - now_ms)` — so an explicit
  `desiredStartMs` (e.g. a 5 s countdown > CAP) **may exceed the CAP**. Broadcast
  `play:schedule {serverTimeToExecute, position, playbackRate, wpm}` where
  `serverTimeToExecute = now_ms + schedule_delay_ms`.
- Time source: epoch milliseconds (`time.time()*1000`).

### 4.5 WPM derivation (compat field)
`wpm` is retained for backwards-compat/analytics; derive it deterministically:
`estimate_wpm(profile, rate)` = sample word-lengths **[3,4,5,6,7]**, average their
`perLengthDurations`, divide by `rate` (if `rate>0`), then `wpm = max(1, round(60 / max(avg,
0.05)))`. With the default profile and rate 1.0 this is **≈ 124**.

---

## 5. State wire schema (FIXED field names, types, defaults)

The single shared state object. **Outbound `state:sync` serializes these keys in
camelCase** (this is what every display renders from and what Verify asserts). Inbound
payloads from the bundled clients use the **same camelCase keys** for state fields; the
server must also accept snake_case aliases for robustness, but the canonical wire form
(and the only form Verify checks) is **camelCase out**.

| field (camelCase wire) | type | default (new state) | notes |
|---|---|---|---|
| `content` | string | the §10.5 sample script text | the script text shown — **never an empty/test placeholder on done** |
| `isPlaying` | bool | `false` | auto-scroll running |
| `isPresenting` | bool | `false` | controller in presentation view |
| `playbackRate` | number | `1.0` | speed multiplier, **clamped [0.25, 4]** |
| `wpm` | number | `124` (derived §4.5; store the int) | compat only; recompute on rate/profile change |
| `position` | number | `0.0` | **word index** (not pixels) |
| `fontSizeVh` | number | `4.5` | font size as **% of viewport min (vmin)**; UI range [2, 15] |
| `backgroundColor` | string | `"#000000"` | hex — presentation forces pure black |
| `textColor` | string | `"#ffffff"` | hex |
| `countdownSeconds` | int | `3` | pre-roll countdown; UI options {1,3,5} |
| `speechProfile` | object \| null | default profile (below) | pacing profile, §9 — **server-seeded, no UI** |

> The backend **seeds `content` with the §10.5 sample script** at process start (a real
> script), so a freshly-opened controller and display are never blank and never show a leftover
> test string. The controller's own first-load default content (before any `state:sync`) also
> uses the §10.5 sample (§6).

**`speechProfile` shape** (camelCase wire): `{ perLengthDurations: {"1": <s>, …, "30": <s>},
punctuationPauses: {comma: <s>, sentence: <s>}, source: "fallback", updatedAt: "static" }`.

**Default speech profile (FIXED VALUES) — the only profile that ships:**
- `perLengthDurations[str(n)] = round(0.25 + 0.15 * ln(n), 3)` for **n = 1..30**.
  (e.g. n=1→0.25, n=3→0.415, n=5→0.491, n=10→0.595, n=30→0.760.)
- `punctuationPauses = { "comma": 0.2, "sentence": 0.4 }`.
- `source = "fallback"`, `updatedAt = "static"`.

The frontend mirrors this exact profile client-side (same formula, same constants) so the
display paces identically whether or not the server pushed a profile. **There is no second
("stt") profile source and no calibration path** — this fixed profile is the whole pacing
engine (§9).

---

## 6. Frontend contract (port 9001) — FIXED

- **Single SPA, two modes off the URL.** `?mode=display` → **display** mode; otherwise →
  **controller** mode. Switching is via `history.pushState` toggling the `mode` param (no
  reload).
- **WebSocket URL derivation (no env):**
  `const wsUrl = \`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.hostname}:9000/ws\``.
  Port **9000 is hardcoded**. This is what lets the phone (which loaded `:9001` from a LAN IP)
  reach the backend at the same IP's `:9000`.
- **Reconnect:** if the socket is still `CONNECTING` after **1000 ms**, close and retry. On
  `close` with code **≠ 1000**, retry after **2000 ms**. Expose an `isConnected` boolean to
  the UI.
- **Connection indicator — CONTROLLER ONLY.** A status pill with a dot + label lives on the
  **controller** (both the editor and the presentation top bar). **Connected → dot `#00ff88`
  with a glow (`box-shadow: 0 0 20px #00ff88`) + label "Online"**; disconnected → indigo dot +
  label "Offline". **The display (`?mode=display`) renders NO status pill, NO readouts, NO
  units — only the script** (§8.5). (Verify asserts the controller `#00ff88`/"Online" state
  **and** the absence of any status pill in display mode.)
- **localStorage keys** (exact + semantics):
  - `teleprompter-content` (last edited script), `teleprompter-playback-rate` (number),
    `teleprompter-speech-profile` (the §5 profile) — these **persist and seed the initial
    local state on load, before the first `state:sync` arrives**. If `teleprompter-content` is
    absent (first ever load), seed from the **§10.5 sample script** (its first segment), never an
    empty string or a test string.
  - `display-mirror` (boolean) — the device's **horizontal-flip / mirror** toggle for glass
    teleprompter rigs (§8.5). Local to that device, **not synced** over WS. **This is the only
    persisted key** — there is **no** `tp-scripts` / script-library storage (§8.2, cut).
  None of these gate Verify; persistence is a convenience.
- **Dark class:** the app adds `dark` to `<html>` on mount.
- **On `state:sync` received:** set content; **on a content change, KEEP the current word
  index** (clamp to the new word count) — do **not** jump to the top — *unless* the incoming
  `position` is itself 0 (take-swap / Reset), in which case go to the top. In **display** mode
  adopt `isPresenting` from the state (so the phone follows the controller into/out of
  presentation); clamp and store `playbackRate`; update font size / colors / countdown;
  reconcile play state and scroll position (during playback keep local position; when paused
  adopt the synced position — this is how a paused segment-set/position update on the controller
  moves the display).
- **Controller emits** partial `state:update`s on: content edit, playbackRate change, font
  size change, countdown change, a **segment select** / position jump **while paused** (a
  `position` update), and on entering/exiting presentation. The display emits nothing (read-only).

---

## 7. The teleprompter display (rendering math + auto-scroll) — FIXED

### 7.1 Word tokenization
`parseTextIntoWords(text)`: split on `/(\s+)/` keeping the whitespace tokens. Whitespace
tokens render literally but get **no word index** (`index = -1`, `isWhitespace = true`).
Non-whitespace tokens get a **sequential 0-based `index`** and render as
`<span data-word-index={index} class="teleprompter-word">`. Empty input → render the
placeholder text `Paste or type your script here...` (this is only reachable if a user clears
the script; on done the content is never empty — §5). Punctuation stays attached to its word
(do not split on apostrophes/hyphens).

### 7.2 Font size + reading surface (the device-consistent formula — pin it)
```
deviceMultiplier = devicePixelRatio > 2.5 ? 3.0 : devicePixelRatio > 1.5 ? 2.0 : 1.0
viewportMin      = min(window.innerWidth, window.innerHeight)
fontSizePx       = (settings.fontSizeVh / 100) * viewportMin * deviceMultiplier
```
The reading surface is a **solid pure-black** screen (`background: #000000`, no layers behind
the text). The scroll container uses `font-size: fontSizePx`, **`line-height: 1.8`**, a **real,
readable teleprompter font** (`font-family: 'Inter', 'Helvetica Neue', system-ui,
-apple-system, sans-serif`), **`font-weight: 500`** (a confident, legible weight — NOT a thin
300), **`letter-spacing: 0` (normal — NOT widely tracked)**, `color: textColor`, **top & bottom
padding each = `window.innerHeight / 2` px** (so the first and last lines can center), and
**horizontal padding 24px** (48px at ≥640px viewport width). Text block: **`text-align: center`**
(camera-centered, the teleprompter-rig standard; left-align is an acceptable alternative but
center is the pinned default), `white-space: pre-wrap`, `max-width ~64rem` centered. **No
text-shadow, no glow** on the body text — white on pure black needs none.

### 7.3 Per-word duration (pacing) — FIXED
For each non-whitespace word, with the active `speechProfile` and `playbackRate`:
- `len` = count of `[0-9A-Za-zÀ-ſ]` chars in the word (fallback to raw length);
  clamp to [1,30]. `base = perLengthDurations[str(len)] ?? perLengthDurations["30"]`.
- Trailing-punctuation class of the word: last char in `,;-` → **comma**; last char in
  `.?!:` → **sentence**; else none. `pause = punctuationPauses[class] ?? 0`. If the word ends
  with `"..."` and class is sentence, `pause *= 1.5`.
- `duration = clamp((base + pause) / (rate > 0 ? rate : 1), 0.05, 8)` seconds.

### 7.4 Auto-scroll — the ORIGINAL word-by-word model (single highlighted current word, centered) — FIXED
This is the **exact CEO-original reading model** and is load-bearing: a **single highlighted
current word** that **advances word-by-word** and is kept **centered**. It is **NOT** a
continuous pixel crawl and **NOT** a fade/dim model — reproduce it precisely:
- **One integer current-word index** (`currentWordIndex`), starting at `position` (§5). Build a
  per-word `durations[]` from §7.3 (`computeWordDurations`; whitespace excluded).
- **Playback loop** (`requestAnimationFrame`, only while `isPlaying`): accumulate
  `timeIntoWord += dt`; then **while `timeIntoWord >= durations[currentWordIndex]`**, subtract
  that duration and **advance the index by exactly one word**; on each advance, **highlight the
  new word** and **center it** (below). When the index passes the **last** word, stop playback.
- **Highlight + center** (`highlightWord(index, smooth)`): there is **exactly ONE** word with
  the `word-active` class at any time — **remove `word-active` from the previous word and add it
  to the new one** — then call
  **`targetWord.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' })`** so
  the current word sits at the vertical center of the scroll container. Use **`smooth` while
  playing** (auto-advance) and **`auto` (instant) while seeking / paused** (segment set, position
  set, reset). The container is `overflow-y-auto` and scroll-smooth; the per-word `scrollIntoView` is
  what moves the page — words on a line are highlighted in place, and the page scrolls when the
  centered word moves to a new line. **This per-word highlight + scrollIntoView centering is the
  required behavior; do not replace it with a crawl.**

**Manual override (segment nav — §8.4) shares the same integer index.** Selecting a segment /
jumping sets `currentWordIndex` (to 0 for a new segment) and re-highlights/centers it with
**`behavior: 'auto'` (instant)**; exactly one `word-active` follows. The controller throttles
outgoing `position` `state:update`s to **one per 100 ms** (with a trailing emit so the final
position reaches the displays). On
a WS content change that is **not** a take-swap, clamp the index into the new word range and keep
it (do not reset) — see §3/§6.

**INBOUND SYNC — snap to top on `position == 0`, on EVERY client, even mid-play — FIXED.** When
ANY client (the controller **and** each `?mode=display`) receives a `state:sync` whose
**`position === 0`** — a Reset (§8.3), a segment set / prev-next segment (§8.4/§8.7), or any
take-swap — it **MUST** set its local `currentWordIndex = 0` and re-highlight/center the first
word **instantly** (`behavior: 'auto'`), **regardless of `isPlaying` or the "client owns position
during playback" guard.** That ownership guard applies **only** to *non-zero* stale position
pushes during playback (§4.3); an explicit **`position == 0` ALWAYS wins** and snaps the receiving
client to the top. (Regression bugs, card add834d5fd3c: Reset left the controller stuck at its
playing index, and a prev-segment swap left the **display** at index 8 instead of 0 — both are
this **one** missing inbound-`position:0`-snap rule. This single rule fixes Reset, segment
navigation, and take-swap on every client; the §8.3 Reset note is the button-specific case of it.)

---

## 8. The controller UI + presentation view — FIXED constants

The controller has two screens: the **Editor** (default, not presenting) and the
**Presentation view** (after Start Presenting). The display page always renders the
presentation reading surface, read-only and script-only (§8.5).

### 8.1 Editor screen — paste a script, one click into recording, no gate
The editor is calm and obvious — **one screen, one script** (the script you just pasted; there
is **no library, no save/open/delete** — §8.2). Top to bottom:
- **Header bar:** product title `TPFlow Teleprompter` + subtitle `Controller`, the
  **Online/Offline** pill (§6), and a **"Display Mode"** button → switches this page to
  `?mode=display`.
- **The paste box** — a large **textarea** (`data-testid="script-input"`, `spellcheck=false`)
  where the operator **pastes a Markdown script** in the §10 format. Prefilled on first load
  with the **§10.5 sample script** (NOT an empty box, NOT a test string like "This is a text
  from Daniel!"); placeholder (only if cleared) `Paste your Markdown script here…`. Editing
  re-parses to segments live (§8.7) and pushes `state:update {content}` so the display follows.
- **"Copy formatting prompt" button** (`data-testid="copy-format-prompt"`, §10.6) — copies the
  §10.6 prompt to the clipboard so the operator can hand it to their AI assistant to turn any raw
  document into this teleprompter's Markdown format. (Pure clipboard; no backend.) **CLIPBOARD
  MUST WORK OVER PLAIN HTTP (non-secure context) — load-bearing.** This tool is normally opened
  over an `http://<LAN/tailnet-IP>:9001` origin, which is a **non-secure context** where
  **`navigator.clipboard` is `undefined`**, so `navigator.clipboard.writeText()` throws. Use a
  helper that returns a real boolean:
  - If `navigator.clipboard && window.isSecureContext` → `await navigator.clipboard.writeText(text)`; on throw, fall through.
  - **Fallback (the common LAN/IP case):** create a hidden read-only `<textarea>` off-screen
    (`position:fixed; top/left:-9999px`), set its value to the text, `focus()` + `select()` +
    `setSelectionRange(0, len)`, call `document.execCommand('copy')`, remove the textarea, restore
    any prior selection, and return whether `execCommand` succeeded.
  - On any failure return `false`.
  The click handler sets a `copyState: "idle" | "ok" | "fail"` from the helper's **real return
  value** and reflects it on the button as **`data-copy-state`**. Show **"Copied ✓"** ONLY when
  the copy truly succeeded (`ok`); on `fail`, show a **visible error state** (e.g. red
  "Copy failed — select & copy manually") — **NEVER flash a fake "Copied ✓" when nothing was
  copied** (the original bug: a swallowed `catch` that still set success). The unselectable label
  text used elsewhere must not block the textarea selection.
- **Segments panel** (§8.7) — the pasted script parsed into **clickable segments** (grouped
  under their section headings). **Clicking a segment makes it the current line on every
  connected display, live.** This is the in-page take driver — done-gating (J20).
- **Primary action: a single, always-enabled `Start Presenting` button** (full-width, accent
  gradient). **There is NO calibration step, NO "Speed Training" panel, NO gate.** Clicking it
  enters the presentation view immediately. The pacing engine is the §5 fixed profile, already
  loaded. (Removing the calibration gate is **load-bearing** — the old build's fake "🎙 Record
  / Calibrate" that blocked Start Presenting is **cut entirely**; do not reintroduce it.)

### 8.2 No script library — one pasted script only (DELETED by CEO)
There is **NO script library**: no save, no "new script", no rename, no delete, no list of saved
scripts, no `tp-scripts` localStorage. The operator cares only about **the script they just
pasted**; that single current script lives in the paste box (§8.1) and the shared backend state.
**Do not build any library/persistence UI** — a build that ships one has misread this seed
(this is a deliberate simplification the CEO asked for; the earlier library is **cut**). The only
persistence is the device-local `display-mirror` toggle (§8.5). The script itself is transient:
paste replaces it; nothing is stored or named.

### 8.3 Presentation view (controller)
- **Solid pure-black** screen (§7.2 reading surface — **no starfield, no decorative layer**),
  the centered scrolling text (§7), a top bar with the **Online/Offline** pill (controller
  only).
- **Controller-only controls bar** (the display does NOT show this bar — §8.5). Contains:
  - **Play / Pause** button — label `▶ Play` / `⏸ Pause` / `⏳ Waiting` (waiting = countdown
    or pending scheduled start). Starting playback runs a **countdown** first.
  - **Reset** button (`↻ Reset`) — **ALWAYS jumps to the START, from ANY state.** A click
    deterministically sets `position = 0` (first word active) **and** `isPlaying = false`,
    regardless of whether it is currently playing, paused, or already at the start, and emits one
    `state:update {position: 0, isPlaying: false}` so every display jumps to the top too. **Reset
    also resets the controller's OWN local active-word index to 0 immediately** — do not wait for
    the WS round-trip, and the "client owns position during playback" guard (§4.3/§7.4) **MUST
    yield to an explicit Reset**: a `position:0` + `isPlaying:false` from Reset always wins and
    snaps the local index to 0, even if the index value looks "unchanged" to a sync guard. **Reset
    is NOT a pause toggle** — pausing is the separate Play/Pause button (§Space). (CEO bug, card
    add834d5fd3c: Reset was state-dependent — it paused instead of resetting, a second click did
    nothing, and it only worked after pressing Play again. A later fresh build also left the local
    index at its playing value because Reset's `position:0` was treated as "unchanged" and ignored
    during playback — hence the explicit local-reset rule above. Reset must be a pure idempotent
    jump-to-beginning from every state.)
  - **NOTE — the Exit button is NOT in this controls bar.** It lives fixed in the **top-right
    corner** of the presentation view (see the dedicated bullet below).
  - **NO draggable current-word bar.** The old word-scrub range input is **removed** (the CEO
    did not ask for it). Take navigation is by **clicking a segment** (§8.7), not by dragging a
    word slider. Do not render a scrub/progress range input in the presentation controls.
  - **SPEED slider** — **log scale**: slider value `v ∈ [-1, 1]`, `rate = 4^v`, so center =
    1×, ends = 0.25× and 4×. Display the rate as `<rate>×` (2 decimals, e.g. `1.00×`). Tick
    labels: `0.25× · 1× · 4×`. The rate is **clamped to [0.25, 4]** everywhere (a single
    `clampPlaybackRate` used on every entry point). `±` nudge buttons and ArrowUp/ArrowDown
    nudge the **rate** linearly by **±0.1** then re-clamp.
  - **TEXT SIZE slider** — piecewise-linear around the default: **MIN 2, DEFAULT 4.5, MAX 15**
    (vmin %, internal). Normalized `n ∈ [-1,1]` maps DEFAULT at 0, with the **exact**
    two-segment map: `n ≥ 0 → size = DEFAULT + n*(MAX-DEFAULT)`; `n < 0 → size = DEFAULT +
    n*(DEFAULT-MIN)` (so `n=1→15`, `n=0→4.5`, `n=-1→2`). Snap the result to **0.1**. **The
    readout is a friendly percentage relative to default, NOT raw "vmin" jargon:** `pct =
    round(size / 4.5 * 100)` → readout `<pct>%`; so DEFAULT reads **`100%`**, MIN reads
    **`44%`**, MAX reads **`333%`**. Tick labels `44% · 100% · 333%`. Label the control
    `TEXT SIZE`.
  - **Countdown** segmented control — options **{1, 3, 5}** seconds, default **3**.
  - **Mirror** toggle — flips the reading surface horizontally for glass rigs (§8.5); also
    available here on the controller's presentation view (default off, device-local).
- **Exit button — FIXED in the TOP-RIGHT CORNER** (`✕`, `data-testid="exit-btn"`). It is a
  standalone control pinned to the **top-right corner** of the presentation view (e.g.
  `position: fixed; top: …; right: …`), **NOT inside the controls bar / menu**, and it stays
  visible (it is **not** auto-hidden with the controls bar). Clicking it returns to the editor /
  unsets presenting. (CEO directive, card add834d5fd3c — this regressed after prior feedback:
  Exit belongs top-right, never buried in the menu.)
- **Auto-hide:** while playing / counting down / pending start, the controls bar slides away and a
  small grab-handle remains; hovering brings it back. **The top-right Exit button is exempt — it
  never auto-hides.**
- **Entering presentation** (`Start Presenting`): set `isPresenting=true`, `position=0`,
  `isPlaying=false`, force `backgroundColor="#000000"`, `textColor="#ffffff"`, and emit a
  `state:update` with exactly those fields (so the phone display follows into presentation).

### 8.3a FIXED `data-testid` contract — the PINNED §16 harness keys off these
Every build MUST expose these **exact** `data-testid`s / classes. This is what lets the ONE
shipped §16 harness run identically on every install (the absence of a pinned contract is why
three nodes' self-authored harnesses diverged into 42/41/45):

| element | selector | where |
|---|---|---|
| paste box (textarea) | `data-testid="script-input"` | editor (§8.1) |
| Copy-formatting-prompt button | `data-testid="copy-format-prompt"` (+ `data-copy-state`) | editor (§8.1) |
| each clickable segment | `data-testid="segment"` (+ `data-segment-index="<i>"`) | segments panel (§8.7) |
| each section-heading label | `data-testid="segment-section"` | segments panel (§8.7) |
| Start Presenting button | `data-testid="start-presenting"` | editor (§8.1) |
| Online/Offline pill | `data-testid="status-pill"` | controller header (§8.1/§8.3) |
| Play/Pause button | `data-testid="play-toggle"` | presentation (§8.3) |
| Reset button | `data-testid="reset-btn"` | presentation (§8.3) |
| Exit button (TOP-RIGHT corner, not in the bar) | `data-testid="exit-btn"` | presentation (§8.3) |
| Countdown overlay (controller AND display) | `data-testid="countdown-overlay"` | presentation + `?mode=display` (§8.6) |
| Speed slider (`<input type=range>`) | `data-testid="speed-slider"` | presentation (§8.3) |
| Speed readout (`<rate>×` text) | `data-testid="speed-readout"` | presentation (§8.3) |
| Text-size slider (`<input type=range>`) | `data-testid="size-slider"` | presentation (§8.3) |
| each Countdown option (1s/3s/5s) | `data-testid="countdown-option"` | presentation (§8.3) |
| Mirror toggle | `data-testid="mirror-btn"` | presentation (§8.3) |
| active word | class `.word-active` (+ `data-word-index`) | reading surface (§7, §11.2) |
| every reading word | class `.teleprompter-word` | reading surface (§7) |

**Negative contract (presence = FAIL):** NO `data-testid` of `word-scrub` / `word-bar` /
`position-slider` / `scrub`, and **NO `<input type="range">` in the editor** (the draggable
word-bar is removed — §8.3/§8.4); NO script-library UI (§8.2). The pinned `verify/layer2.mjs`
asserts these absences directly.

### 8.4 Keyboard bindings — FIXED (segment-based, NO word-scrub bar)
Navigation between takes is by **segment** (§8.7), not by a draggable word bar (which is
**removed**, §8.3). Auto-scroll paces the current segment from the §5 profile; **pause keeps your
place** (it must NOT jump to 0), and resume runs the §8.6 countdown then continues. All bindings
are active in the presentation view (controller) and ignored while focus is in an
`<input>`/`<textarea>`:

| key | action (absolute) |
|---|---|
| `Space` | toggle play / pause (pause keeps position; resume runs the §8.6 countdown) |
| `ArrowUp` | speed **+0.1** (re-clamp to [0.25, 4]) |
| `ArrowDown` | speed **−0.1** (re-clamp) |
| `ArrowRight` / `PageDown` | go to the **next segment** (§8.7) — sets it current, top, paused |
| `ArrowLeft` / `PageUp` | go to the **previous segment** — sets it current, top, paused |
| `Home` | first word of the current segment (position 0) |
| `End` | last word of the current segment |
| `M` | toggle **mirror** (horizontal flip) |

**No word-level scrub bar and no per-word drag/jump affordance** — those are removed with the
draggable bar. Segment-advance (next/prev segment, or clicking a segment in §8.7) is the take
navigation; each segment-set emits one `state:update { content, isPlaying:false, position:0 }`
so every display jumps to the top of that segment (§4.3). Speed nudges always re-clamp via the
single `clampPlaybackRate`.

### 8.5 The display (`?mode=display`) — SCRIPT ONLY
The display is what the camera films. It shows **only the script** on **solid pure black**:
- **No Online/Offline pill, no connection chrome, no readouts, no units, no controls bar, no
  debug text.** If the socket drops it silently retries (§6); it never paints status on the
  reading surface.
- The **one** allowed control is a **minimal, auto-hidden mirror toggle**: a small icon button
  in a corner (e.g. bottom-right), **opacity 0 by default**, fading in (to ~0.6) on
  pointer-move/tap and auto-hiding after **~3 s**; the `M` key toggles it regardless. When
  mirror is **on**, apply **`transform: scaleX(-1)`** to the scrolling text container
  (horizontal flip, so text reads correctly reflected off teleprompter glass); the background
  stays pure black. State is `display-mirror` localStorage, device-local, never synced.
- **The countdown (§8.6) MUST render on the display** — it is the filming cue the talent reads
  at the camera, so it is **required** here (not merely "allowed"). It is the one overlay the
  display shows besides the script; it is a cue, not status/jargon. (CEO bug, card add834d5fd3c:
  the countdown was showing only on the controller — it must appear on the display too.)
- Everything else (text, font math, auto-scroll, word-active focus) is identical to the
  controller's reading surface.

### 8.6 Countdown — pre-roll on every play (the CEO original) — FIXED
Pressing Play (when not already playing) with `countdownSeconds > 0` runs a **pre-roll countdown**
centered over the text, counting whole seconds **3 → 2 → 1** down to 1, then begins the scroll —
this fires on **every** play start, including resuming after a pause (the CEO-original
`togglePlay → startCountdown` behavior; the earlier "immediate mid-take resume" was an invented
deviation and is discarded). With `countdownSeconds = 0`, start immediately. The countdown
duration drives the local pre-roll and the `desiredStartMs` sent on `play:start` (§4.4).

**The countdown overlay — match the CEO ORIGINAL exactly (3 fixed properties, card add834d5fd3c):**
- **Renders on BOTH the controller AND the display.** The countdown is driven from shared state
  (the play/`desiredStartMs` schedule, §4.4) so **every** connected client — controller and each
  `?mode=display` — shows the SAME synchronized countdown. A countdown that appears only on the
  controller is the bug. Give the overlay `data-testid="countdown-overlay"` on every client.
- **CONTINUOUS animation (NOT a depleting ring/chunk).** The number animates **fluidly** each
  second — a smooth continuous transition per tick (e.g. the digit scales/fades in→out, or a
  ring sweeps **continuously**), counting 3→2→1. Do **not** render a stepped "remove a slice of
  the circle" chunk. Use a CSS animation/transition (computed `animation-name`/`transition` is
  non-`none`) so each second-tick is a continuous motion.
- **IN FRONT of the text, with a BLURRED BACKDROP behind the number.** The overlay sits **on top
  of** the reading text (high stacking — e.g. `z-index` above the words; `elementFromPoint` at the
  viewport center during countdown returns the overlay/its child, never a `.teleprompter-word`),
  and behind the number is a **blurred backdrop** element (a `backdrop-filter: blur(...)` panel or
  a blurred circle) so the digit reads clearly in front of the script. (CEO bug: the counter was
  rendering BEHIND the text and was invisible; the original had the number in front with a blur
  behind it.)

### 8.7 Segments panel — clickable segments (controller; click = set current) — FIXED
The controller parses **the pasted Markdown script (§8.1 paste box)** into **segments** (§10
parse rule) and renders them as a **clickable list**, grouped under their section headings, so
the operator picks the current line with a click. This is **done-gating** (J20) and is the
in-page take driver (the CEO's core requested flow).
- **Source.** Parse the current paste-box content **client-side** with the §10 parse rule
  (`#`/`##` lines = section labels; each blank-line-separated block = one segment). Re-parse live
  as the operator edits the paste box. It is never empty when a script is present; seeded on
  first load with the §10.5 sample.
- **Render.** Show the segments **in document order**, each as a clickable item with a short text
  preview, visually grouped under their **section heading** label. Each item carries
  `data-testid="segment"` and `data-segment-index="<i>"` (0-based, document order) so Verify can
  target it; section-heading labels carry `data-testid="segment-section"`. Mark the **current**
  segment (the one on the display) with `data-current="true"` / an active style.
- **Click = set current, live.** Clicking a segment sets **that segment's text** as the
  teleprompter content **on every connected client** — a new take: it **resets to the top and
  pauses**. Emit a single `state:update { content: <segment text>, isPlaying: false, position: 0 }`.
  Because the server applies `isPlaying` before `position` (§4.3), the `position: 0` takes effect
  even if it was playing, and every display jumps to the top of that segment. (This — and
  segment-advance via the §8.4 keys — is the **one** content change that carries `position: 0`;
  an inline edit of the paste box omits `position` and keeps the operator's place, §3/§7.4.)
- **No terminal sender.** Input is the in-page paste box + this panel; there is **no**
  `send_scripts.py` terminal tool (cut — §10). All clients still sync through the same backend
  broadcast (`/api/content` + WS remain the sync door for 2-device sync).

---

## 9. Pacing profile — FIXED, NO CALIBRATION (the gate is cut)

The teleprompter paces its auto-scroll from a **speech profile** (§5, §7.3). **There is exactly
one profile and zero calibration UI:**

- The **fixed default profile** (§5 exact values) is built **entirely client-side from a fixed
  formula** — no network, no microphone, no external service, no "speed training" step. It is
  loaded at startup and is the whole pacing engine. It produces a well-paced teleprompter out
  of the box; the operator fine-tunes live with the SPEED slider / ArrowUp-Down (§8.4).
- **No "Record / Calibrate", no "Speed Training" panel, no Skip-Calibration button, no
  Start-Presenting gate.** The old build shipped a fake "🎙 Record / Calibrate" that captured
  audio, did nothing useful, and **blocked the core action**. It is **cut entirely.** Do not
  add a microphone capture, a `VITE_STT_URL`, or any speech-to-text path — none exists in this
  product. A build that gates Start Presenting on a calibration acknowledgement, or that renders
  a calibration/Speed-Training panel at all, has **failed §16 J4**.

If a future integrator ever wants personalized pacing, the seam already exists: push a
`state:update {speechProfile, wpm}` with a normalized profile (clamp each duration to [0.05, 8],
fill missing lengths from the default). That is a backend/integration concern with **no UI in
this product** and is **out of scope for done**.

---

## 10. The Markdown script: paste → parse → segments (real-time swap) — FIXED

This is the CEO's core flow: the operator **pastes a Markdown script** into the page (§8.1), the
controller **parses it into segments**, shows them (§8.7), and **clicking a segment — or
advancing with the §8.4 keys — makes it the current line on every connected display, live.**
Input is the in-page paste box; there is **no terminal sender** and **no script library**. All
clients sync through the backend `/api/content` + WS broadcast (the sync door, §4.2/§4.3).

### 10.1 The Markdown script format (the paste format) — FIXED, documented on the page
One rule the operator learns, shown next to the paste box:
- **A heading line (`#` / `##` / `###`) = a SECTION label** — it groups the segments beneath it
  (rendered as a heading in the segments panel). A heading is **not itself a segment**.
- **Every block of text separated by a BLANK LINE = one SEGMENT** — the unit the operator clicks
  / advances to, and the text shown on the teleprompter.

**Parse rule (unambiguous):** split the pasted text on blank lines into blocks; **trim** each
block and drop empties; a block whose first non-space character is `#` is a **section label**
(strip leading `#`s + the following space for its display name); **every other block is a
segment**, tagged with the most recent section label as its group. Segments are numbered
**0-based in document order**. Markdown inside a segment is shown as plain text (no bold/italic
rendering required).

Example:
~~~markdown
# Intro
Do you still waste time memorizing what to say?

What if your script scrolled on screen, at your own pace?

## Body
Paste the script, open the display on your phone, and click Start.

# CTA
Link in the description. Start today.
~~~
→ **4 segments** in 3 sections: Intro → [seg0, seg1], Body → [seg2], CTA → [seg3].

### 10.2 Segment order
Segments are ordered in **document order** (top-to-bottom as pasted): index 0 is the first
segment; next/prev (§8.4) and the panel list (§8.7) follow that order. No reordering by type.

### 10.3 No terminal sender (DELETED)
The old `send_scripts.py` ENTER-per-take terminal tool is **cut** — do not build it. The page
**is** the input: paste a script (§8.1) and click a segment / advance with keys (§8.7/§8.4). The
backend `/api/content` (X-API-Key) door + WS broadcast remain as the 2-device **sync** path and
are exercised by Verify Layer 1 (§16) — but nothing drives them from a terminal.

### 10.4 Bundled sample script (`sample-script.md`) — recreate verbatim
This doubles as the parser fixture (must parse to **exactly 5 segments** in **3 sections**:
Intro→2, Body→2, CTA→1) and the first-load demo. Real copy (English, the CEO's filming
language), not test strings. Write this file verbatim:

~~~markdown
# Intro
Hey everyone, welcome back to the channel.

Today I'll show you how to record your videos reading straight from the screen, without memorizing a single line.

# Body
The text scrolls at your pace, the current word stays highlighted, and you just look at the camera and talk.

If you lose your place, just pause, jump back to the right segment, and keep going — the take is not lost.

# CTA
Paste your script, click Start Presenting, and record your next video reading right off the screen.
~~~

### 10.5 First-load content (the controller/display open on this)
On first load the **paste box (§8.1) is prefilled with the full §10.4 sample Markdown**, and the
backend seeds `state.content` with the **first segment** of that sample (`Hey everyone, welcome back to the channel.`) — **never** an empty box or a test string like
`This is a text from Daniel!`. The segments panel (§8.7) therefore opens showing the 5 parsed
segments under their 3 sections, with segment 0 current. (Verify asserts first-load content is
this sample, not the test string or an empty box.)

### 10.6 The "Copy formatting prompt" (format helper) — FIXED text
The editor's **Copy formatting prompt** button (§8.1, `data-testid="copy-format-prompt"`) copies
**exactly this text** to the clipboard, so an operator without a properly-formatted script can
paste it to their AI assistant to convert any raw document into the §10.1 format:

~~~text
Convert the document below into a teleprompter script in Markdown.
Rules:
- Use "#" headings for section titles (for example: Intro, Body, CTA).
- Put each spoken beat — one sentence or short phrase you would read as a single breath — as its own paragraph, separated by a blank line.
- Plain Markdown only: headings and paragraphs. No bullet lists, bold, italics, tables, or notes.
- Output ONLY the formatted script, nothing else.

Document to convert:
<<< paste your raw text here >>>
~~~

Clicking the button writes this to the clipboard via the §8.1 clipboard helper and shows
**"Copied ✓"** **only on a real, confirmed copy**. Because the tool runs over plain HTTP on a
LAN/tailnet IP (a **non-secure context**, where `navigator.clipboard` is `undefined`), the helper
**must** use the hidden-textarea + `document.execCommand('copy')` fallback; if the copy genuinely
fails it must show a **visible failure**, never a fake success. (This is exactly the bug the CEO
hit: over `http://<ip>:9001` the button flashed "Copied ✓" while copying nothing.)

---

## 11. Design system (reproducible spec — absolute values)

The look is a **finished recording rig**: a **solid pure-black** reading surface, the
**CEO-original cyan→violet glowing box on the single current word** (§11.2), a real readable font,
and a **soft electric-blue/violet accent used
only on controls** (play button, sliders, primary button). Pin every value; the visual journeys
(§16) assert these by computed style, never by diffing a reference app.

### 11.1 Palette (exact)
- Display/presentation background: **`#000000`** (pure black, **solid — no layers behind the
  text**). Display text default **`#ffffff`**.
- Accent gradient endpoints (controls only): cyan **`#00d4ff`** → violet **`#7b2ff7`** (play
  button, Start-Presenting button, sliders' thumb/track, countdown ring). **The accent does
  NOT appear on the active reading word** (§11.2).
- Connection-online green (**controller pill only**): **`#00ff88`** (dot + glow).
- The Tailwind theme `--primary` token may be amber `#f59e0b` in CSS vars, but the
  teleprompter surfaces use the cyan→violet accent above directly on controls.

### 11.2 Active word — the ORIGINAL cyan→violet glowing box (single highlighted current word) — FIXED
The reading cue is the **single highlighted current word** (§7.4), shown as the **exact CEO-
original glowing box**: a cyan→violet gradient fill + cyan glow (box-shadow) + cyan text on the
one `word-active` word. **All other words stay full white (no dim, no fade).** Reproduce this CSS
**verbatim** (these are the original absolute values):
```css
.teleprompter-word {
  /* Animate ONLY the box (background gradient + glow) — NOT color. §16b.4 asserts the
     EXACT computed color of the active word (rgb(0,212,255)) and every other word
     (rgb(255,255,255)) at arbitrary sample instants during playback; a `transition: all`
     interpolates `color` (white↔cyan over 0.2s) so the pinned harness samples a mid-fade
     value (e.g. rgb(151,237,255)) and FAILS. Keep the visible 0.2s box fade-in; snap color
     instantly so the asserted absolute colors always hold. (Fold: card add834d5fd3c —
     the §11.2/§16b.4 contradiction the pinned uniform Verify surfaced on a fresh node.) */
  transition: background 0.2s ease, box-shadow 0.2s ease;
  padding: 0 4px;
  border-radius: 0.5rem;
}
.word-active {
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.25), rgba(123, 47, 247, 0.25));
  box-shadow: 0 0 18px rgba(0, 212, 255, 0.35);
  color: #00d4ff;
}
```
> **READABILITY / CONTRAST — load-bearing (dark-on-dark bug, card b19a04ef6101).** The display
> text MUST be **clearly readable on the black background at camera distance.** Every word the
> operator reads — unread/upcoming **and** already-read — renders at the **full text color
> `#ffffff` (pure white), `opacity: 1`** on the `#000000` surface (the current word is the cyan
> glowing box). **NEVER dim, fade, gray, or reduce the opacity of reading text** — a faded /
> low-contrast / dark-on-dark reading surface (e.g. a `0.5`/`0.32` opacity model) is a **live
> failure** the operator literally cannot see, and is forbidden. A blind build must show bright
> white text throughout. (Verify §16b.4c asserts every `.teleprompter-word` computed `color` is
> `rgb(255, 255, 255)` and `opacity` `1`, except the single cyan `word-active`.)

This is the CEO-original look and is load-bearing: exactly **one** `word-active` at a time (§7.4),
the glowing cyan box on the current word, every other word plain **bright white** (full contrast).
**Do NOT** dim/fade other words, **do NOT** strip the box/glow/accent — the "calm, no-box, faded"
variant was an invented deviation and is discarded. (Acceptance §16b.4: the active word's computed `color` is
`rgb(0, 212, 255)`, it has a non-`none` `box-shadow` and a gradient `background-image`, exactly
one `.word-active` exists, and it is centered.)

### 11.3 NO decorative background layer (the starfield is removed)
**There is no starfield, no sparkles, no shooting-stars, no particle/animation layer behind the
text.** The original shipped a CSS twinkling starfield and four Aceternity-style decorative
components (`sparkles` via `@tsparticles`, `shooting-stars`, `shiny-button` + `spotlight-card`
via `framer-motion`); **all are removed.** The reading surface is **solid `#000000`** with
nothing behind the words. A `pulse-glow` on the controller's online dot is the only ambient
animation allowed, and it lives on the **controller pill, not the reading surface**:
```css
@keyframes pulse-glow { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.3);opacity:.7} }
```
(Verify J8 asserts there is **no** `.stars`/starfield element on the reading surface and **no**
`@tsparticles`/`framer-motion` in the bundle.)

### 11.4 Sliders (exact)
Range inputs are restyled: track `height 8px`, `border-radius 9999px`, a faint
cyan→violet track tint; thumb `18×18px` round, `linear-gradient(135deg,#00d4ff,#7b2ff7)`,
`box-shadow 0 0 0 4px rgba(0,212,255,0.2)`. (The accent on controls is fine and desired; the
**reading word** carries the same cyan accent as its glowing-box highlight — §11.2.)

### 11.5 Typography & chrome
- Body / reading font: **a real readable teleprompter face** — `'Inter', 'Helvetica Neue',
  system-ui, -apple-system, sans-serif`, **`font-weight: 500`**, **`letter-spacing: 0`
  (normal)**, `line-height: 1.8`, `text-align: center`. **Not** a thin 300 weight, **not**
  widely tracked — those read as a dev-demo, not a teleprompter.
- Controls/cards: rounded (radius ~1.5rem panels), translucent dark surfaces with backdrop
  blur, the accent on primary actions. Not pixel-pinned; the **load-bearing** visual values are
  §11.1–11.4 (solid-black surface, the **original glowing-box active word** §11.2, no decorative
  layer, accent-on-controls) and the §7 rendering math.

> **De-scaffold note (deliberate, load-bearing).** The de-scaffold tells removed are: (1) a
> starfield/particle layer behind the text, (2) a thin widely-tracked font, (3) status/units
> chrome on the display. **The active-word highlight is NOT a scaffold tell** — the CEO-original
> cyan→violet **glowing box** on the single current word (§11.2) is the required, correct look;
> the earlier "calm / no-box / faded" variant was an invented deviation and is discarded. A
> rebuild that ships the starfield/thin-font/display-chrome — or that drops the original glowing
> word-box for a fade/crawl — has misread §7/§8.5/§11.

---

## 12. Inputs (auto-detected & auto-resolved — **NO interview, NO questions**)

Run `detect` for every row and **immediately AUTO-RESOLVE it yourself** (install / generate /
default) per the `auto-resolve` column. **Do NOT send an interview message, do NOT ask, do NOT
present a menu, do NOT wait for a human** — resolve each row in-line and run straight through to
`SEED_RESULT=DONE` (or one `BLOCKED_REASON=` only if a resolve is genuinely impossible, e.g. no
network). Every dependency here is **install-if-missing**, unconditionally.

| name | detect | auto-resolve (do this, never ask) |
|---|---|---|
| `uv` on PATH | `command -v uv` | If missing: `curl -LsSf https://astral.sh/uv/install.sh \| sh`, then `export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"` and re-check. uv manages the backend env + Python ≥3.11 (downloads Python itself). **Install it — do not offer pip/venv as an alternative menu.** |
| Node.js ≥ 18 + npm | `node -e 'process.exit(process.versions.node.split(".")[0]>=18?0:1)'` | If missing/old: install non-interactively. Debian/Ubuntu: `curl -fsSL https://deb.nodesource.com/setup_22.x \| sudo -E bash - && sudo apt-get install -y nodejs`. macOS: `brew install node`. Then re-check. |
| Layer-2 browser (Playwright Chromium) | `npx --yes playwright --version` then a chromium presence check | Install it for §16 Layer 2 the way **Step 0** does: the **browser binary** (`npx --yes playwright install chromium`) **AND its system libs** (`sudo npx --yes playwright install-deps chromium`, or an explicit `apt-get install libnss3 …`). **The browser binary ALONE is not enough — bare `playwright install chromium` fails host-deps validation on a minimal container; the system libraries are required and need root (use passwordless sudo).** Do this as part of the run, not "if convenient". Only if Chromium is genuinely uninstallable, record it next to the Layer-1 proof and `BLOCKED_REASON=browser_uninstallable`. |
| Ports 9000 + 9001 | `lsof -i :9000 -i :9001 \| grep -q LISTEN` | Fixed contracts. If a **prior teleprompter** of this build holds them, reclaim them (stop the old services) and continue. If a foreign process holds them and cannot be freed, `BLOCKED_REASON=port_in_use`. Never ask which to keep. |
| `TP_WORKSPACE` | `[ -n "${TP_WORKSPACE:-}" ]` | Default to `$HOME/teleprompter`; create if missing. No prompt. |
| `CONTENT_API_KEY` | `[ -s "$TP_WORKSPACE/backend/.env" ] && grep -q '^CONTENT_API_KEY=..' "$TP_WORKSPACE/backend/.env"` | Auto-generate at build (`openssl rand -hex 16`) → `backend/.env` (chmod 600). On re-build, **reuse the existing key** (never ask reuse-vs-reset). |
| LAN/tailnet IP (phone display) | auto-detect | Only used to print `http://<ip>:9001/?mode=display` on the operator card. No prompt. |
| Prior `$TP_WORKSPACE` build | `[ -d "$TP_WORKSPACE" ]` | **Default, no prompt:** rebuild source, **PRESERVE `backend/.env`**, restart services, re-verify (idempotent). Never ask "reset?". |

Substrate assumptions: macOS/Linux; internet for installs + `uv sync` / `npm install`. No
accounts, no operator-supplied secrets, no Docker. **Internet is the only external need; missing
tools are installed by the Steps, never escalated to a human.**

---

## 13. Components (what this seed assembles)

| Component | Role |
|---|---|
| `backend/` | FastAPI + native WebSocket state server (§4–5). `GET /`, `POST /api/content` (X-API-Key), `WS /ws`. Single shared `local-shared` state, **seeded with the §10.5 sample content**. pydantic-settings reads `backend/.env`. Managed by uv. |
| `frontend/` | Vite + React + TS + Tailwind SPA (§6–8, §11). Controller (**paste-Markdown box + Copy-formatting-prompt §8.1** + **segments panel, click-to-set-current §8.7** + presentation + controls) and **script-only display** off `?mode=display`. Solid-black reading surface, **original glowing-box word-by-word highlight (§7.4/§11.2)**, mirror mode. Multi-device: every controller action replicates to every display over WS (§15). WS URL derived from hostname — **no env**. **No calibration. No script library. No draggable word-bar. No starfield/particle libs.** |
| `sample-script.md` | The sample script (§10.4): parser fixture (5 segments / 3 sections) + first-load demo content. |
| Verify harness | **SHIPPED & PINNED in §16** — write `verify/layer1.py` + `verify/layer2.mjs` + `verify/probe.mjs` **verbatim** and run them; do **NOT** re-author (a re-authored harness = inconsistent bars + its own false greens/reds — see §16's WHY). |

---

## 14. Steps — build & run (zero pre-baked source)

The agent may substitute equivalent commands but must preserve the contracts: **ports
9000/9001; `backend/.env` chmod 600; key never echoed to logs; no frontend env; the spec
(§4–11) is the source of truth — build from it, do not fetch a reference implementation.**

### Step 0: Preflight — autonomous detect-and-install (NO interview)
Run every §12 `detect` and **auto-resolve each row in place** — install every missing
dependency, generate/default the rest. **Send no message, ask nothing, wait for no one.** This
is a pure setup step that leaves the machine ready, then falls straight through to Step 1.
Concretely, install the toolchain up front so nothing later has to stop:
```sh
# uv (backend env + Python ≥3.11) — install if missing, no alternative offered
command -v uv >/dev/null 2>&1 || curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
command -v uv >/dev/null 2>&1 || { echo "BLOCKED_REASON=uv_install_failed"; exit 1; }
# Node ≥18 (Vite) — install non-interactively if missing/old (see §12 for per-OS command)
node -e 'process.exit(process.versions.node.split(".")[0]>=18?0:1)' 2>/dev/null || {
  if command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs
  elif command -v brew >/dev/null 2>&1; then brew install node; fi
}
node -e 'process.exit(process.versions.node.split(".")[0]>=18?0:1)' || { echo "BLOCKED_REASON=node_unavailable"; exit 1; }
# Playwright Chromium for §16 Layer 2 — install the BROWSER + its SYSTEM LIBS now so Verify
# never pauses. On a minimal container, `npx playwright install chromium` ALONE fails host-deps
# validation (missing libnss3/libatk/… ) — the system libraries need a package-manager install,
# which needs root. Do both, using passwordless sudo when present:
SUDO=""; command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null && SUDO="sudo"
npx --yes playwright install chromium || true                       # browser binary (user-space)
$SUDO npx --yes playwright install-deps chromium 2>/dev/null \
  || npx --yes playwright install --with-deps chromium 2>/dev/null \
  || $SUDO sh -c 'command -v apt-get >/dev/null && apt-get update -qq && apt-get install -y -qq libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2' \
  || true   # system libs; if none of these work, §16 Layer 2 records browser_uninstallable
```
After this step the run is fully provisioned; **everything below executes autonomously to
`SEED_RESULT=DONE`.**

### Step 1: Scaffold the backend (§4–5)
Create `$TP_WORKSPACE/backend` as a uv project (Python ≥3.11) with deps from §2. Implement the
FastAPI app: health, content API (503/401/200 contract), WS `/ws` (initial sync + the §4.3
message loop + merge rules, including **content-edit-does-not-reset-position**), the state model
+ defaults (§5, **seed `content` with the §10.5 sample**), play scheduling/NTP (§4.4), WPM
derivation (§4.5). Config via pydantic-settings reading `.env` (`LOCAL_MODE`, `CONTENT_API_KEY`).

### Step 2: Backend env + deps
```sh
cd "$TP_WORKSPACE/backend"
# Key generation must not depend on any one tool — fall back so this never stalls:
gen_key() { openssl rand -hex 16 2>/dev/null || python3 -c 'import secrets;print(secrets.token_hex(16))'; }
[ -s .env ] || printf 'LOCAL_MODE=true\nCONTENT_API_KEY=%s\n' "$(gen_key)" > .env   # reuse existing .env if present
chmod 600 .env
uv sync
```

### Step 3: Scaffold the frontend (§6–8, §11)
Create `$TP_WORKSPACE/frontend` as a Vite React-TS app. Vite config: `host 0.0.0.0`, `port
9001`, `allowedHosts: true`, alias `@→src`. Implement: mode routing, the WS hook (hostname-
derived URL, reconnect, `isConnected`), the display (tokenizer + font math + **solid-black
surface** + **original word-by-word auto-scroll: single glowing-box `word-active` advancing
word-by-word, centered via per-word `scrollIntoView`** + **mirror mode**, §7/§8.5/§11), the controller
**paste-Markdown box + Copy-formatting-prompt (§8.1) + segments panel (§8.7, click-to-set-current)**,
the presentation view + controls + **segment-based keybindings (§8.3–8.4, NO word-scrub bar)**, the
countdown ring (§8.6), the §11 design tokens / slider styling. **No** calibration panel, **no script
library**, **no word-scrub bar**, **no** `@tsparticles`/`framer-motion`, **no** starfield. Then `npm install`.

### Step 4: Sample script (§10.4) — no terminal sender
Write `sample-script.md` verbatim (§10.4) — it is the parser fixture (5 segments / 3 sections)
and the first-load demo. The segment parser is **frontend** (§8.7, the §10.1 rule); there is no
`send_scripts.py` (cut, §10.3).

### Step 5: Start both services (supervised)
**Reclaim the ports SAFELY first — kill by LISTENING PORT, never by command-string.** A
`pkill -f 'uvicorn …'` / `pkill -f 'npm run dev'` matches **the orchestrating shell's own command
line** (it contains that string) and kills the script running the Steps/Verify (observed: exit
144). Always free a port by the PID that is *listening* on it:
```sh
stop_port() {  # free port $1 by its listener PID(s); tool-agnostic, never self-matches
  pids="$(lsof -ti tcp:"$1" 2>/dev/null || true)"
  [ -z "$pids" ] && pids="$(fuser "$1"/tcp 2>/dev/null || true)"
  [ -n "$pids" ] && kill $pids 2>/dev/null || true
}
stop_port 9000; stop_port 9001; sleep 1   # idempotent: clears a prior teleprompter on these ports
cd "$TP_WORKSPACE/backend"  && nohup uv run uvicorn api.main:app --host 0.0.0.0 --port 9000 > /tmp/teleprompter-backend.log 2>&1 & echo $! > /tmp/teleprompter-backend.pid
cd "$TP_WORKSPACE/frontend" && nohup npm run dev > /tmp/teleprompter-frontend.log 2>&1 & echo $! > /tmp/teleprompter-frontend.pid
```
Wait until `curl -sf localhost:9000/` and `curl -sf localhost:9001/` both succeed (~10 s for
Vite). `--host 0.0.0.0` so a phone on the LAN can reach both ports. **When the Verify harness
needs a clean backend restart, restart via `stop_port 9000` (or the saved `.pid`) — never
`pkill -f` on the service command string.**

### Step 6: Smoke the sync door (one segment)
With the key from `backend/.env`, POST a segment and confirm a live swap:
```sh
KEY=$(grep '^CONTENT_API_KEY=' "$TP_WORKSPACE/backend/.env" | cut -d= -f2- | tr -d '"')
curl -sf -X POST localhost:9000/api/content -H "X-API-Key: $KEY" -H 'Content-Type: application/json' \
  -d '{"content":"Smoke segment one."}' >/dev/null && echo "content-API swap OK"
```
Expect a 2xx; a wrong key must return 401, unset 503, empty content 422 (§4.2). (The full
paste→parse→5-segment / click-segment flow is exercised by Verify §16.)

### Step 7: Operator card
Print the **network** URLs (so the CEO can run controller and display on **two devices**):
- Controller (laptop): `http://<lan-or-tailnet-ip>:9001/`
- Display (phone at camera): `http://<lan-or-tailnet-ip>:9001/?mode=display`
- How to record: in the controller, **paste your Markdown script** (or click **Copy formatting
  prompt** to get one formatted by your AI), **click a segment** to put it on the display, then
  **Start Presenting** (no calibration). **Mirror** with the display's mirror toggle / `M` for a
  glass rig. Because both ports bind `0.0.0.0` and the WS URL is hostname-derived, opening the
  display URL on a second device replicates every controller action live (multi-device, §15).

### Step 8: Write & run the PINNED Verify (§16) — do NOT re-author it
Write the THREE harness files from §16 **verbatim** (byte-for-byte from the fenced blocks) and
run them — this is the acceptance gate, identical on every install:
```bash
cd "$TP_WORKSPACE"
mkdir -p verify
# Write verify/layer1.py, verify/layer2.mjs, verify/probe.mjs EXACTLY as shipped in §16.
# The §6/§8.3a data-testid contract guarantees the one shipped harness runs on this build.
( cd verify && npm i --no-save playwright >/dev/null 2>&1 || true )   # Chromium binary+libs already from Step 0
python3 verify/layer1.py                                # Layer 1 — protocol (exit 0 iff all pass)
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"  # the served NON-secure origin for 16b.2b
node verify/layer2.mjs "$LAN_IP"                         # Layer 2 — real two-context 7-point user-drive
node verify/probe.mjs                                    # 3 regression probes (parser / Space / WS)
```
All three must exit 0. A non-zero exit is a **real** failure — fix the **product**; or, if the
shipped harness itself is wrong, fix it **here in §16** so every install gets the corrected
harness. **Never silently re-author a per-node harness to make it pass** — that is exactly the
false-green/false-red mechanism this seed was hardened to remove.

---

## 15. Done (observable conditions)

**"Done" = a human can actually RECORD a video with it.** Synthetic checks passing is NOT
done — the bar is the **7-point Definition of a Working Teleprompter**, proven by a **real
user-drive** (§16), not by green check-marks. All 7 must hold:

1. **2-DEVICE SYNC.** Two **independent** clients — a CONTROLLER and a DISPLAY-ONLY in separate
   browser contexts on separate origins (two real devices, not two tabs) — stay in lock-step:
   **every** controller action (paste/edit, settings, segment select, segment advance) shows on
   the display **≤ 1000 ms**, via the backend WS (no shared client state).
2. **PASTE-IN → SEGMENTS.** Paste a **Markdown script** (§10.1) into the controller paste box →
   it parses into the **correct segments** under their section headings (the §10.4 sample → **5
   segments / 3 sections**), shown in the segments panel; the first segment appears on the
   display. The app opens on the **real sample script** (never a placeholder/test string), and a
   **"Copy formatting prompt"** affordance is present and copies the §10.6 text.
3. **SEGMENT REAL-TIME.** **Clicking a segment** (or advancing with the §8.4 keys) on the
   controller swaps the display content to that segment **≤ 1000 ms** and resets it to the top.
   (`POST /api/content` guards still hold: wrong key → 401, unset → 503, empty → 422.)
4. **PRESENT + READ LEGIBLY — the ORIGINAL word-display model.** One click into the presentation
   view; the **single current word is highlighted** (the cyan→violet **glowing box**, exactly one
   `word-active`) and **advances word-by-word**, kept **centered** via per-word `scrollIntoView`
   (§7.4/§11.2). Every word is legible (plain white; no dim/fade). The font is **large enough to
   read at camera distance**. (NOT a continuous crawl, NOT a fade model — those were inventions.)
5. **MID-TAKE CONTROL (no word-bar).** Pause **keeps your place** (it must NOT jump to 0) and
   resume continues from there after the §8.6 countdown (the CEO-original). Navigation between
   takes is by **segment** (click a segment, or next/prev keys), **not** a draggable word-scrub
   bar — that bar is **removed** (§8.3/§8.4); a build that still shows a word-scrub range input
   FAILS this point.
6. **NO DEAD CONTROLS / NO SCAFFOLD / NO CUT FEATURES.** **Every control does something**
   (Play/Pause, Reset, Exit, Speed, Text-size, Countdown, Mirror — no dead buttons, and **no
   word-scrub bar**); and there are **no scaffold tells** — no starfield, no status/units chrome
   on the display, no placeholder/jargon strings — **and no script library** (no save/open/
   rename/delete UI anywhere, §8.2). (The cyan glowing-box active word is the **correct original
   look**, not a scaffold tell — §11.2.)
7. **SURVIVES A REAL SESSION.** A sustained recording session — paste a script, click through
   several segments, present, play, change speed/font, mirror — runs with **zero console/page
   errors**, no crash, no stuck/NaN state, no unbounded drift, the display stays in sync, and the
   controller stays responsive (can exit back to the editor).

Idempotent: re-running where it already succeeded re-verifies (reuses `backend/.env`, restarts
services) instead of breaking state.

---

## 16. Verify (acceptance harness — PINNED & SHIPPED; run it VERBATIM, do NOT re-author)

> **WHY THIS IS PINNED (the false-green/false-red lesson — card add834d5fd3c).** Earlier this
> harness said "you author it." Three fresh nodes then wrote three *different* harnesses →
> three different bars (42 / 41 / 45 checks) AND the harnesses carried their **own** bugs
> (a localStorage-ordering false-RED; a Vite-HMR socket miscounted as a stray app reconnect;
> the original `38/38`-passed-but-broken clipboard false-GREEN). A Verify you re-author every
> install is not a consistency proof — it is a different test each time, and it can be wrong in
> both directions. **So the harness is now SHIPPED, verbatim, below.** Every install writes these
> EXACT files and runs them — it does NOT invent its own. Determinism is the whole point: the
> same strong test on every node is what makes a pass mean the same thing everywhere.
>
> **Self-contained — no reference instance.** It drives ONLY the app this seed built on
> `localhost` (+ the served LAN/tailnet IP for the non-secure clipboard check). It reads
> computed style / DOM and compares to the absolute values in §11 / §7. It keys off the FIXED
> `data-testid` contract (§6, §8, §10) — which is exactly why a single harness runs identically
> on every build. If a check needs anything beyond this app, that is a seed bug — fix the seed.

Two layers + a regression probe, all THREE shipped. **Layer 1 is the minimum bar; Layer 2 + the
probe are required whenever Chromium is obtainable (Step 0 installs it).** Write each file
verbatim, then run them (the §14 runner does this):

```bash
# §14 runs the PINNED harness — it does not author one:
cd "$TP_WORKSPACE"
python3 verify/layer1.py                 # protocol harness — exit 0 iff all pass
LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"   # the served NON-secure origin for 16b.2b
node verify/layer2.mjs "$LAN_IP"          # real two-context user-drive (the 7-point bar)
node verify/probe.mjs                     # 3 regression probes (parser / Space / WS) — see §16b
```

### `verify/layer1.py` — protocol harness (write verbatim)
~~~~python
#!/usr/bin/env python3
"""Layer 1 — protocol harness (SEED.md §16). Exit 0 iff all pass."""
import asyncio
import json
import os
import subprocess
import sys
import time
import urllib.request

import websockets

BACKEND = "http://localhost:9000"
FRONTEND = "http://localhost:9001"
WS = "ws://localhost:9000/ws"
HERE = os.path.dirname(os.path.abspath(__file__))
SAMPLE = os.path.join(HERE, "..", "sample-script.md")

results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" :: {detail}" if detail else ""))


def http(method, url, headers=None, body=None):
    data = body.encode() if isinstance(body, str) else body
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


# ---- §10.1 parse rule (re-implemented, language-agnostic) ----
def parse_segments(md):
    segments = []
    sections = []
    label = ""
    buf = []

    def flush():
        nonlocal buf
        text = "\n".join(buf).strip()
        buf = []
        if text:
            segments.append({"text": text, "section": label})

    for line in md.split("\n"):
        t = line.strip()
        if t == "":
            flush()
        elif t.startswith("#"):
            flush()
            label = t.lstrip("#").strip()
            sections.append(label)
        else:
            buf.append(line)
    flush()
    return segments, sections


async def recv_sync(ws, timeout=5):
    """Read frames until a state:sync arrives; return its data."""
    end = time.time() + timeout
    while time.time() < end:
        raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
        msg = json.loads(raw)
        if msg.get("type") == "state:sync":
            return msg["data"]
    raise TimeoutError("no state:sync")


def read_key():
    env = os.path.join(HERE, "..", "backend", ".env")
    with open(env) as f:
        for line in f:
            if line.startswith("CONTENT_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"')
    return ""


async def main():
    # 1. Health
    status, body = http("GET", BACKEND + "/")
    check("1 health 200 + ok", status == 200 and "ok" in body, f"{status} {body}")

    # 2. Frontend serves root mount node
    status, body = http("GET", FRONTEND + "/")
    check("2 frontend serves root", status == 200 and 'id="root"' in body, f"status={status}")

    # 3. Sample parses to 5 segments / 3 sections
    with open(SAMPLE) as f:
        md = f.read()
    segs, secs = parse_segments(md)
    by_section = {}
    for s in segs:
        by_section[s["section"]] = by_section.get(s["section"], 0) + 1
    ok3 = (
        len(segs) == 5
        and len(secs) == 3
        and by_section.get("Intro") == 2
        and by_section.get("Body") == 2
        and by_section.get("CTA") == 1
    )
    check("3 sample -> 5 segments / 3 sections", ok3, f"{len(segs)} segs, {len(secs)} secs, {by_section}")

    seg1_text = segs[0]["text"]  # first segment (seeded)
    seg_b_text = segs[1]["text"]
    seg_c_text = segs[2]["text"]

    # 4. Seeded content on fresh WS connect
    async with websockets.connect(WS) as ws:
        st = await recv_sync(ws)
        content = st.get("content", "")
        ok4 = (
            content == seg1_text
            and content != ""
            and content != "This is a text from Daniel!"
            and "channel" in content
        )
        check("4 seeded content == first sample segment", ok4, repr(content))

    # 5. Content API guard — wrong key -> 401
    key = read_key()
    status, body = http(
        "POST",
        BACKEND + "/api/content",
        {"X-API-Key": "wrong-key", "Content-Type": "application/json"},
        json.dumps({"content": "x"}),
    )
    check("5a wrong key -> 401", status == 401, f"status={status}")
    # 422 empty content regardless of key
    status, _ = http(
        "POST",
        BACKEND + "/api/content",
        {"X-API-Key": "wrong-key", "Content-Type": "application/json"},
        json.dumps({"content": ""}),
    )
    check("5b empty content -> 422", status == 422, f"status={status}")

    # 5c. 503 when no key configured — spin a throwaway backend with empty key.
    proc = None
    try:
        env = dict(os.environ)
        env["CONTENT_API_KEY"] = ""
        env["LOCAL_MODE"] = "true"
        backend_dir = os.path.join(HERE, "..", "backend")
        proc = subprocess.Popen(
            ["uv", "run", "uvicorn", "api.main:app", "--host", "127.0.0.1", "--port", "9123"],
            cwd=backend_dir,
            env={**env, "CONTENT_API_KEY": ""},
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        # wait for it
        up = False
        for _ in range(30):
            try:
                s, _b = http("GET", "http://127.0.0.1:9123/")
                if s == 200:
                    up = True
                    break
            except Exception:
                pass
            time.sleep(0.3)
        if up:
            s, _b = http(
                "POST",
                "http://127.0.0.1:9123/api/content",
                {"X-API-Key": "anything", "Content-Type": "application/json"},
                json.dumps({"content": "x"}),
            )
            check("5c no key configured -> 503", s == 503, f"status={s}")
        else:
            check("5c no key configured -> 503", False, "throwaway backend did not start")
    finally:
        if proc:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except Exception:
                proc.kill()

    # 6/7. Live load over open WS + segment swap
    async with websockets.connect(WS) as ws:
        await recv_sync(ws)  # initial
        http(
            "POST",
            BACKEND + "/api/content",
            {"X-API-Key": key, "Content-Type": "application/json"},
            json.dumps({"content": seg_b_text}),
        )
        st = await recv_sync(ws)
        ok6 = st.get("content") == seg_b_text and st.get("position") == 0 and st.get("isPlaying") is False
        check("6 content-API swap over open WS (pos0, paused)", ok6,
              f"content_ok={st.get('content')==seg_b_text} pos={st.get('position')} playing={st.get('isPlaying')}")

        http(
            "POST",
            BACKEND + "/api/content",
            {"X-API-Key": key, "Content-Type": "application/json"},
            json.dumps({"content": seg_c_text}),
        )
        st = await recv_sync(ws)
        check("7 segment swap", st.get("content") == seg_c_text, repr(st.get("content"))[:60])

    # 8. Inline edit keeps position
    async with websockets.connect(WS) as ws:
        await recv_sync(ws)
        await ws.send(json.dumps({"type": "state:update", "data": {"content": "EDITED ONE", "isPlaying": True, "position": 12}}))
        await recv_sync(ws)
        await ws.send(json.dumps({"type": "state:update", "data": {"content": "EDITED TWO"}}))
        st = await recv_sync(ws)
        ok8 = st.get("position") == 12 and st.get("content") == "EDITED TWO"
        check("8 inline edit keeps position==12", ok8, f"pos={st.get('position')} content={st.get('content')!r}")
        # reset playing state for cleanliness
        await ws.send(json.dumps({"type": "play:reset", "data": {}}))
        await recv_sync(ws)

    # 9. Two-client broadcast
    async with websockets.connect(WS) as s1, websockets.connect(WS) as s2:
        await recv_sync(s1)
        await recv_sync(s2)
        await s1.send(json.dumps({"type": "state:update", "data": {"content": "SENTINEL-XYZ"}}))
        st2 = await recv_sync(s2)
        ok9a = st2.get("content") == "SENTINEL-XYZ"
        # take-swap with position 0
        await s1.send(json.dumps({"type": "state:update", "data": {"content": seg_b_text, "isPlaying": False, "position": 0}}))
        st2 = await recv_sync(s2)
        ok9b = st2.get("content") == seg_b_text and st2.get("position") == 0
        check("9 two-client broadcast + take-swap pos0", ok9a and ok9b,
              f"sentinel={ok9a} swap={ok9b} pos={st2.get('position')}")

    failed = [r for r in results if not r[1]]
    print(f"\n{'='*50}\nLayer 1: {len(results)-len(failed)}/{len(results)} passed")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
~~~~

### `verify/layer2.mjs` — the REAL two-context USER-DRIVE = the §16b 7-point bar (write verbatim)
~~~~js
// Layer 2 — the REAL USER-DRIVE (SEED.md §16b). Drives the app like a human
// across two independent browser contexts and measures the 7-point bar.
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LAN_IP = process.argv[2] || process.env.TP_LAN_IP || (() => {
  throw new Error('Pass the served LAN/tailnet IP as argv[2] (or TP_LAN_IP). \
The 16b.2b clipboard check MUST run over http://<real-IP>:9001 (a non-secure context), never localhost.')
})()
const CTRL = 'http://localhost:9001'
const DISP = 'http://127.0.0.1:9001'
const IPURL = `http://${LAN_IP}:9001`

const SAMPLE_SCRIPT = `# Intro
Hey everyone, welcome back to the channel.

Today I'll show you how to record your videos reading straight from the screen, without memorizing a single line.

# Body
The text scrolls at your pace, the current word stays highlighted, and you just look at the camera and talk.

If you lose your place, just pause, jump back to the right segment, and keep going — the take is not lost.

# CTA
Paste your script, click Start Presenting, and record your next video reading right off the screen.`

const FORMAT_PROMPT = `Convert the document below into a teleprompter script in Markdown.
Rules:
- Use "#" headings for section titles (for example: Intro, Body, CTA).
- Put each spoken beat — one sentence or short phrase you would read as a single breath — as its own paragraph, separated by a blank line.
- Plain Markdown only: headings and paragraphs. No bullet lists, bold, italics, tables, or notes.
- Output ONLY the formatted script, nothing else.

Document to convert:
<<< paste your raw text here >>>`

const SHOT_DIR = path.join(__dirname, 'shots')
fs.mkdirSync(SHOT_DIR, { recursive: true })

const results = []
function check(name, ok, detail = '') {
  results.append ? null : results.push({ name, ok, detail })
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' :: ' + detail : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function pollDisplayContent(page, needle, timeoutMs = 1500) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const txt = await page.evaluate(() => document.body.innerText)
    if (txt.includes(needle)) return Date.now() - start
    await sleep(30)
  }
  return -1
}

async function activeIndex(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.word-active')
    return el ? Number(el.getAttribute('data-word-index')) : null
  })
}
async function activeCount(page) {
  return page.evaluate(() => document.querySelectorAll('.word-active').length)
}

const errors = []

async function main() {
  const browser = await chromium.launch()
  const vp = { width: 1920, height: 1080 }

  const ctxA = await browser.newContext({ viewport: vp })
  const ctxB = await browser.newContext({ viewport: vp })
  await ctxA.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: CTRL })

  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()
  for (const [p, who] of [[pageA, 'A'], [pageB, 'B']]) {
    p.on('console', (m) => {
      if (m.type() !== 'error') return
      const t = m.text()
      // Ignore the deliberate backstop-probe failures (wrong-key 401 / empty
      // 422) this harness itself fires — the product never POSTs /api/content
      // (it syncs over WebSocket), so these are test traffic, not app errors.
      if (/status of 401|status of 422/.test(t)) return
      errors.push(`${who}: ${t}`)
    })
    p.on('pageerror', (e) => errors.push(`${who}: ${e.message}`))
  }

  await pageA.goto(CTRL)
  await pageB.goto(DISP + '/?mode=display')
  await pageA.waitForSelector('[data-testid="script-input"]')
  await sleep(800)

  // ---- POINT 2: PASTE-IN -> SEGMENTS (fresh-load assertions first) ----
  const boxVal = await pageA.inputValue('[data-testid="script-input"]')
  check('2 paste box holds the sample script', boxVal.trim() === SAMPLE_SCRIPT.trim(),
    boxVal.includes('This is a text from Daniel') ? 'has forbidden test string' : `len=${boxVal.length}`)
  const segCount = await pageA.locator('[data-testid="segment"]').count()
  const secCount = await pageA.locator('[data-testid="segment-section"]').count()
  check('2 segments=5 / sections=3', segCount === 5 && secCount === 3, `segs=${segCount} secs=${secCount}`)
  const hasCopy = await pageA.locator('[data-testid="copy-format-prompt"]').count()
  check('2 copy-format-prompt present', hasCopy === 1)
  // 2c ENGLISH-ONLY (CEO rule, card add834d5fd3c): the sample content + the rendered section
  // labels must be English — NOTHING in Portuguese in the SEED or the app.
  const secLabels = await pageA.$$eval('[data-testid="segment-section"]', (els) => els.map((e) => (e.textContent || '').trim()))
  const sampleEnglish = boxVal.includes('welcome back to the channel') && boxVal.includes('Start Presenting')
  const labelsEnglish = secLabels.some((l) => /^body$/i.test(l)) && !secLabels.some((l) => /corpo/i.test(l))
  const ptMarkers = /(voc[eê]|v[ií]deo do canal|\bcanal\b|roteiro|\bcorpo\b|apresenta[çc]|grava[çc]|descri[çc]|celular|comeca|pra c[âa]mera)/i
  const noPt = !ptMarkers.test(boxVal) && !secLabels.some((l) => ptMarkers.test(l))
  check('2c sample + section labels are ENGLISH-only (no Portuguese)', sampleEnglish && labelsEnglish && noPt,
    `secLabels=${JSON.stringify(secLabels)} sampleEnglish=${sampleEnglish} noPt=${noPt}`)
  // re-parse on fresh paste
  await pageA.fill('[data-testid="script-input"]', '# A\nuno\n\ndois\n\n# B\ntres')
  await sleep(300)
  const segCount2 = await pageA.locator('[data-testid="segment"]').count()
  const secCount2 = await pageA.locator('[data-testid="segment-section"]').count()
  check('2 re-parse -> 3 segments / 2 sections', segCount2 === 3 && secCount2 === 2, `segs=${segCount2} secs=${secCount2}`)

  // ---- POINT 1: 2-DEVICE SYNC ----
  const originsDiffer = CTRL !== DISP
  check('1 two independent origins (not two tabs)', originsDiffer, `${CTRL} vs ${DISP}`)
  await pageA.fill('[data-testid="script-input"]', '# Intro\nSYNCTOKEN42 hello world\n\nsecond beat\n\n# B\nthird beat')
  const t0 = Date.now()
  const lat = await pollDisplayContent(pageB, 'SYNCTOKEN42', 1500)
  check('1 display reflects controller edit <= 1000ms', lat >= 0 && lat <= 1000, `latency=${lat}ms`)

  // ---- POINT 2b: CLIPBOARD over NON-SECURE http-IP ----
  try {
    const ctxIP = await browser.newContext({ viewport: vp })
    await ctxIP.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: IPURL })
    const pageIP = await ctxIP.newPage()
    await pageIP.goto(IPURL + '/')
    await pageIP.waitForSelector('[data-testid="copy-format-prompt"]')
    const insecure = await pageIP.evaluate(() => window.isSecureContext === false)
    check('2b origin is NON-secure (isSecureContext===false)', insecure, `secure=${!insecure}`)

    await pageIP.click('[data-testid="copy-format-prompt"]')
    await sleep(300)
    const copyState1 = await pageIP.getAttribute('[data-testid="copy-format-prompt"]', 'data-copy-state')
    const btnText1 = (await pageIP.textContent('[data-testid="copy-format-prompt"]')) || ''
    check('2b copy reports real success (data-copy-state=ok + "Copied ✓")',
      copyState1 === 'ok' && btnText1.includes('Copied ✓'), `state=${copyState1} text=${JSON.stringify(btnText1)}`)

    // read OS clipboard back from a SECURE localhost page
    const readPage = await ctxA.newPage()
    await readPage.goto(CTRL + '/')
    await readPage.bringToFront()
    let clip = ''
    try {
      clip = await readPage.evaluate(() => navigator.clipboard.readText())
    } catch (e) {
      clip = '__READ_FAILED__:' + e.message
    }
    check('2b prompt text actually landed on the clipboard (exact)',
      clip === FORMAT_PROMPT, clip.startsWith('__READ_FAILED__') ? clip : `match=${clip === FORMAT_PROMPT} len=${clip.length}`)

    // force the fallback to fail -> must show real failure, no fake "Copied ✓"
    await pageIP.bringToFront()
    await pageIP.evaluate(() => {
      // @ts-ignore
      document.execCommand = () => false
    })
    await pageIP.click('[data-testid="copy-format-prompt"]')
    await sleep(300)
    const copyState2 = await pageIP.getAttribute('[data-testid="copy-format-prompt"]', 'data-copy-state')
    const btnText2 = (await pageIP.textContent('[data-testid="copy-format-prompt"]')) || ''
    await readPage.bringToFront()
    let clip2 = ''
    try {
      clip2 = await readPage.evaluate(() => navigator.clipboard.readText())
    } catch {
      clip2 = clip
    }
    check('2b forced failure shows real fail (not a fake "Copied ✓") + clipboard unchanged',
      copyState2 === 'fail' && !btnText2.includes('Copied ✓') && btnText2.toLowerCase().includes('fail') && clip2 === FORMAT_PROMPT,
      `state=${copyState2} text=${JSON.stringify(btnText2)} clipUnchanged=${clip2 === FORMAT_PROMPT}`)
    await readPage.close()
    await ctxIP.close()
  } catch (e) {
    check('2b clipboard non-secure flow', false, 'threw: ' + e.message)
  }

  // ---- restore the full sample on the controller for segment tests ----
  await pageA.fill('[data-testid="script-input"]', SAMPLE_SCRIPT)
  await sleep(400)

  // ---- POINT 3: SEGMENT REAL-TIME ----
  const seg2Text = 'The text scrolls at your pace'
  await pageA.locator('[data-testid="segment"][data-segment-index="2"]').click()
  const lat3 = await pollDisplayContent(pageB, seg2Text, 1500)
  const bActive = await activeIndex(pageB)
  check('3 segment click -> display swaps <=1000ms + resets to top', lat3 >= 0 && lat3 <= 1000 && (bActive === 0 || bActive === null),
    `latency=${lat3}ms activeIdx=${bActive}`)
  await pageA.locator('[data-testid="segment"][data-segment-index="3"]').click()
  const lat3b = await pollDisplayContent(pageB, 'If you lose your place', 1500)
  check('3 second segment click updates display', lat3b >= 0 && lat3b <= 1000, `latency=${lat3b}ms`)

  // backstop guards via fetch
  const key = fs.readFileSync(path.join(__dirname, '..', 'backend', '.env'), 'utf8')
    .split('\n').find((l) => l.startsWith('CONTENT_API_KEY=')).split('=')[1].trim()
  const guard = await pageA.evaluate(async () => {
    const wrong = await fetch('http://localhost:9000/api/content', {
      method: 'POST', headers: { 'X-API-Key': 'nope', 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'x' }),
    })
    const empty = await fetch('http://localhost:9000/api/content', {
      method: 'POST', headers: { 'X-API-Key': 'nope', 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    })
    return { wrong: wrong.status, empty: empty.status }
  })
  check('3 backstop guards (wrong->401, empty->422)', guard.wrong === 401 && guard.empty === 422, JSON.stringify(guard))
  void key

  // reset to segment 0 for presentation
  await pageA.locator('[data-testid="segment"][data-segment-index="0"]').click()
  await sleep(300)

  // ---- POINT 4: PRESENT + READ LEGIBLY ----
  await pageA.locator('[data-testid="start-presenting"]').click()
  await pageA.waitForSelector('[data-testid="play-toggle"]')
  // select a 3s countdown so the pre-roll overlay can be sampled on BOTH clients (Point 4b)
  await pageA.locator('[data-testid="countdown-option"]', { hasText: '3s' }).first().click()
  await sleep(200)
  await pageA.locator('[data-testid="play-toggle"]').click()

  // ---- POINT 4b: COUNTDOWN OVERLAY (CEO regressions, card add834d5fd3c) ----
  // The pre-roll MUST render on the DISPLAY (?mode=display), sit IN FRONT of the text, have a
  // blurred backdrop behind the number, animate continuously, and count 3->2->1.
  const cdProbe = async (page) => {
    for (let i = 0; i < 30; i++) {
      const info = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="countdown-overlay"]')
        if (!el) return null
        const all = [el, ...el.querySelectorAll('*')]
        const cx = Math.round(window.innerWidth / 2), cy = Math.round(window.innerHeight / 2)
        const top = document.elementFromPoint(cx, cy)
        const inFront = !!top && (top === el || el.contains(top) || (top.closest && top.closest('[data-testid="countdown-overlay"]') === el))
        const animated = all.some((n) => { const s = getComputedStyle(n); return (s.animationName && s.animationName !== 'none') || (s.transitionDuration && s.transitionDuration !== '0s') })
        const hasBlur = all.some((n) => { const s = getComputedStyle(n); return /blur\(/.test(s.backdropFilter || '') || /blur\(/.test(s.webkitBackdropFilter || '') || /blur\(/.test(s.filter || '') })
        const num = (el.textContent || '').replace(/[^0-9]/g, '')
        return { present: true, inFront, animated, hasBlur, num }
      })
      if (info && info.present) return info
      await sleep(60)
    }
    return null
  }
  const cdA = await cdProbe(pageA)
  const cdB = await cdProbe(pageB)
  const cdNum1 = cdB ? cdB.num : null
  await sleep(1000)
  const cdNum2 = await pageB.evaluate(() => { const el = document.querySelector('[data-testid="countdown-overlay"]'); return el ? (el.textContent || '').replace(/[^0-9]/g, '') : null })
  check('4b countdown renders on the DISPLAY (not just controller)', !!cdB && cdB.present, `display=${JSON.stringify(cdB)} ctrl=${JSON.stringify(cdA)}`)
  check('4b countdown is IN FRONT of the text (not behind)', !!cdB && cdB.inFront, `inFront=${cdB && cdB.inFront}`)
  check('4b countdown has a blurred backdrop behind the number', !!cdB && cdB.hasBlur, `hasBlur=${cdB && cdB.hasBlur}`)
  check('4b countdown animates continuously (CSS animation/transition)', !!cdB && cdB.animated, `animated=${cdB && cdB.animated}`)
  check('4b countdown shows the right digit and counts down (starts <=3, then 3->2->1)',
    cdNum1 !== null && cdNum2 !== null && Number(cdNum1) >= 1 && Number(cdNum1) <= 3 && Number(cdNum2) < Number(cdNum1) && Number(cdNum2) >= 1,
    `n1=${cdNum1} n2=${cdNum2}`)

  await sleep(2600) // remainder of the 3s countdown + ~1.6s playback before sampling word-advance

  const dispActiveCount = await activeCount(pageB)
  const idxStart = await activeIndex(pageB)
  await sleep(1500)
  const idxLater = await activeIndex(pageB)
  check('4 single word-active that advances word-by-word', dispActiveCount === 1 && idxStart !== null && idxLater !== null && idxLater > idxStart,
    `count=${dispActiveCount} idx ${idxStart}->${idxLater}`)

  const style = await pageB.evaluate(() => {
    const el = document.querySelector('.word-active')
    if (!el) return null
    const cs = getComputedStyle(el)
    return { color: cs.color, boxShadow: cs.boxShadow, bg: cs.backgroundImage }
  })
  check('4 active word = original glowing box (cyan color + glow + gradient)',
    !!style && style.color === 'rgb(0, 212, 255)' && style.boxShadow !== 'none' && style.bg.includes('gradient'),
    JSON.stringify(style))

  const centered = await pageB.evaluate(() => {
    const el = document.querySelector('.word-active')
    if (!el) return 1
    const cont = el.closest('.overflow-y-auto')
    const er = el.getBoundingClientRect()
    const cr = cont.getBoundingClientRect()
    return Math.abs((er.top + er.height / 2) - (cr.top + cr.height / 2)) / cr.height
  })
  check('4 active word is centered (within ~15%)', centered <= 0.15, `offsetFrac=${centered.toFixed(3)}`)

  const contrast = await pageB.evaluate(() => {
    const words = [...document.querySelectorAll('.teleprompter-word')].filter((w) => !w.classList.contains('word-active'))
    let bad = 0
    for (const w of words) {
      const cs = getComputedStyle(w)
      if (cs.color !== 'rgb(255, 255, 255)' || cs.opacity !== '1') bad++
    }
    return { total: words.length, bad }
  })
  check('4 readable contrast: all non-active words pure white opacity 1', contrast.bad === 0, JSON.stringify(contrast))

  const fontPx = await pageB.evaluate(() => {
    const el = document.querySelector('.teleprompter-word')
    return el ? parseFloat(getComputedStyle(el).fontSize) : 0
  })
  check('4 reading font large enough (>=40px @1080)', fontPx >= 40, `fontSize=${fontPx}px`)

  // screenshots — both clients during playback
  await pageA.screenshot({ path: path.join(SHOT_DIR, 'controller-playback.png') })
  await pageB.screenshot({ path: path.join(SHOT_DIR, 'display-playback.png') })

  // ---- POINT 5: MID-TAKE CONTROL ----
  const idxBeforePause = await activeIndex(pageA)
  await pageA.keyboard.press('Space') // pause
  await sleep(400)
  const idxAfterPause = await activeIndex(pageA)
  check('5 pause keeps place (index preserved, non-zero)',
    idxAfterPause !== null && idxAfterPause > 0 && idxAfterPause === idxBeforePause,
    `before=${idxBeforePause} after=${idxAfterPause}`)

  // HARNESS TIMING FIX (card add834d5fd3c): Point 4b selected a 3s countdown to sample the
  // overlay; a faithful §8.6 resume runs the FULL selected countdown before scrolling, so a 3s
  // resume would not advance within the assertion window (false-fail). Select a 1s countdown here
  // (controls are visible while paused) so the resume pre-roll is short. This is a HARNESS timing
  // fix, NOT a product change — the product still runs the full selected countdown on resume; do
  // NOT cap the product's resume countdown to satisfy this check.
  await pageA.locator('[data-testid="countdown-option"]', { hasText: '1s' }).first().click()
  await sleep(150)
  await pageA.keyboard.press('Space') // resume -> 1s countdown then continue
  await sleep(3000) // 1s countdown + ~2s advance window (generous, machine-speed independent)
  const idxResumed = await activeIndex(pageA)
  const wcSeg = await pageA.evaluate(() => document.querySelectorAll('.teleprompter-word').length)
  const atSegEnd = idxAfterPause !== null && idxAfterPause >= wcSeg - 1
  // "resume continues" = the take is NOT frozen/reset: the index advances when there is room,
  // and HOLDS at the last word when the pause already landed on the segment end (nothing to
  // advance to — correct product behavior, not a failure). The index must never regress/reset.
  // (Determinism fold — card add834d5fd3c: the old `> idxAfterPause` false-failed whenever the
  // pause happened to land on the segment's last word; flaky run-to-run.)
  check('5 resume continues from same word (index advances, or holds at segment end)',
    idxResumed !== null && idxResumed >= idxAfterPause && (idxResumed > idxAfterPause || atSegEnd),
    `resumedTo=${idxResumed} afterPause=${idxAfterPause} words=${wcSeg}`)

  // previous segment via ArrowLeft -> swaps + resets to top, B follows
  await pageA.keyboard.press('ArrowLeft')
  await sleep(200)
  const bActive5 = await activeIndex(pageB)
  const bIdxReset = bActive5 === 0 || bActive5 === null
  const dispText5 = await pageB.evaluate(() => document.body.innerText)
  check('5 prev-segment swaps display + resets to top', bIdxReset && dispText5.length > 0, `bActive=${bActive5}`)

  const rangeInfo = await pageA.evaluate(() => {
    const ranges = [...document.querySelectorAll('input[type="range"]')]
    const ids = ranges.map((r) => r.getAttribute('data-testid'))
    const scrub = document.querySelector('[data-testid="word-scrub"],[data-testid="word-bar"],[data-testid="position-slider"],[data-testid="scrub"]')
    return { count: ranges.length, ids, hasScrub: !!scrub }
  })
  check('5 NO word-scrub bar (only speed + size sliders)',
    rangeInfo.count === 2 && !rangeInfo.hasScrub && rangeInfo.ids.includes('speed-slider') && rangeInfo.ids.includes('size-slider'),
    JSON.stringify(rangeInfo))

  // ---- POINT 6: NO DEAD CONTROLS / NO SCAFFOLD / NO CUT FEATURES ----
  // (a) Reset = deterministic jump-to-START from ANY state (CEO bug, card add834d5fd3c:
  //     Reset was state-dependent — it paused instead of resetting, a 2nd click did nothing,
  //     and only worked after pressing Play again). Drive it from PLAYING, ALREADY-RESET, PAUSED.
  await pageA.locator('[data-testid="countdown-option"]', { hasText: '1s' }).first().click()
  await sleep(150)
  // -- from PLAYING --
  const lbl6 = (await pageA.textContent('[data-testid="play-toggle"]')).trim()
  if (!/Pause/.test(lbl6)) { await pageA.locator('[data-testid="play-toggle"]').click() }
  await sleep(1600) // 1s countdown + advance a few words
  const idxPlaying6 = await activeIndex(pageA)
  await pageA.locator('[data-testid="reset-btn"]').click()
  await sleep(300)
  const idxResetPlaying = await activeIndex(pageA)
  const lblResetPlaying = (await pageA.textContent('[data-testid="play-toggle"]')).trim()
  check('6a Reset from PLAYING -> jumps to start (index 0) AND pauses',
    (idxResetPlaying === 0 || idxResetPlaying === null) && /Play/.test(lblResetPlaying) && (idxPlaying6 || 0) > 0,
    `playingIdx=${idxPlaying6} afterReset=${idxResetPlaying} label=${lblResetPlaying}`)
  // -- from ALREADY-RESET (idempotent: a 2nd click must still be at the start, not a broken no-op) --
  await pageA.locator('[data-testid="reset-btn"]').click()
  await sleep(200)
  const idxResetAgain = await activeIndex(pageA)
  check('6a Reset from ALREADY-RESET -> stays at start (idempotent)',
    idxResetAgain === 0 || idxResetAgain === null, `idx=${idxResetAgain}`)
  // -- from PAUSED (play, advance, Space-pause mid-take, then Reset) --
  await pageA.locator('[data-testid="play-toggle"]').click()
  await sleep(1600)
  await pageA.keyboard.press('Space') // pause mid-take
  await sleep(250)
  const idxPaused6 = await activeIndex(pageA)
  await pageA.locator('[data-testid="reset-btn"]').click()
  await sleep(300)
  const idxResetPaused = await activeIndex(pageA)
  check('6a Reset from PAUSED -> jumps to start (index 0)',
    (idxResetPaused === 0 || idxResetPaused === null) && (idxPaused6 || 0) > 0,
    `pausedIdx=${idxPaused6} afterReset=${idxResetPaused}`)
  // Mirror -> scaleX(-1)
  await pageA.locator('[data-testid="mirror-btn"]').click()
  await sleep(200)
  const mirrorXform = await pageA.evaluate(() => {
    const el = document.querySelector('.teleprompter-word')
    const block = el ? el.parentElement : null
    return block ? getComputedStyle(block).transform : 'none'
  })
  check('6a Mirror -> scaleX(-1)', mirrorXform.includes('matrix(-1'), mirrorXform)
  await pageA.locator('[data-testid="mirror-btn"]').click() // toggle back
  // Speed extremes
  const speed = pageA.locator('[data-testid="speed-slider"]')
  await speed.focus()
  await speed.fill('-1')
  await sleep(150)
  const speedMin = await pageA.textContent('[data-testid="speed-readout"]')
  await speed.fill('1')
  await sleep(150)
  const speedMax = await pageA.textContent('[data-testid="speed-readout"]')
  check('6a Speed slider extremes read 0.25× / 4.00×',
    speedMin.includes('0.25×') && speedMax.includes('4.00×'), `${speedMin} .. ${speedMax}`)
  await speed.fill('0')
  // Text-size moves display font
  const fontBefore = await pageB.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.teleprompter-word')).fontSize))
  const size = pageA.locator('[data-testid="size-slider"]')
  await size.focus()
  await size.fill('1')
  await sleep(400)
  const fontAfter = await pageB.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.teleprompter-word')).fontSize))
  check('6a Text-size slider moves the display font', fontAfter > fontBefore, `${fontBefore} -> ${fontAfter}`)
  await size.fill('0')
  // Countdown offers 1/3/5
  const cdCount = await pageA.locator('[data-testid="countdown-option"]').count()
  check('6a Countdown offers 1s/3s/5s', cdCount === 3, `options=${cdCount}`)

  // (b) no scaffold tells on the display
  const dispScaffold = await pageB.evaluate(() => {
    const stars = document.querySelector('.stars, [class*="starfield"], [class*="sparkle"]')
    const pill = document.querySelector('[data-testid="status-pill"]')
    const body = document.body.innerText.toLowerCase()
    return { stars: !!stars, pill: !!pill, hasVmin: body.includes('vmin'), hasDaniel: body.includes('text from daniel') }
  })
  check('6b display has no scaffold (no stars/pill/vmin/test-string)',
    !dispScaffold.stars && !dispScaffold.pill && !dispScaffold.hasVmin && !dispScaffold.hasDaniel, JSON.stringify(dispScaffold))
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'frontend', 'package.json'), 'utf8'))
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
  const banned = Object.keys(allDeps).filter((d) => d.includes('tsparticles') || d.includes('framer-motion'))
  check('6b bundle has no @tsparticles / framer-motion', banned.length === 0, JSON.stringify(banned))

  // (c) Exit button must be in the TOP-RIGHT CORNER (CEO regression, card add834d5fd3c) —
  //     assert its position BEFORE clicking it.
  const exitBox = await pageA.evaluate(() => {
    const el = document.querySelector('[data-testid="exit-btn"]')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { cx: (r.left + r.right) / 2, cy: (r.top + r.bottom) / 2, w: window.innerWidth, h: window.innerHeight }
  })
  check('6c Exit button is in the TOP-RIGHT corner (not in the controls bar)',
    !!exitBox && exitBox.cx > exitBox.w * 0.7 && exitBox.cy < exitBox.h * 0.3, JSON.stringify(exitBox))

  // (c) cut features absent — no script library UI anywhere on the editor
  await pageA.locator('[data-testid="exit-btn"]').click()
  await sleep(300)
  const libUI = await pageA.evaluate(() => {
    const txt = document.body.innerText.toLowerCase()
    const libWords = ['save script', 'new script', 'rename', 'delete script', 'my scripts', 'saved scripts', 'script library']
    return libWords.filter((w) => txt.includes(w))
  })
  check('6c no script-library UI (no save/open/rename/delete)', libUI.length === 0, JSON.stringify(libUI))
  const editorRanges = await pageA.evaluate(() => document.querySelectorAll('input[type="range"]').length)
  check('6c no word-scrub range input in editor', editorRanges === 0, `ranges=${editorRanges}`)

  // ---- POINT 7: SURVIVES A REAL SESSION ----
  // click through several segments, verify display matches each
  let allMatch = true
  for (const [idx, needle] of [[1, 'show you how to record'], [4, 'Paste your script'], [2, 'The text scrolls']]) {
    await pageA.locator(`[data-testid="segment"][data-segment-index="${idx}"]`).click()
    const l = await pollDisplayContent(pageB, needle, 1500)
    if (l < 0) allMatch = false
  }
  check('7 click through several segments, display matches each', allMatch)
  // present, play, change speed/font, mirror — a sustained run
  await pageA.locator('[data-testid="start-presenting"]').click()
  await pageA.waitForSelector('[data-testid="play-toggle"]')
  await pageA.locator('[data-testid="countdown-option"]', { hasText: '1s' }).first().click()
  await pageA.locator('[data-testid="play-toggle"]').click()
  await sleep(1800)
  await pageA.keyboard.press('ArrowUp')
  await pageA.keyboard.press('ArrowUp')
  await pageA.locator('[data-testid="mirror-btn"]').click()
  await sleep(1200)
  const idxFinite = await activeIndex(pageA)
  const bInSync = await pageB.evaluate(() => document.body.innerText.length > 0)
  await pageA.locator('[data-testid="exit-btn"]').click()
  await sleep(300)
  const backToEditor = await pageA.locator('[data-testid="script-input"]').count()
  check('7 finite index, display in sync, exit returns to editor',
    idxFinite !== null && Number.isFinite(idxFinite) && bInSync && backToEditor === 1,
    `idx=${idxFinite} inSync=${bInSync} editor=${backToEditor === 1}`)

  // final screenshots after a synced segment click
  await pageA.locator('[data-testid="segment"][data-segment-index="0"]').click()
  await sleep(500)
  await pageA.screenshot({ path: path.join(SHOT_DIR, 'controller-final.png') })
  await pageB.screenshot({ path: path.join(SHOT_DIR, 'display-final.png') })

  check('7 zero console/page errors during the session', errors.length === 0, errors.slice(0, 5).join(' | '))

  await browser.close()

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${'='.repeat(54)}\nLayer 2: ${results.length - failed.length}/${results.length} passed`)
  if (failed.length) {
    console.log('FAILED:')
    failed.forEach((f) => console.log(`  - ${f.name} :: ${f.detail}`))
  }
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error('Layer 2 crashed:', e)
  process.exit(2)
})
~~~~

### `verify/probe.mjs` — 3 pinned REGRESSION PROBES (write verbatim)
> Locks the three behaviors this validation surfaced so they can never silently regress or
> false-fail again: **(1) parser** — a heading immediately followed by text with no blank line
> (`# Intro\nuno`) must parse as section+segment, not collapse; **(2) Space single-toggle** —
> after a mouse-click on Play (button focused), one `Space` toggles EXACTLY once (the global
> keydown `preventDefault()` suppresses the button's native activation — no double-toggle);
> **(3) WS single socket** — under React StrictMode's dev double-mount there is exactly ONE live
> `:9000/ws` socket and NO stray reconnect. **Count only the app's `:9000/ws` socket — Vite's
> `:9001` HMR dev-server WebSocket is unrelated infrastructure; counting it is a harness
> false-RED (the exact mistake that wasted a cycle here).**
~~~~js
// TARGETED BUG-PROBE — 3 specific behaviors, proven at runtime.
import { chromium } from 'playwright'

const CTRL = 'http://localhost:9001'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })

  // ---------- PROBE 3 instrumentation: wrap WebSocket BEFORE any app code ----------
  await ctx.addInitScript(() => {
    const RealWS = window.WebSocket
    window.__wsLog = []
    const t0 = performance.now()
    function WrappedWS(url, protocols) {
      const ws = protocols ? new RealWS(url, protocols) : new RealWS(url)
      const rec = { url, createdAt: performance.now() - t0, ref: ws }
      window.__wsLog.push(rec)
      return ws
    }
    WrappedWS.prototype = RealWS.prototype
    WrappedWS.CONNECTING = RealWS.CONNECTING
    WrappedWS.OPEN = RealWS.OPEN
    WrappedWS.CLOSING = RealWS.CLOSING
    WrappedWS.CLOSED = RealWS.CLOSED
    window.WebSocket = WrappedWS
  })

  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message))

  await page.goto(CTRL)
  await page.waitForSelector('[data-testid="script-input"]')
  await sleep(700)

  // ========================================================================
  // PROBE 1 — parser: heading immediately followed by text, no blank line
  // ========================================================================
  await page.fill('[data-testid="script-input"]', '# Intro\nuno\n\n# Body\ndois')
  await sleep(300)
  const segTexts = await page.$$eval('[data-testid="segment"]', (els) =>
    els.map((e) => e.textContent.trim()),
  )
  const secLabels = await page.$$eval('[data-testid="segment-section"]', (els) =>
    els.map((e) => e.textContent.trim()),
  )
  const p1ok =
    segTexts.length === 2 &&
    secLabels.length === 2 &&
    segTexts[0] === 'uno' &&
    segTexts[1] === 'dois' &&
    secLabels[0] === 'Intro' &&
    secLabels[1] === 'Body'
  console.log(`PROBE 1 PARSER: ${p1ok ? 'PASS' : 'FAIL'}`)
  console.log(`   segments(${segTexts.length})=${JSON.stringify(segTexts)} sections(${secLabels.length})=${JSON.stringify(secLabels)}`)

  // ========================================================================
  // PROBE 2 — Space double-toggle after a mouse-click on Play
  // ========================================================================
  // restore a multi-word script so the index can advance
  await page.fill('[data-testid="script-input"]', '# Intro\numa duas tres quatro cinco seis sete oito nove dez once doze')
  await sleep(200)
  await page.locator('[data-testid="start-presenting"]').click()
  await page.waitForSelector('[data-testid="play-toggle"]')
  await page.locator('[data-testid="countdown-option"]', { hasText: '1s' }).first().click()
  await sleep(150)
  // MOUSE-click Play -> starts 1s countdown, then plays. Button is now focused.
  await page.locator('[data-testid="play-toggle"]').click()
  await sleep(1900) // countdown(1s) + a little playback
  const labelAfterPlay = (await page.textContent('[data-testid="play-toggle"]')).trim()
  const idxPlaying = await page.evaluate(() => {
    const el = document.querySelector('.word-active')
    return el ? Number(el.getAttribute('data-word-index')) : null
  })
  await sleep(500)
  const idxPlaying2 = await page.evaluate(() => {
    const el = document.querySelector('.word-active')
    return el ? Number(el.getAttribute('data-word-index')) : null
  })
  const wasPlaying = labelAfterPlay.includes('Pause') && idxPlaying2 !== null && idxPlaying2 >= idxPlaying

  // Now press Space EXACTLY ONCE. Button is focused from the mouse click.
  await page.keyboard.press('Space')
  await sleep(700)
  const labelAfterSpace = (await page.textContent('[data-testid="play-toggle"]')).trim()
  const idxAfterSpaceA = await page.evaluate(() => {
    const el = document.querySelector('.word-active')
    return el ? Number(el.getAttribute('data-word-index')) : null
  })
  await sleep(700)
  const idxAfterSpaceB = await page.evaluate(() => {
    const el = document.querySelector('.word-active')
    return el ? Number(el.getAttribute('data-word-index')) : null
  })
  // Exactly one toggle: Pause -> Play, and the index froze (no longer advancing).
  const toggledOnce = labelAfterSpace.includes('Play') && idxAfterSpaceA === idxAfterSpaceB
  const p2ok = wasPlaying && toggledOnce
  console.log(`PROBE 2 SPACE DOUBLE-TOGGLE: ${p2ok ? 'PASS' : 'FAIL'}`)
  console.log(`   afterPlay label=${JSON.stringify(labelAfterPlay)} idx ${idxPlaying}->${idxPlaying2} (playing=${wasPlaying})`)
  console.log(`   afterSpace label=${JSON.stringify(labelAfterSpace)} idx frozen ${idxAfterSpaceA}==${idxAfterSpaceB} (toggledOnce=${toggledOnce})`)

  // ========================================================================
  // PROBE 3 — exactly ONE live WebSocket, no stray reconnect (StrictMode)
  // ========================================================================
  // we've been on the page ~5s+ already; sample WS log over a quiet window
  // Count ONLY the app's backend socket (:9000/ws). The dev server's own Vite
  // HMR WebSocket (ws://...:9001/?token=...) is unrelated infrastructure and
  // must be excluded — counting it is a false positive.
  const sample = () =>
    page.evaluate(() =>
      (window.__wsLog || [])
        .filter((r) => /:9000\/ws/.test(r.url))
        .map((r) => ({ createdAt: Math.round(r.createdAt), readyState: r.ref.readyState })),
    )
  const wsReport = await sample()
  await sleep(2500)
  const wsReport2 = await sample()
  const totalCreated = wsReport2.length
  const openNow = wsReport2.filter((r) => r.readyState === 1).length
  const closedNow = wsReport2.filter((r) => r.readyState === 3).length
  // any app socket created AFTER the initial double-mount window (>2000ms) = spurious reconnect
  const lateCreations = wsReport2.filter((r) => r.createdAt > 2000).length
  // no growth between the two samples (stable, no reconnect churn)
  const grewBetweenSamples = wsReport2.length - wsReport.length
  const p3ok = openNow === 1 && lateCreations === 0 && grewBetweenSamples === 0
  console.log(`PROBE 3 WS RECONNECT: ${p3ok ? 'PASS' : 'FAIL'}`)
  console.log(`   app sockets(:9000/ws) created=${totalCreated} open=${openNow} closed=${closedNow} lateReconnects=${lateCreations} growthBetweenSamples=${grewBetweenSamples}`)
  console.log(`   timeline=${JSON.stringify(wsReport2)}`)

  console.log(`\n   (console errors during probe: ${consoleErrors.length})`)
  if (consoleErrors.length) console.log('   ' + consoleErrors.slice(0, 5).join('\n   '))

  await browser.close()
  const allPass = p1ok && p2ok && p3ok
  console.log(`\n${'='.repeat(50)}\nPROBE RESULT: ${allPass ? 'ALL PASS' : 'HAS FAILURES'}`)
  process.exit(allPass ? 0 : 1)
}

main().catch((e) => { console.error('probe crashed', e); process.exit(2) })
~~~~

---

## 16b. The 7-point real user-drive (the acceptance bar — drive it, don't check-mark it)

Each point is exercised by USING the app across **two independent clients** and is accepted only
against the **measured thresholds** (absolute values). These **REPLACE** the old synthetic
J-journeys: a green check-mark is not a pass; the smooth, readable, recoverable drive is.

**1. 2-DEVICE SYNC (independent clients).** Client A = controller (`localhost:9001`), client B =
display-only (`127.0.0.1:9001` / LAN / tailnet) in **separate contexts**. *Assert:* the two
origins differ (not two tabs of one context), and B reflects a controller content edit
**≤ 1000 ms** (measure & print the latency).

**2. PASTE-IN → SEGMENTS.** On first load *assert:* the paste box (`[data-testid="script-input"]`)
holds the §10.5 sample (never `This is a text from Daniel!` or empty), the segments panel shows
**exactly 5** `[data-testid="segment"]` items under **3** `[data-testid="segment-section"]`
headings, and a `[data-testid="copy-format-prompt"]` button exists. Then paste a fresh small
script (e.g. `# A\nuno\n\ndois\n\n# B\ntres`) into the box; *assert* the panel re-parses to **3
segments / 2 sections**.

**2b. COPY FORMATTING PROMPT — MUST WORK OVER NON-SECURE http-IP (the CEO's path).** This is a
mandatory check and it MUST run over the **real served origin the operator uses — an
`http://<LAN/tailnet-IP>:9001` URL, a NON-secure context — NOT `localhost`/`127.0.0.1`** (those
are secure contexts where `navigator.clipboard` works and the bug hides → a localhost-only check
is a **false green** and is INADEQUATE). Grant the context clipboard permissions
(`clipboard-read`,`clipboard-write`). *Assert all:*
  - Open the controller at the **http-IP origin**; confirm it is non-secure (`window.isSecureContext === false`). Click `[data-testid="copy-format-prompt"]`.
  - **The prompt text actually lands on the clipboard:** read the OS clipboard back from a
    **separate secure page** (`http://localhost:9001`, where `navigator.clipboard.readText()`
    works) — the OS clipboard is shared across pages in the one browser — and *assert* it equals
    the §10.6 `FORMAT_PROMPT` **exactly**.
  - **Success is real:** the button shows `data-copy-state="ok"` and **"Copied ✓"** only because
    the copy truly succeeded.
  - **No fake success on failure:** force the fallback to fail (e.g. `page.evaluate(() => { document.execCommand = () => false })` before clicking, on the http-IP page), click again, and
    *assert* `data-copy-state="fail"` with a **visible error** and **NOT** "Copied ✓", and the
    clipboard is unchanged. (A handler that flashes "Copied ✓" here is the exact CEO bug — FAIL.)

**3. SEGMENT REAL-TIME.** Click a segment (`[data-testid="segment"]`, e.g. index 2) on the
controller. *Assert:* B's text becomes that segment's text **≤ 1000 ms** and **resets to the top**
(`position == 0` / first word active); a second segment-click (or `ArrowRight` next-segment)
updates B again. (Backstop: wrong `X-API-Key` → 401, unset key → 503, empty → 422.)

**4. PRESENT + READ LEGIBLY — the ORIGINAL word-display.** Enter presentation in one click, press
Play, and sample the display state across ~2 s of playback. **Drive order (do NOT thrash on it):**
the Play/Countdown controls exist **only inside the presentation view** — click **Start
Presenting first**, then Play; clicking countdown/play while still in the editor is a harness
ordering error, not a product bug. And **account for the §8.6 countdown pre-roll**: a Play (or
resume) runs a `countdownSeconds` ring (default options `1s/3s/5s`) **before** the scroll starts,
so word-advance does not begin until the countdown elapses. For this sample, **select the `1s`
countdown (or wait `countdownSeconds + ~1.5 s` after Play) before asserting `data-word-index`
increase** — otherwise you are sampling during the pre-roll and the index legitimately has not
moved yet (a flaky FALSE failure, not a defect). *Assert all:*
  - **Single highlighted current word:** at any instant **exactly one** `.word-active` exists
    (count === 1), and it **advances word-by-word** during playback (its `data-word-index`
    increases over the window).
  - **Original glowing box:** the `.word-active` computed `color` is **`rgb(0, 212, 255)`**, its
    `box-shadow` is **non-`none`** (the cyan glow), and its `background-image` is a **gradient**
    (not `none`). (A plain/calm/faded active word is a FAIL — the original box is required.)
  - **Centered:** the active word's bounding box vertical center is within ~15% of the scroll
    container's vertical center (kept centered by per-word `scrollIntoView`).
  - **READABLE CONTRAST (no dark-on-dark):** every non-active `.teleprompter-word` has computed
    `color` **`rgb(255, 255, 255)`** (pure white) and `opacity` **1** on the `rgb(0,0,0)` surface
    — bright, high-contrast, readable at camera distance. A dimmed/faded/gray reading surface
    (any `opacity < 1` or non-white reading text) is a **FAIL** (the card-b19a04ef6101
    dark-on-dark bug).
  - **Large enough:** reading font computed `font-size ≥ 40px` at a 1080-min viewport.

**5. MID-TAKE CONTROL (no word-bar).** While playing, press `Space` to pause. *Assert:* the
active word index is **preserved (non-zero) — pause must NOT reset to 0** (that bug loses the
take), and resume (`Space`) runs the §8.6 countdown then continues from the same word (index
advances afterward). Then go to the **previous segment** (`ArrowLeft` or click another
`[data-testid="segment"]`): *assert* the display swaps to that segment's text, **resets to the
top** (`position == 0`), and B follows **≤ 1000 ms**. *Assert there is **NO** word-scrub range
input* in the presentation controls (the draggable word-bar is removed — its presence is a FAIL).

**6. NO DEAD CONTROLS / NO SCAFFOLD / NO CUT FEATURES.** *Assert:* (a) **every control acts** —
Reset → index 0; Mirror → `scaleX(-1)`; Speed slider extremes read `0.25× / 4.00×`; Text-size
slider moves the display font; Countdown offers `1s / 3s / 5s` — **no dead buttons**; (b) **no
scaffold tells** on the display — no `.stars`/starfield, no status pill / readouts / `vmin`
jargon, no placeholder/bilingual button text; no `@tsparticles`/`framer-motion` in the bundle;
**(c) cut features are absent — NO word-scrub range input anywhere, and NO script-library UI**
(no save/open/rename/delete control, §8.2). (The cyan glowing-box active word is the **correct
original look** — NOT a scaffold tell.)

**7. SURVIVES A REAL SESSION.** Run a sustained session through both clients — paste a script,
**click through several segments** (verify the display matches the controller each time), present,
play, change speed and font, toggle mirror. *Assert:* **zero console/page errors**, no crash, the
active index stays finite (no NaN/stuck), the display stays in sync, and the controller stays
responsive (Exit returns to the editor).

> **Evidence (the CEO verifies by eye):** screenshots of **BOTH** independent clients
> (A controller + B display) showing the **same synced state** after a controller action AND
> after a script-part click, **plus a playback frame showing the ORIGINAL highlighted current
> word — the cyan→violet glowing box on one word, centered** — which is the proof the word-display
> matches the CEO original.


---

## 17. Failure modes (known)

**Display/controller shows "Offline" (red/indigo).** Detect: `curl -sf :9000/` fails, or the
page was opened on a hostname that can't reach `:9000` (WS URL is
`ws://<page-hostname>:9000/ws`). Fix: start the backend; open the page via the same host/IP
that serves both ports; check `/tmp/teleprompter-backend.log`. (Note: only the **controller**
ever surfaces this; the display has no status chrome by design — §8.5.)

**`POST /api/content` → 503 "Content API not configured".** Detect: no `CONTENT_API_KEY` in
`backend/.env`, or the backend was started from a different cwd than `backend/` (pydantic-
settings reads `.env` relative to cwd). Fix: Step 2; start uvicorn **from** `backend/`.

**`POST /api/content` → 401.** Detect: sender key ≠ backend key (stale `CONTENT_API_KEY` env
shadowing `backend/.env`). Fix: `unset CONTENT_API_KEY` so the sender reads `backend/.env`, or
align them.

**Built a calibration gate / "Speed Training" panel / mic capture.** Detect: Start Presenting
is disabled on load, or a Record/Calibrate/Skip-Calibration control exists, or the page requests
microphone permission. Fix: **cut it** — there is no calibration in this product (§9); Start
Presenting is always enabled and the pacing engine is the §5 fixed profile.

**Active word lost its original glowing box (replaced by a calm/faded/crawl variant).** Detect:
`.word-active` has no `box-shadow`/gradient `background`, or other words are dimmed/faded, or the
scroll is a continuous crawl with no single highlighted word. Fix: §7.4/§11.2 — restore the
CEO-original: **exactly one** `.word-active` cyan→violet **glowing box** (background gradient +
`box-shadow: 0 0 18px rgba(0,212,255,0.35)` + `color: #00d4ff`), advancing **word-by-word**,
centered via per-word `scrollIntoView`; all other words plain white (no dim/fade), no crawl.

**Starfield / particle layer behind the text.** Detect: a `.stars` element on the reading
surface, or `@tsparticles`/`framer-motion` in `package.json`. Fix: remove them — the reading
surface is solid `#000000` with nothing behind the words (§11.3).

**Display shows status/units chrome.** Detect: an Online/Offline pill or a "vmin"/speed readout
on `?mode=display`. Fix: §8.5 — the display is script-only; status & readouts live on the
controller.

**Inline edit jumps the take to the top.** Detect: editing content mid-take resets the active
word to 0. Fix: a `state:update {content}` must not touch `position` (§4.3); clients keep &
clamp the current index on a content change, resetting only when `position` itself arrives as 0
(§6, §7.4).

**Display connects but never shows text / never scrolls.** Detect: words render but no
`word-active`, or content empty. Fix: ensure `state:sync` is sent on WS connect; ensure the
tokenizer assigns `data-word-index`; ensure the scroller keys off `isPlaying`.

**Port already in use on 9000/9001.** Detect: `lsof -i :9000 -i :9001 | grep LISTEN`. Fix: free
each port by its **listening PID** — `lsof -ti tcp:9000 | xargs -r kill; lsof -ti tcp:9001 | xargs -r kill`
(or the `stop_port` helper from Step 5). **Do NOT `pkill -f 'uvicorn …'` / `pkill -f vite`** — that
pattern matches the orchestrating shell's own command line and kills the script running the
Steps/Verify (the exit-144 self-kill; see Step 5).

**Copy button flashes the WRONG state on a rapid 2nd click (§16b.2b forced-failure shows `idle`).** Detect: a forced-failure copy right after a success shows `data-copy-state="idle"` (or stale `ok`) instead of `fail`. Cause: the success path schedules a `setTimeout` that resets `copyState` to `idle`, and a later click's `fail` gets clobbered by that pending timer. Fix: **clear any pending copy-state timer before setting a new copy-state** (one timer ref, cleared on each click). (Surfaced fresh, card add834d5fd3c.)

**Probe-3 spurious WS reconnect under StrictMode (an app socket created after unmount).** Detect: `verify/probe.mjs` PROBE 3 shows a `:9000/ws` socket created late / `lateReconnects>0`. Cause: calling `ws.close(1000)` on a socket still in `CONNECTING` (the StrictMode first mount) and/or relying on a shared close flag lets the cleanup schedule a reconnect. Fix: a **dedicated per-instance `unmounted` flag** set in cleanup that suppresses ALL reconnects after unmount (distinct from the normal close flag), and guard `close()` on `readyState`. (Surfaced fresh, card add834d5fd3c.)

**`vite: command not found` / esbuild platform errors after copying a build between machines.**
Fix: `rm -rf node_modules && npm install` (never copy `node_modules` across hosts).

**§16b.7 fails on "zero console errors" from a React style-shorthand warning.** Detect: Layer-2
point 7 fails with a console error like *"Updating a style property during rerender … when a
conflicting property is set … `border` / `borderColor`"*. Cause: an inline `style={{…}}` mixes a
**shorthand** (`border`) with a **non-shorthand override** (`borderColor`) on the same element —
React logs a `console.error`, which trips §16b.7's zero-errors bar. (Component inline styling is
the builder's to choose — this is not a SEED-pinned value — but the pitfall is common.) Fix: do
not mix shorthand + longhand on one inline style; use the full `border` shorthand for the
override (e.g. `border: '1px solid rgba(0,212,255,0.6)'`), or set only longhands.

---

## 18. Convergence notes (read before building)

- **Build a product, not a scaffold — but the word-display is the CEO ORIGINAL.** De-scaffold
  rules pinned by absolute value: solid-black surface (no starfield, §11.3), readable font
  (weight 500, normal tracking, §11.5), script-only display (no status/units, §8.5). The
  **word-display model is the CEO original** (§7.4/§11.2): a **single highlighted current word**
  (cyan→violet **glowing box**) advancing **word-by-word**, centered via per-word
  `scrollIntoView` — **NOT** a continuous crawl, **NOT** a fade, **NOT** a "calm no-box" variant
  (those were invented and are discarded). Plus: **no calibration gate** (§9) and **manual drift
  recovery** (§8.4).
- **The two contracts that bite first** are the **frontend WS-URL derivation** (must be
  hostname-derived, no env — the #1 fresh-install failure) and the **content-API key seam**
  (sender key must match `backend/.env`; 503 when unset, 401 on mismatch).
- **Outbound state is camelCase.** Verify reads `content`/`position`/`isPlaying` off the
  `state:sync` frame — serialize with camelCase keys.
- **`POST /api/content` resets position; `state:update {content}` does NOT.** The take-swap
  starts a new take at the top; an inline edit keeps the operator's place. Load-bearing for J18.
- **`POST /api/content` leaves `isPresenting` alone** — a take swap must not eject the operator
  from the presentation view. Load-bearing for J5.
- **No calibration, ever.** Start Presenting is always enabled; the §5 fixed profile is the
  whole pacing engine. Do not add a mic/STT/Skip-Calibration path.
- **Segment navigation, not word-scrub.** Pause keeps your place; navigate between takes by
  **segment** (next/prev keys, or click a segment in the panel) → resume. A segment-set emits
  `state:update {content, isPlaying:false, position:0}` and moves the displays to that segment's
  top (§4.3 seam). **No draggable word-scrub bar** (removed, §8.3/§8.4).

## 19. Cleanup
```sh
# Stop services by LISTENING PORT, never by command-string (pkill -f matches this very shell).
lsof -ti tcp:9000 | xargs -r kill 2>/dev/null; lsof -ti tcp:9001 | xargs -r kill 2>/dev/null
rm -rf "$TP_WORKSPACE"
```
