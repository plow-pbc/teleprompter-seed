# SEED: teleprompter

> A self-contained **product-spec "seed"** for **TPFlow Teleprompter** — a local,
> no-auth, multi-device teleprompter for recording videos: a controller page on the
> computer drives a read-only display page (a phone at the camera, or any second browser
> page), and a **roteiro (script bank)** loaded in a terminal sender live-swaps the
> displayed text **one ENTER per take**.
> **To build:** hand this file to a coding agent — it builds the backend + frontend +
> roteiro sender from this spec alone and self-runs the §16 acceptance journeys.
> **Self-contained & self-verifying.** A blind, zero-context agent — with **no access to
> any reference implementation** (no original codebase, no golden screenshots, no second
> app) — must rebuild the product from this spec and pass the seed's own `## Verify`. This
> file contains **NO application source on purpose**: the data model (§5), the wire
> contract (§4), the rendering math (§7), the UI constants and design tokens (§8, §11), and
> the roteiro format (§10) are **fixed and load-bearing** — asserted by **absolute value**,
> never by diffing a reference app. Everything else (file layout, component split, idiomatic
> React/FastAPI wiring) is yours to choose.

> seed-format: 1

> **You're an AI agent reading this seed.** Your job: build the **TPFlow Teleprompter** —
> backend (FastAPI + WebSocket on **:9000**), frontend (Vite + React on **:9001**), and the
> roteiro sender — from this specification alone, until every §16 acceptance journey passes.
> Run `## Steps` Step 0 (single Interview turn), then execute every Step in order, then
> perform `## Verify`. When all Verify evidence is in hand print `SEED_RESULT=DONE`; on a
> blocker print `BLOCKED_REASON=<short reason>` and stop. Do not ask the human anything
> outside the single Interview turn.
>
> **Definition of done.** A fresh machine ends with a running teleprompter: the controller
> at `http://<host>:9001/` and the display at `http://<host>:9001/?mode=display` both show a
> green **Online** indicator with **zero frontend env config**; the controller can enter the
> presentation view and play/scroll a script; and the roteiro sender pushes a script bank to
> the display so that **each ENTER live-swaps the displayed text on every connected client,
> no refresh** — the CEO's proven recording workflow. All of this observable and green in
> §16; the seed is proven only when a blind rebuild from this spec passes.

---

## 1. Purpose & context

**TPFlow Teleprompter** is the CEO's recording rig, packaged. The CEO records short-form ad
videos: a phone sits on the camera showing the teleprompter **display**; the laptop runs the
**controller**; and a **roteiro** (Portuguese for "script"/shooting-script) — a bank of ad
pieces (hooks, bodies, CTAs) — is loaded so the operator presses **ENTER** once per take and
the displayed text swaps instantly on the phone. No login, no cloud, no refresh between
takes.

The product has exactly three moving parts:

1. **Backend** — a tiny FastAPI app holding **one shared teleprompter state** in memory and
   broadcasting it over a WebSocket. It is a local recording tool: **no authentication**, all
   connected clients (controller + every display) share the **same** state.
2. **Frontend** — a Vite/React single-page app that renders in one of two modes off a URL
   query param: **controller** (edits the script, runs the presentation) or **display**
   (read-only, auto-syncs, lives on the phone). The WebSocket URL is **derived from the
   page's own hostname** — there is no frontend env file, so the phone reaches the backend at
   the same IP it loaded the page from.
3. **Roteiro sender** — a stdlib-only Python script that parses the roteiro markdown bank and
   `POST`s one piece at a time to the backend's content API; each post broadcasts the new
   text to every display **live**. This is the **script-selection-modifies-content-in-real-
   time** feature: selecting/advancing a script piece from the roteiro changes what every
   teleprompter shows, instantly.

Character traits the rebuild must preserve:
- **One shared state, broadcast to all.** Any mutation (controller edit, play/pause, or a
  roteiro `POST`) reflects on **every** connected client with no refresh.
- **Zero-config display.** The display page derives its backend URL from its own hostname —
  open it on a phone via the LAN IP and it just connects.
- **ENTER-per-take roteiro flow.** The recording loop is: phone on camera → run the sender →
  ENTER advances takes → each ENTER live-swaps the display text and resets scroll position.
- **Recording-grade dark display.** Black background, large centered text, a subtle
  twinkling starfield, a word-by-word auto-scroll paced by a speech profile.

It is **local-only**: no Supabase/JWT auth, no payments, no marketing pages, no Docker, no
external services on the done path (see §9 for the one external integration, which is
**optional and cut from done**).

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
  engine, no animation library** (see §11 — the decorative particle layer is deliberately
  dropped; a build that pulls in `@tsparticles`/`framer-motion` is wrong).
- **Roteiro sender**: a **stdlib-only** Python 3 script (`urllib`, `re`, `json`, `pathlib`).
  No third-party deps — it must run under the same `uv` env or a bare `python3`.
- **Ports are fixed contracts.** Backend **9000**, frontend **9001**. The frontend derives
  its WS URL as `ws(s)://<page-hostname>:9000/ws` — **9000 is hardcoded in the client**;
  do not make it configurable, do not read it from env.
- **No frontend env at all.** There is no `.env`/`.env.local` for the frontend. Any "WS URL
  env var" is a bug (it was the #1 historical fresh-install failure). Derive from hostname.
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
            │  - POST /api/content  (X-API-Key)  ← sender   │
            │  - WS  /ws          state:sync to ALL clients │
            └───────▲───────────────────────▲───────────────┘
        WS state:update│        WS (read-only)│  state:sync (broadcast)
                       │                      │
        ┌──────────────┴───────┐   ┌──────────┴───────────────┐
        │ Controller :9001/    │   │ Display :9001/?mode=display│
        │ edit script, present │   │ phone at camera, read-only │
        └──────────────────────┘   └────────────────────────────┘
                       ▲
        POST /api/content (one piece per ENTER)
                       │
        ┌──────────────┴──────────────┐
        │ Roteiro sender (terminal)    │   ← the script-selection / live-swap flow
        │ parses the script bank .md   │
        └──────────────────────────────┘
```

**Two front doors into one store:**
1. **WebSocket door** (`/ws`, no auth) — the controller pushes partial `state:update`s; the
   server merges into the single shared state and **broadcasts the full `state:sync`** to
   every connected client (controller + displays).
2. **Content-API door** (`POST /api/content`, `X-API-Key`) — the roteiro sender pushes a new
   script piece; the server sets it as the content, **resets scroll position to 0**, pauses
   playback, and **broadcasts `state:sync`**. This is how "selecting a script from the
   roteiro modifies the teleprompter content in real time."

Both doors mutate the **same** `TeleprompterState`; a piece pushed by the sender renders on
every display through the same path as a controller edit.

The shared-state scope is a single fixed user id **`"local-shared"`** — there is no
per-user/session partitioning. Every WS connection and every content POST targets that one
state.

---

## 4. Backend contract (port 9000) — FIXED

All endpoints on a single FastAPI app. **CORS**: `allow_origins=["*"]`, allow credentials,
all methods, all headers (LAN access from a phone).

### 4.1 Health
`GET /` → **200** `{"status": "ok", "message": "Teleprompter Sync API"}`.

### 4.2 Content API (the roteiro live-swap door)
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
   beginning); **`state.is_playing = false`** (pause). **`state.is_presenting` is left
   UNCHANGED** — a piece sent while presenting must NOT kick the operator out of the
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
- `content`, `isPlaying`, `isPresenting` → set directly.
- `position` → set **only if** present **and** the state is **not currently playing**
  (during playback the client owns position locally; ignore stale position pushes).
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
| `content` | string | `""` | the script text shown |
| `isPlaying` | bool | `false` | auto-scroll running |
| `isPresenting` | bool | `false` | controller in presentation view |
| `playbackRate` | number | `1.0` | speed multiplier, **clamped [0.25, 4]** |
| `wpm` | number | `124` (derived §4.5; store the int) | compat only; recompute on rate/profile change |
| `position` | number | `0.0` | **word index** (not pixels) |
| `fontSizeVh` | number | `4.5` | font size as **% of viewport min (vmin)**; UI range [2, 15] |
| `backgroundColor` | string | `"#000000"` | hex |
| `textColor` | string | `"#ffffff"` | hex |
| `countdownSeconds` | int | `3` | pre-roll countdown; UI options {1,3,5} |
| `speechProfile` | object \| null | default profile (below) | pacing profile, §9 |

**`speechProfile` shape** (camelCase wire): `{ perLengthDurations: {"1": <s>, …, "30": <s>},
punctuationPauses: {comma: <s>, sentence: <s>}, source: "stt"|"fallback"|null, updatedAt:
<str>|null, transcription?: <str> }`.

**Default / fallback speech profile (FIXED VALUES):**
- `perLengthDurations[str(n)] = round(0.25 + 0.15 * ln(n), 3)` for **n = 1..30**.
  (e.g. n=1→0.25, n=3→0.415, n=5→0.491, n=10→0.595, n=30→0.760.)
- `punctuationPauses = { "comma": 0.2, "sentence": 0.4 }`.
- `source = "fallback"`, `updatedAt = "static"`.

The frontend mirrors this exact fallback profile client-side (same formula, same constants)
so the display paces identically whether or not the server pushed a profile.

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
- **Connection indicator (both modes):** a status pill with a dot + label. **Connected → dot
  `#00ff88` with a glow (`box-shadow: 0 0 20px #00ff88`) + label "Online"**; disconnected →
  indigo dot + label "Offline". (Verify asserts the `#00ff88`/"Online" state.)
- **localStorage keys** (exact + semantics): `teleprompter-content` (last edited script),
  `teleprompter-playback-rate` (number), `teleprompter-speech-profile` (the §9 profile) — these
  three **persist and seed the initial local state on load, before the first `state:sync`
  arrives**; `display-mirror` (boolean) is the **display's own vertical-mirror toggle**, local
  to that device and **not synced** over WS. (None of these gate Verify; persistence is a
  convenience.)
- **Dark class:** the app adds `dark` to `<html>` on mount.
- **On `state:sync` received:** set content; in **display** mode adopt `isPresenting` from the
  state (so the phone follows the controller into/out of presentation); clamp and store
  `playbackRate`; update font size / colors / countdown; reconcile play state and scroll
  position (during playback keep local position; when paused adopt the synced position).
- **Controller emits** partial `state:update`s on: content edit, playbackRate change, font
  size change, countdown change, and on entering/exiting presentation. The display emits
  nothing (read-only).

---

## 7. The teleprompter display (rendering math + auto-scroll) — FIXED

### 7.1 Word tokenization
`parseTextIntoWords(text)`: split on `/(\s+)/` keeping the whitespace tokens. Whitespace
tokens render literally but get **no word index** (`index = -1`, `isWhitespace = true`).
Non-whitespace tokens get a **sequential 0-based `index`** and render as
`<span data-word-index={index} class="teleprompter-word">`. Empty input → render the
placeholder text `Paste or type your script here...`. Punctuation stays attached to its word
(do not split on apostrophes/hyphens).

### 7.2 Font size (the device-consistent formula — pin it)
```
deviceMultiplier = devicePixelRatio > 2.5 ? 3.0 : devicePixelRatio > 1.5 ? 2.0 : 1.0
viewportMin      = min(window.innerWidth, window.innerHeight)
fontSizePx       = (settings.fontSizeVh / 100) * viewportMin * deviceMultiplier
```
The scroll container uses `font-size: fontSizePx`, **`line-height: 1.8`**,
`font-family: sans-serif`, `color: textColor`, **background transparent** (so the starfield
shows through), **top & bottom padding each = `window.innerHeight / 2` px** (so the first and
last lines can center), and **horizontal padding 24px** (48px at ≥640px viewport width). Text
block: centered (`text-align: center`), `white-space: pre-wrap`, light weight, letter tracking
wide, `text-shadow: 0 4px 20px rgba(0,0,0,0.55)`, max-width ~64rem centered.

### 7.3 Per-word duration (pacing) — FIXED
For each non-whitespace word, with the active `speechProfile` and `playbackRate`:
- `len` = count of `[0-9A-Za-zÀ-ſ]` chars in the word (fallback to raw length);
  clamp to [1,30]. `base = perLengthDurations[str(len)] ?? perLengthDurations["30"]`.
- Trailing-punctuation class of the word: last char in `,;-` → **comma**; last char in
  `.?!:` → **sentence**; else none. `pause = punctuationPauses[class] ?? 0`. If the word ends
  with `"..."` and class is sentence, `pause *= 1.5`.
- `duration = clamp((base + pause) / (rate > 0 ? rate : 1), 0.05, 8)` seconds.

### 7.4 Auto-scroll loop
A `requestAnimationFrame` loop advances a current-word index by elapsed real time against the
per-word durations. On each advance: add `word-active` to the current word's span (remove it
from the previous), and `scrollIntoView({ behavior: 'smooth', block: 'center' })`. When
playing stops, freeze on the current word (no smooth). The controller throttles outgoing
`position` `state:update`s to **one per 100 ms**. When the index passes the last word,
playback stops.

---

## 8. The controller UI + presentation view — FIXED constants

The controller has two screens: the **Editor** (default, not presenting) and the
**Presentation view** (after Start Presenting). The display page always renders the
presentation view, read-only.

### 8.1 Editor screen
- A large **textarea** (the script editor), `spellcheck=false`, placeholder `Paste or type
  your script here...`; edits push `state:update {content}` live.
- A **"Display Mode"** button → switches this page to `?mode=display`.
- The **Speed Training / calibration** panel (§9) with its **"Skip Calibration / Use Default
  Profile"** action. **Presenting is gated**: the **Start Presenting** button is disabled
  until the pacing profile is acknowledged (calibrate **or** skip). On a fresh load the
  supported path is **Skip Calibration → Start Presenting** (disabled-button label before
  acknowledging: `⚠️ Calibrate or Skip`; after: `Start Presenting`).

### 8.2 Presentation view (controller, and the phone display)
- Black screen, the §11 starfield, the centered scrolling text (§7), a top status bar with
  the **Online/Offline** pill.
- **Controller-only controls bar** (the display does NOT show controls). Contains:
  - **Play / Pause** button — label `▶ Play` / `⏸ Pause` / `⏳ Waiting` (waiting = countdown
    or pending scheduled start). Starting playback runs a **countdown** first.
  - **Reset** button (`↻ Reset`) → position 0, paused.
  - **SPEED slider** — **log scale**: slider value `v ∈ [-1, 1]`, `rate = 4^v`, so center =
    1×, ends = 0.25× and 4×. Display the rate as `<rate>x` (2 decimals). Tick labels:
    `0.25x · 1x · 4x`. The rate is **clamped to [0.25, 4]** everywhere (a single
    `clampPlaybackRate` used on every entry point). Keyboard ↑/↓ nudge the **rate** linearly
    by **±0.1** then re-clamp (additive on the rate, not on the log slider value).
  - **FONT SIZE slider** — piecewise-linear around the default: **MIN 2, DEFAULT 4.5, MAX 15**
    (vmin %). Normalized `n ∈ [-1,1]` maps DEFAULT at 0, with the **exact** two-segment map:
    `n ≥ 0 → size = DEFAULT + n*(MAX-DEFAULT)`; `n < 0 → size = DEFAULT + n*(DEFAULT-MIN)`
    (so `n=1→15`, `n=0→4.5`, `n=-1→2`). Snap the result to **0.1**. Tick labels
    `2.0v · 4.5v · 15.0v`. Readout `<size>vmin`.
  - **Countdown** segmented control — options **{1, 3, 5}** seconds, default **3**.
- **Auto-hide:** while playing / counting down / pending start, the controls slide away and a
  small grab-handle remains; hovering brings them back.
- **Exit** (presentation) returns to the editor (controller) / unsets presenting.
- **Entering presentation** (`Start Presenting`): set `isPresenting=true`, `position=0`,
  `isPlaying=false`, force `backgroundColor="#000000"`, `textColor="#ffffff"`, and emit a
  `state:update` with exactly those fields (so the phone display follows into presentation).

### 8.3 Countdown
Starting playback with `countdownSeconds > 0` shows a **circular countdown** (a ring that
depletes) centered over the text, counting whole seconds down to 1, then begins the scroll.
With `countdownSeconds = 0`, start immediately. The countdown duration drives both the local
pre-roll and the `desiredStartMs` sent on `play:start` (§4.4).

### 8.4 Keyboard (presentation + controller only)
`Space` = toggle play/pause; `ArrowUp` = speed +0.1; `ArrowDown` = speed −0.1; `Home` =
reset. Ignore keys while focus is in an input/textarea.

---

## 9. Pacing profile + calibration — LOCAL FALLBACK IS CANONICAL

The teleprompter paces its auto-scroll from a **speech profile** (§5, §7.3). There are two
ways to obtain one; **the local fallback is the canonical, supported, done-gating path.**

### 9.1 Local fallback profile (CANONICAL — required for done)
The **default/fallback profile** (§5 exact values) is built **entirely client-side from a
fixed formula** — no network, no microphone, no external service. The Editor's calibration
panel offers **"Skip Calibration" / "Use Default Profile"** as a first-class button; clicking
it applies the fallback profile, marks the profile acknowledged, and **enables Start
Presenting**. This is the path Verify exercises and the path a fresh operator uses. The
fallback profile alone produces a fully working, well-paced teleprompter. **Acknowledgement is
per-session controller UI state** (re-required after a reload) and gates only the controller's
Start Presenting button — the **display** (`?mode=display`) is read-only and never gated by it.

### 9.2 Optional STT calibration (CUT FROM DONE — stub contract only)
The original product could record ~15 s of the operator's voice and POST it to an external
**speech-to-text** service to derive a *personalized* profile. **This is OUT of the done
definition and Verify never exercises it.** Rebuild it only as an **optional, non-blocking
enhancement** behind a configuration switch, with this **stub contract** so a future
integrator can wire any STT backend:

- **Trigger:** a "Record / Calibrate" action in the panel captures audio (MediaRecorder,
  `audio/webm;codecs=opus`) for ~15 s.
- **Request (only if an STT endpoint is configured — e.g. a `VITE_STT_URL`, unset by
  default):** `POST <stt-url>` JSON `{ audio_base64, sample_rate: 48000, include_segments:
  true }`.
- **Response (expected):** `{ transcription: str, audio_duration_seconds: number,
  word_count: number, timing_profile: { per_length_durations?: {len: s}, punctuation_pauses?:
  {class: s} } | null }`.
- **On success:** normalize `timing_profile` (clamp each duration to [0.05, 8], fill missing
  lengths from the fallback), set `source: "stt"`, push it as a `state:update {speechProfile,
  wpm}`.
- **On no endpoint / any failure / timeout:** **silently fall back** to §9.1, mark
  acknowledged, surface a small non-blocking notice ("Using the default pacing profile"), and
  **never block presenting.**

A build that has **no STT endpoint configured** (the default) must still reach done purely
via §9.1. Do **not** hardcode any specific external STT host; the absence of one is the
normal, supported state.

---

## 10. The roteiro / script-selection real-time swap — FIXED

This is the CEO's recording workflow and the headline feature: **selecting a script piece
from the roteiro bank modifies the teleprompter content in real time.** Two cooperating
pieces: the **roteiro markdown format** + the **sender tool**.

### 10.1 Roteiro markdown format ("banco de gravação")
A roteiro file is a bank of ad pieces grouped by type. Grammar:
- Ad header: `# ANUNCIO <n> — "<NAME>" (...)` — opens ad number `<n>`, name `<NAME>`.
- Section header: `## HOOKS — ...` / `## BODIES — ...` / `## CTAs — ...` — sets the current
  piece **type**.
- Piece header: `### <n>.<id>` optionally followed by ` — <subtitle>` (e.g. `### 1.H1`,
  `### 1.B1 — Sample Body`). The `<id>` is always **`<letters><digits>`** (e.g. `H1`, `B1`,
  `CTA10`); the **trailing digits** are the in-type sort number (§10.2).
- Piece text: the lines **starting with `>`** after a piece header (a blockquote). Strip the
  `>` prefix; a bare `>` line is a **paragraph break** (preserved). A `---` line is ignored.
  The piece text ends at the next `#`/`##`/`###` header.

### 10.2 Recording order
Pieces are ordered for recording as: **all HOOKS, then all BODIES, then all CTAs**; within a
type, by ad number, then by the trailing number in the piece id (`1.H3` → 3). Use a **stable
sort** so any remaining ties keep source-file order. So a bank with 2 hooks + 1 body + 2 CTAs
sends in the order H1, H2, B1, CTA1, CTA2.

### 10.3 Sender tool (`send_roteiros.py`) — stdlib only
- **Usage:** `python3 scripts/send_roteiros.py [path/to/roteiro.md]` — defaults to the
  bundled `sample-roteiro.md` next to the project root.
- **Key resolution:** `CONTENT_API_KEY` env var first; else read it from `backend/.env`
  (`CONTENT_API_KEY=` line, strip quotes). If neither → print a clear error and exit non-zero.
- **Endpoint:** `TELEPROMPTER_API_URL` env var, default `http://localhost:9000/api/content`.
- **Flow:** parse → order (§10.2) → print a summary line **`Total de peças: <N>`** plus per-
  type counts → **send piece 1 immediately** (`POST /api/content` with the piece text and the
  `X-API-Key`) printing **`✅ Enviado ao teleprompter`** on a 2xx (or an error line otherwise)
  → then a prompt loop: **ENTER advances** to the next piece (sends it), **`q`** quits, a
  **number** jumps to that 1-based piece. Each send is a live swap on every display.
- Stdlib only (`urllib.request`, `re`, `json`, `pathlib`, `os`, `sys`) — no third-party deps.

### 10.4 Bundled sample roteiro (`sample-roteiro.md`) — recreate verbatim
This doubles as the parser fixture (must parse to **exactly 5 pieces**: 2 hooks, 1 body, 2
CTAs) and the demo bank. Write this file verbatim:

```markdown
# Banco de Gravacao — Sample

> **Total de pecas:** 5 (1 anuncio: 2 hooks + 1 body + 2 CTAs)
> **Como gravar:** Grave todos os hooks seguidos, depois o body, depois os CTAs.
> Na edicao, combine qualquer Hook + Body + CTA.

---
---

# ANUNCIO 1 — "TELEPROMPTER TEST" (Angulo: Sample recording bank)

---

## HOOKS — Anuncio 1 (2 variacoes)

### 1.H1
> "This is hook one. If you can read this on the display, the teleprompter is live."

### 1.H2
> "This is hook two. Press ENTER in the terminal and this text should change instantly."

---

## BODIES — Anuncio 1 (1 variacao)

### 1.B1 — Sample Body
> This is the body of the sample script. The teleprompter shows whatever piece was last sent.
>
> Each paragraph break is preserved. The display scrolls this text while you record, and the controller can adjust speed, font size and countdown.

---

## CTAs — Anuncio 1 (2 variacoes)

### 1.CTA1
> "This is call-to-action one. One more ENTER and you have recorded every piece."

### 1.CTA2
> "This is call-to-action two. That is the whole sample recording bank."
```

---

## 11. Design system (reproducible spec — absolute values)

The look is **recording-rig dark + a soft electric-blue/violet accent**. Pin every value;
the visual journeys (§16) assert these by computed style, never by diffing a reference app.

### 11.1 Palette (exact)
- Display/presentation background: **`#000000`** (pure black). Display text default
  **`#ffffff`**.
- Accent gradient endpoints: cyan **`#00d4ff`** → violet **`#7b2ff7`** (used on the play
  button, sliders' thumb/track, countdown ring, active word).
- Connection-online green: **`#00ff88`** (dot + glow).
- The Tailwind theme `--primary` token is amber `#f59e0b` in CSS vars, but the teleprompter
  surfaces use the cyan→violet accent above directly; match the accent on the play
  button/sliders/word-active.

### 11.2 Active word highlight (`.word-active`) — exact
```css
.teleprompter-word { transition: all 0.2s ease; padding: 0 4px; border-radius: 0.5rem; }
.word-active {
  background: linear-gradient(135deg, rgba(0,212,255,0.25), rgba(123,47,247,0.25));
  box-shadow: 0 0 18px rgba(0,212,255,0.35);
  color: #00d4ff;
}
```

### 11.3 Starfield background (`.stars`) — the ONLY decorative layer (exact)
A single CSS twinkling starfield behind the presentation text. **No particle engine, no
shooting stars, no framer-motion** — those decorative components from the original are
**deliberately dropped** (they pulled in `@tsparticles` + `framer-motion`, were impossible to
spec faithfully, and are not load-bearing). Recreate exactly this:
```css
.stars {
  background-image:
    radial-gradient(2px 2px at 20px 30px, #eee, rgba(0,0,0,0)),
    radial-gradient(2px 2px at 40px 70px, #fff, rgba(0,0,0,0)),
    radial-gradient(2px 2px at 50px 160px, #ddd, rgba(0,0,0,0)),
    radial-gradient(2px 2px at 90px 40px, #fff, rgba(0,0,0,0)),
    radial-gradient(2px 2px at 130px 80px, #fff, rgba(0,0,0,0)),
    radial-gradient(2px 2px at 160px 120px, #ddd, rgba(0,0,0,0));
  background-repeat: repeat;
  background-size: 200px 200px;
  animation: twinkle 5s ease-in-out infinite;
  opacity: 0.5;
}
@keyframes twinkle { 0%{opacity:.5} 50%{opacity:.8} 100%{opacity:.5} }
@keyframes pulse-glow { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.3);opacity:.7} }
```
The online indicator dot uses `animation: pulse-glow 2s infinite`.

### 11.4 Sliders (exact)
Range inputs are restyled: track `height 8px`, `border-radius 9999px`, a faint
cyan→violet track tint; thumb `18×18px` round, `linear-gradient(135deg,#00d4ff,#7b2ff7)`,
`box-shadow 0 0 0 4px rgba(0,212,255,0.2)`.

### 11.5 Typography & chrome
- Body font: a clean sans (Inter or system sans). The presentation text is `font-weight:
  300` (light), `letter-spacing` wide.
- Controls/cards: rounded (radius ~1.5rem panels), translucent dark surfaces with backdrop
  blur, the accent on primary actions. These are not pixel-pinned; the **load-bearing** visual
  values are §11.1–11.4 (palette, word-active, starfield, sliders) and the §7 rendering math.

> **Decorative-drop note (deliberate scope decision).** The original shipped four
> Aceternity-style decorative components (`sparkles` via `@tsparticles`, `shooting-stars`,
> `shiny-button` + `spotlight-card` via `framer-motion`). The seed **drops all four** and
> their deps. Canonical look = pure-black presentation + the §11.3 CSS starfield + plain
> gradient-styled buttons. A rebuild that reproduces the starfield and accent palette is
> faithful; one that reaches for a particle/animation library has misread this seed.

---

## 12. Inputs (Interview)

Run `detect` for every row; send ONE consolidated Interview message (✓ satisfied, ✗ missing
tools with their `ask`, ⚠ prior-install state), then run autonomously to `SEED_RESULT=DONE`
or one `BLOCKED_REASON=`.

| name | required | default | detect | ask |
|---|---|---|---|---|
| `uv` on PATH | yes | none | `command -v uv` | "Astral's uv manages the backend env and Python toolchain (downloads Python ≥3.11 itself). Install: `curl -LsSf https://astral.sh/uv/install.sh \| sh`." |
| Node.js ≥ 18 + npm | yes | none | `node -e 'process.exit(process.versions.node.split(".")[0]>=18?0:1)'` | "Node 18+ for Vite. macOS: `brew install node`. Debian: NodeSource setup_22.x." |
| Ports 9000 + 9001 free | yes | none | `! (lsof -i :9000 -i :9001 \| grep -q LISTEN)` | "Backend binds :9000, frontend :9001 (hardcoded contracts). Free them or abort." |
| `TP_WORKSPACE` | no | `$HOME/teleprompter` | `[ -n "${TP_WORKSPACE:-}" ] \|\| true` | "Build/target dir. Created if missing." |
| `CONTENT_API_KEY` | yes | generated | `[ -s "$TP_WORKSPACE/backend/.env" ] && grep -q '^CONTENT_API_KEY=..' "$TP_WORKSPACE/backend/.env"` | "Auto-generated at build (`openssl rand -hex 16`), written to `backend/.env` (chmod 600). On re-build, confirm reuse vs reset." |
| LAN IP (phone display) | no | auto-detected | — | "Only to put the display on a real phone; the seed prints `http://<lan-ip>:9001/?mode=display`. Verify uses local browser pages — no phone needed." |
| Prior `$TP_WORKSPACE` build | conditional | preserve `.env`, rebuild code | `[ -d "$TP_WORKSPACE" ]` | "A build exists. Default: rebuild source, PRESERVE `backend/.env`, re-verify. Say 'reset' to wipe including the key." |

Substrate assumptions: macOS/Linux; internet for `uv sync` / `npm install`. No accounts, no
operator-supplied secrets, no Docker.

---

## 13. Components (what this seed assembles)

| Component | Role |
|---|---|
| `backend/` | FastAPI + native WebSocket state server (§4–5). `GET /`, `POST /api/content` (X-API-Key), `WS /ws`. Single shared `local-shared` state. pydantic-settings reads `backend/.env`. Managed by uv. |
| `frontend/` | Vite + React + TS + Tailwind SPA (§6–8, §11). Controller + display off `?mode=display`. WS URL derived from hostname — **no env**. |
| `scripts/send_roteiros.py` | The ENTER-per-take roteiro sender (§10). Stdlib only; key from env or `backend/.env`. |
| `sample-roteiro.md` | The 5-piece sample bank (§10.4): parser fixture + demo content. |
| Verify harness | **You author it** from §16 (it is NOT shipped) — a protocol-level script + a browser-driven fidelity pass. |

---

## 14. Steps — build & run (zero pre-baked source)

The agent may substitute equivalent commands but must preserve the contracts: **ports
9000/9001; `backend/.env` chmod 600; key never echoed to logs; no frontend env; the spec
(§4–11) is the source of truth — build from it, do not fetch a reference implementation.**

### Step 0: Interview
Run every §12 `detect`. Send ONE consolidated message. After the reply, run everything below
autonomously.

### Step 1: Scaffold the backend (§4–5)
Create `$TP_WORKSPACE/backend` as a uv project (Python ≥3.11) with deps from §2. Implement the
FastAPI app: health, content API (503/401/200 contract), WS `/ws` (initial sync + the §4.3
message loop + merge rules), the state model + defaults (§5), play scheduling/NTP (§4.4), WPM
derivation (§4.5). Config via pydantic-settings reading `.env` (`LOCAL_MODE`, `CONTENT_API_KEY`).

### Step 2: Backend env + deps
```sh
cd "$TP_WORKSPACE/backend"
[ -s .env ] || printf 'LOCAL_MODE=true\nCONTENT_API_KEY=%s\n' "$(openssl rand -hex 16)" > .env
chmod 600 .env
uv sync
```

### Step 3: Scaffold the frontend (§6–8, §11)
Create `$TP_WORKSPACE/frontend` as a Vite React-TS app. Vite config: `host 0.0.0.0`, `port
9001`, `allowedHosts: true`, alias `@→src`. Implement: mode routing, the WS hook (hostname-
derived URL, reconnect, `isConnected`), the display (tokenizer + font math + auto-scroll +
word-active, §7), the controller editor + calibration panel (§8.1, §9.1), the presentation
view + controls (§8.2–8.4), the countdown ring (§8.3), the §11 design tokens / starfield /
slider styling. **No** `@tsparticles`/`framer-motion`. Then `npm install`.

### Step 4: Roteiro sender + sample (§10)
Write `scripts/send_roteiros.py` (stdlib, §10.3) and `sample-roteiro.md` verbatim (§10.4).

### Step 5: Start both services (supervised)
```sh
cd "$TP_WORKSPACE/backend"  && nohup uv run uvicorn api.main:app --host 0.0.0.0 --port 9000 > /tmp/teleprompter-backend.log 2>&1 &
cd "$TP_WORKSPACE/frontend" && nohup npm run dev > /tmp/teleprompter-frontend.log 2>&1 &
```
Wait until `curl -sf localhost:9000/` and `curl -sf localhost:9001/` both succeed (~10 s for
Vite). `--host 0.0.0.0` so a phone on the LAN can reach both ports.

### Step 6: Smoke the roteiro flow (one piece)
`cd "$TP_WORKSPACE" && printf 'q\n' | python3 scripts/send_roteiros.py` → expect `Total de
peças: 5` and `✅ Enviado ao teleprompter`.

### Step 7: Operator card
Print: controller URL, display URL with the LAN IP (`http://<lan-ip>:9001/?mode=display`), and
the recording command (`python3 scripts/send_roteiros.py [your-roteiro.md]` — ENTER advances
takes; in the controller use **Skip Calibration → Start Presenting** to enter recording view).

---

## 15. Done (observable conditions)

All proven by `## Verify`:
- Backend healthy on **:9000** — `GET /` → `{"status":"ok",…}`.
- Frontend serves on **:9001** — controller `/` and display `/?mode=display` both show the
  green **Online** indicator (`#00ff88`) with **zero frontend env config**.
- `POST /api/content` with the generated key swaps content on every connected client **live**
  (open WS receives `state:sync` with the new text, `position` 0, `isPlaying` false); wrong
  key → **401**; unset key → **503**.
- The roteiro sender parses `sample-roteiro.md` into **5 pieces** (2 hooks, 1 body, 2 CTAs)
  and the ENTER-advance loop live-swaps the displayed piece each time.
- The controller can **Skip Calibration → Start Presenting** (local fallback profile, no
  external service) and a piece sent while presenting swaps the text **without leaving
  presentation**.
- The visual fidelity asserts (§16 J7–J12) match the §11 absolute values.
- Idempotent: re-running where it already succeeded re-verifies (reuses `backend/.env`,
  restarts services) instead of breaking state.

---

## 16. Verify (acceptance harness — you author it; absolute-value, self-contained)

`## Verify` is two layers, **both required when a browser is obtainable; layer 1 alone is the
minimum bar otherwise.** You write both from this spec — **nothing is shipped**.

> **Self-contained — no reference instance.** Verify drives **only the app this seed built**
> on `localhost`. It must NOT require any reference teleprompter, second instance, or golden
> screenshot. Every visual check reads computed style / DOM and compares to the **absolute
> values in §11 / §7**. If a check needs a second app to pass, that is a seed bug — fix the
> seed (carry the value), not the harness.

### Layer 1 — protocol harness (exit code = truth)
A script (any language; the backend's `websockets` dep makes Python convenient) that asserts:
1. **Health:** `GET :9000/` → 200 and body contains `"ok"`.
2. **Frontend serves:** `GET :9001/` → 200 HTML containing the root mount node.
3. **Roteiro parses:** `sample-roteiro.md` parses to **exactly 5 pieces** (2 HOOKS, 1 BODY, 2
   CTAs).
4. **Content API guard:** `POST /api/content` with a **wrong** `X-API-Key` → **401**. (If you
   can launch a backend with no key, also assert **503**.)
5. **Live load over an OPEN WebSocket:** connect `ws://localhost:9000/ws`; read the initial
   `state:sync`; `POST /api/content` with **piece 1** (the correct key); the open socket
   receives a `state:sync` whose `content` == piece-1 text, **`position` == 0**, **`isPlaying`
   == false**.
6. **ENTER advance:** `POST` **piece 2**; the open socket receives a `state:sync` swapped to
   piece-2 text. (This is the script-selection real-time swap at the protocol level.)
Exit 0 iff all pass; print enough to debug; finish < 2 min.

### Layer 2 — browser observation (the user's eyes)
Open `http://localhost:9001/?mode=display` and `http://localhost:9001/` in a real browser
(install one if needed, e.g. `npx playwright install chromium`). Drive and assert the §16
journeys below. A pass you did not observe is not a pass. If layer 2 is impossible (no browser
installable), say so explicitly next to the layer-1 proof.

---

## 16b. Verification journeys (all must pass)

**Functional:**
1. **Two pages connect.** Controller `/` and display `/?mode=display` each show the **Online**
   pill. *Assert:* the indicator dot computed `background-color` is `rgb(0,255,136)` (`#00ff88`)
   and the label text is `Online`.
2. **Live swap, no reload.** With the display open, run `printf '\nq\n' | python3
   scripts/send_roteiros.py` (or POST piece 1 then piece 2). *Assert:* the display's rendered
   text changes to the piece text **without a reload** (set a JS sentinel on `window` before;
   confirm it survives — same document).
3. **Position resets on swap.** `position` is a **word index**, not a pixel offset — assert
   the swapped `state:sync` carries **`position == 0`** (and the display visually starts at the
   top). Do not assert a DOM `scrollTop` value; the display scrolls via `scrollIntoView` on word
   spans, so there is no single scrollTop to read at index 0.
4. **Start Presenting via local fallback.** On the controller: **Skip Calibration** (or "Use
   Default Profile") enables **Start Presenting**; clicking it renders the presentation view
   (Play / Reset / SPEED / FONT SIZE / Countdown). No external service is contacted.
5. **Swap while presenting.** With the controller in presentation view, send another piece;
   the text swaps **without leaving presentation mode** (`isPresenting` stays true).
6. **Playback scrolls.** Press Play; after the countdown the text auto-scrolls and a word
   carries the `word-active` class.

**Visual fidelity (computed-style / DOM vs §11 / §7 absolute values — self-contained):**
7. **Accent + word-active.** The active word's computed `color` is `rgb(0,212,255)`
   (`#00d4ff`); `.teleprompter-word` has `border-radius: 8px` (0.5rem) and a `0.2s` transition.
8. **Starfield present, no particle lib.** A `.stars` element exists with `background-size:
   200px 200px` and the `twinkle` animation; the built bundle contains **no** `@tsparticles`
   / `framer-motion` (grep `package.json` + `node_modules` absent of those deps). *(The
   banned-dependency rule covers **runtime/app** deps only; a **test-only `devDependency`**
   such as Playwright used by the Verify harness is exempt — grep specifically for
   `@tsparticles`/`framer-motion`, not for any test tooling.)*
9. **Display font math.** With known `fontSizeVh` and viewport, the scroll container's
   computed `font-size` equals `(fontSizeVh/100) * min(innerW,innerH) * deviceMultiplier` (±1px)
   and computed `line-height` corresponds to **1.8**.
10. **Speed clamp + scale.** Dragging the SPEED slider to its extremes yields a displayed rate
    of **0.25x** and **4.00x** (never beyond); center reads **1.00x**. Tick labels read
    `0.25x / 1x / 4x`.
11. **Font slider bounds.** FONT SIZE slider extremes read **2.0v** and **15.0v**, default
    **4.5v**.
12. **Countdown options.** The countdown control offers exactly **1s / 3s / 5s**, default
    **3s**, and starting Play shows a circular countdown before scrolling.

---

## 17. Failure modes (known)

**Display/controller shows "Offline" (red/indigo).** Detect: `curl -sf :9000/` fails, or the
page was opened on a hostname that can't reach `:9000` (WS URL is
`ws://<page-hostname>:9000/ws`). Fix: start the backend; open the page via the same host/IP
that serves both ports; check `/tmp/teleprompter-backend.log`.

**`POST /api/content` → 503 "Content API not configured".** Detect: no `CONTENT_API_KEY` in
`backend/.env`, or the backend was started from a different cwd than `backend/` (pydantic-
settings reads `.env` relative to cwd). Fix: Step 2; start uvicorn **from** `backend/`.

**`POST /api/content` → 401.** Detect: sender key ≠ backend key (stale `CONTENT_API_KEY` env
shadowing `backend/.env`). Fix: `unset CONTENT_API_KEY` so the sender reads `backend/.env`, or
align them.

**Display connects but never shows text / never scrolls.** Detect: words render but no
`word-active`, or content empty. Fix: ensure `state:sync` is sent on WS connect; ensure the
tokenizer assigns `data-word-index`; ensure the scroller keys off `isPlaying`.

**Reached for a particle/animation library.** Detect: `@tsparticles` or `framer-motion` in
`package.json`. Fix: remove them — the canonical decorative layer is the §11.3 CSS starfield
only.

**Port already in use on 9000/9001.** Detect: `lsof -i :9000 -i :9001 | grep LISTEN`. Fix:
kill the stale process (`pkill -f 'uvicorn api.main:app'; pkill -f vite`) or free the port.

**`vite: command not found` / esbuild platform errors after copying a build between machines.**
Fix: `rm -rf node_modules && npm install` (never copy `node_modules` across hosts).

---

## 18. Convergence notes (read before building)

- **The two contracts that bite first** are the **frontend WS-URL derivation** (must be
  hostname-derived, no env — this was the #1 fresh-install failure) and the **content-API key
  seam** (sender key must match `backend/.env`; 503 when unset, 401 on mismatch). Build both
  exactly as §4/§6/§10 specify and they won't surprise you.
- **Outbound state is camelCase.** Verify reads `content`/`position`/`isPlaying` off the
  `state:sync` frame — serialize with camelCase keys.
- **`POST /api/content` leaves `isPresenting` alone** — a take swap must not eject the operator
  from the presentation view. This is load-bearing for J5.
- **Local fallback is the done path.** Do not let the optional STT panel gate presenting; the
  "Skip Calibration / Use Default Profile" button must always reach a working state with no
  network.
- **Drop the decorative particle layer.** Recreate the §11.3 starfield in plain CSS; that is
  the whole "feel," and it's fully specified here.

## 19. Cleanup
```sh
pkill -f 'uvicorn api.main:app' 2>/dev/null; pkill -f 'vite' 2>/dev/null
rm -rf "$TP_WORKSPACE"
```
