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
> backend (FastAPI + WebSocket on **:9000**), frontend (Vite + React on **:9001**), and the
> roteiro sender — from this specification alone, until every §16 acceptance journey passes.
> Run `## Steps` Step 0 (single Interview turn), then execute every Step in order, then
> perform `## Verify`. When all Verify evidence is in hand print `SEED_RESULT=DONE`; on a
> blocker print `BLOCKED_REASON=<short reason>` and stop. Do not ask the human anything
> outside the single Interview turn.
>
> **Definition of done.** A fresh machine ends with a running teleprompter: the **controller**
> at `http://<host>:9001/` shows a green **Online** indicator with **zero frontend env
> config**, opens on a **real sample roteiro** (not a placeholder/test string), and goes from
> **paste/pick a script → Start Presenting in ONE click** (no calibration, no gate) into a
> recording view that **plays, scrolls, highlights the active word, and is recoverable by hand
> when it drifts**. The **display** at `http://<host>:9001/?mode=display` shows **only the
> script** on **solid pure black** — no Online pill, no readouts, no units — and follows the
> controller live. A **roteiro** loaded in the sender pushes a script bank so that **each
> ENTER live-swaps the displayed text on every connected client, no refresh** — the CEO's
> proven recording workflow. All of this observable and green in §16; the seed is proven only
> when a blind rebuild from this spec passes as a **quality product**.

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
   query param: **controller** (edits the script, runs the presentation, owns all status &
   controls) or **display** (read-only, auto-syncs, lives on the phone, shows **only the
   script**). The WebSocket URL is **derived from the page's own hostname** — there is no
   frontend env file, so the phone reaches the backend at the same IP it loaded the page from.
3. **Roteiro sender** — a stdlib-only Python script that parses the roteiro markdown bank and
   `POST`s one piece at a time to the backend's content API; each post broadcasts the new
   text to every display **live**. This is the **script-selection-modifies-content-in-real-
   time** feature: selecting/advancing a script piece from the roteiro changes what every
   teleprompter shows, instantly.

Character traits the rebuild must preserve:
- **One shared state, broadcast to all.** Any mutation (controller edit, play/pause, a
  roteiro `POST`, or a manual scrub) reflects on **every** connected client with no refresh.
- **Zero-config display.** The display page derives its backend URL from its own hostname —
  open it on a phone via the LAN IP and it just connects.
- **One click into recording.** Paste or pick a script → **Start Presenting**. No calibration,
  no "speed training," no gate. The pacing engine ships preconfigured (§9).
- **ENTER-per-take roteiro flow.** The recording loop is: phone on camera → run the sender →
  ENTER advances takes → each ENTER live-swaps the display text and resets scroll position.
- **Recoverable takes.** Auto-scroll paces from a speech profile, but the operator can always
  take the wheel — pause/resume, scrub by word, jump by line, nudge speed — so a take that
  drifts off the speaker's pace is **recovered, not lost** (§8.4).
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
- **Roteiro sender**: a **stdlib-only** Python 3 script (`urllib`, `re`, `json`, `pathlib`).
  No third-party deps — it must run under the same `uv` env or a bare `python3`.
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
            │  - POST /api/content  (X-API-Key)  ← sender   │
            │  - WS  /ws          state:sync to ALL clients │
            └───────▲───────────────────────▲───────────────┘
        WS state:update│        WS (read-only)│  state:sync (broadcast)
                       │                      │
        ┌──────────────┴───────┐   ┌──────────┴───────────────┐
        │ Controller :9001/    │   │ Display :9001/?mode=display│
        │ edit, present, drive │   │ phone at camera, SCRIPT-ONLY│
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

**One subtlety that is load-bearing for "inline editing must not reset scroll":** a *content
edit* arriving over the **WS door** (`state:update {content}`) does **NOT** touch `position` —
the operator editing a typo mid-take keeps their place. Only the *content-API door* (a roteiro
take-swap) resets `position` to 0. Clients must mirror this: re-render text on any content
change, but **clamp & keep the current word index** on a WS content edit; **only** jump to the
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
   beginning — this is a *new take*); **`state.is_playing = false`** (pause). **`state.is_presenting`
   is left UNCHANGED** — a piece sent while presenting must NOT kick the operator out of the
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
- `position` → set **only if** present **and** the state is **not currently playing**
  (during playback the client owns position locally; ignore stale position pushes). This is
  the seam that lets a **paused** controller scrub the displays (drift recovery, §8.4).
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
| `content` | string | the §10.5 sample roteiro text | the script text shown — **never an empty/test placeholder on done** |
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

> The backend **seeds `content` with the §10.5 sample roteiro** at process start (a real
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
    absent (first ever load), seed from the **§10.5 sample roteiro**, never an empty string or
    a test string.
  - `display-mirror` (boolean) — the device's **horizontal-flip / mirror** toggle for glass
    teleprompter rigs (§8.5). Local to that device, **not synced** over WS.
  - `tp-scripts` (JSON array of `{id, name, content}`) and `tp-active-script` (id) — the
    **script library** (§8.2). Seeded on first load with the §10.5 samples.
  None of these gate Verify; persistence is a convenience.
- **Dark class:** the app adds `dark` to `<html>` on mount.
- **On `state:sync` received:** set content; **on a content change, KEEP the current word
  index** (clamp to the new word count) — do **not** jump to the top — *unless* the incoming
  `position` is itself 0 (take-swap / Reset), in which case go to the top. In **display** mode
  adopt `isPresenting` from the state (so the phone follows the controller into/out of
  presentation); clamp and store `playbackRate`; update font size / colors / countdown;
  reconcile play state and scroll position (during playback keep local position; when paused
  adopt the synced position — this is how a paused scrub on the controller moves the display).
- **Controller emits** partial `state:update`s on: content edit, playbackRate change, font
  size change, countdown change, manual scrub/jump **while paused** (a `position` update), and
  on entering/exiting presentation. The display emits nothing (read-only).

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
  playing** (auto-advance) and **`auto` (instant) while seeking / paused** (scrub, position set,
  reset). The container is `overflow-y-auto` and scroll-smooth; the per-word `scrollIntoView` is
  what moves the page — words on a line are highlighted in place, and the page scrolls when the
  centered word moves to a new line. **This per-word highlight + scrollIntoView centering is the
  required behavior; do not replace it with a crawl.**

**Manual override (drift recovery — §8.4) shares the same integer index.** Scrubbing/jumping sets
`currentWordIndex` directly and re-highlights/centers it with **`behavior: 'auto'` (instant)**;
exactly one `word-active` follows. The controller throttles outgoing `position` `state:update`s
to **one per 100 ms** (with a trailing emit so the final scrub position reaches the displays). On
a WS content change that is **not** a take-swap, clamp the index into the new word range and keep
it (do not reset) — see §3/§6.

---

## 8. The controller UI + presentation view — FIXED constants

The controller has two screens: the **Editor** (default, not presenting) and the
**Presentation view** (after Start Presenting). The display page always renders the
presentation reading surface, read-only and script-only (§8.5).

### 8.1 Editor screen — one click into recording, no gate
The editor is calm and obvious. Top to bottom:
- **Header bar:** product title `TPFlow Teleprompter` + subtitle `Controller`, the
  **Online/Offline** pill (§6), and a **"Display Mode"** button → switches this page to
  `?mode=display`.
- **Script Library** (§8.2) — pick/save/name/delete scripts. Selecting one loads it into the
  editor.
- **Roteiro panel** (§8.7) — a loaded roteiro bank parsed into **clickable parts** (hooks /
  bodies / CTAs). **Clicking a part live-swaps the teleprompter content to that part on every
  connected display, in real time** — the in-controller twin of the terminal sender, and a
  done-gating feature (J20).
- A large **textarea** (the script editor), `spellcheck=false`, prefilled on first load with
  the **§10.5 sample roteiro** (NOT an empty box and NOT a test string like "This is a text
  from Daniel!"); placeholder (only if cleared) `Paste or type your script here...`; edits push
  `state:update {content}` live.
- **Primary action: a single, always-enabled `Start Presenting` button** (full-width, accent
  gradient). **There is NO calibration step, NO "Speed Training" panel, NO gate.** Clicking it
  enters the presentation view immediately. The pacing engine is the §5 fixed profile, already
  loaded. (Removing the calibration gate is **load-bearing** — the old build's fake "🎙 Record
  / Calibrate" that blocked Start Presenting is **cut entirely**; do not reintroduce it.)

### 8.2 Script Library — minimal, real
A small library so the operator manages multiple roteiros instead of one raw textarea:
- Backed by `tp-scripts` localStorage (array of `{id, name, content}`) + `tp-active-script`.
- **Seeded on first load** with the §10.5 samples (at least two named scripts, e.g.
  `Demo — Abertura` and `Demo — CTA`), so the library is never empty.
- UI: a list (or select) of saved scripts by **name**; controls to **New** (blank, prompts a
  name), **Save** (writes the current textarea to the active script), **Rename**, and
  **Delete**. **Selecting a script loads its `content` into the editor and pushes
  `state:update {content}`** (so the display swaps too).
- This is product polish, not a protocol contract — keep it minimal; absolute requirement is
  only: ≥2 named seeded scripts, select-loads-content, save persists.

### 8.3 Presentation view (controller)
- **Solid pure-black** screen (§7.2 reading surface — **no starfield, no decorative layer**),
  the centered scrolling text (§7), a top bar with the **Online/Offline** pill (controller
  only).
- **Controller-only controls bar** (the display does NOT show this bar — §8.5). Contains:
  - **Play / Pause** button — label `▶ Play` / `⏸ Pause` / `⏳ Waiting` (waiting = countdown
    or pending scheduled start). Starting playback runs a **countdown** first.
  - **Reset** button (`↻ Reset`) → position 0, paused.
  - **Exit** (`✕ Exit`) → returns to the editor / unsets presenting.
  - **A scrub bar** — a range input spanning `0 … lastWordIndex` showing playback progress;
    **dragging it scrubs the active word index** (drift recovery, §8.4). A small readout shows
    `word <i+1> / <N>` (a plain count — not jargon).
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
- **Auto-hide:** while playing / counting down / pending start, the controls slide away and a
  small grab-handle remains; hovering brings them back.
- **Entering presentation** (`Start Presenting`): set `isPresenting=true`, `position=0`,
  `isPlaying=false`, force `backgroundColor="#000000"`, `textColor="#ffffff"`, and emit a
  `state:update` with exactly those fields (so the phone display follows into presentation).

### 8.4 Keyboard + manual pace / drift recovery — FIXED bindings
Auto-scroll paces from the profile, but it **will** drift off a live speaker. The operator must
always be able to recover the take by hand. The recovery loop is: **pause → scrub back to the
spoken word → resume from there** (and on resume the controller's `play:start` carries the
corrected `position`, so every display jumps to the right word too). All bindings are active in
the presentation view (controller) and ignored while focus is in an `<input>`/`<textarea>`:

| key | action (absolute) |
|---|---|
| `Space` | toggle play / pause |
| `ArrowUp` | speed **+0.1** (re-clamp to [0.25, 4]) |
| `ArrowDown` | speed **−0.1** (re-clamp) |
| `ArrowRight` | scrub active word **+1** |
| `ArrowLeft` | scrub active word **−1** |
| `Shift+ArrowRight` | scrub active word **+10** |
| `Shift+ArrowLeft` | scrub active word **−10** |
| `PageDown` | jump to the **next line / paragraph break** (next `\n`-delimited line) |
| `PageUp` | jump to the **previous line / paragraph break** |
| `Home` | jump to the **first** word (position 0) |
| `End` | jump to the **last** word |
| `M` | toggle **mirror** (horizontal flip) |

Plus pointer affordances: the **scrub bar** drags the active index; **clicking/tapping a word**
on the presentation text jumps the active index to that word (jump-to-line by eye). Every scrub
/ jump re-centers via `scrollIntoView`; while **paused** it emits a throttled
`state:update {position}` so the displays follow (§4.3 position seam). Speed nudges always
re-clamp via the single `clampPlaybackRate`.

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
- The countdown ring (§8.6) is allowed on the display (a filming cue, not status/jargon).
- Everything else (text, font math, auto-scroll, word-active focus) is identical to the
  controller's reading surface.

### 8.6 Countdown — pre-roll on every play (the CEO original)
Pressing Play (when not already playing) with `countdownSeconds > 0` shows a **circular
countdown** (a ring that depletes) centered over the text, counting whole seconds down to 1, then
begins the scroll — this fires on **every** play start, including resuming after a pause (the
CEO-original `togglePlay → startCountdown` behavior; the earlier "immediate mid-take resume" was
an invented deviation and is discarded). With `countdownSeconds = 0`, start immediately. The
countdown duration drives the local pre-roll and the `desiredStartMs` sent on `play:start`
(§4.4).

### 8.7 Roteiro panel — clickable parts (controller; real-time take-swap) — FIXED
The controller carries an **in-UI twin of the terminal sender (§10)**: a roteiro bank parsed
into **clickable parts**, so the operator can drive takes from the laptop with a click instead
of (or alongside) the terminal. This is **done-gating** (J20) and is the second half of the
CEO's multi-device contract (J19/J20).
- **Source.** The panel parses a roteiro markdown bank with the **same §10.1 grammar / §10.2
  ordering** as the sender, **client-side**. It is **seeded with the §10.4 bundled sample bank**
  (so the panel is never empty) and offers a small **paste/load** box to parse a custom bank.
- **Render.** Show the **ordered** parts (HOOKS → BODIES → CTAs, §10.2) as a list of clickable
  items, each labeled with its piece id (`H1`, `B1`, `CTA2`, …) and a short text preview. Each
  item carries `data-testid="roteiro-part"` and `data-part-id="<id>"` so Verify can target it.
- **Click = real-time take-swap.** Clicking a part sets that part's text as the teleprompter
  content **on every connected client, live** — a new take: it **resets to the top and pauses**.
  Emit a single `state:update { content: <part text>, isPlaying: false, position: 0 }`. Because
  the server applies `isPlaying` before `position` (§4.3), the `position: 0` takes effect even
  if it was playing, and every display jumps to the top of the new part (this is the **one**
  content change that carries `position: 0` — distinct from an inline edit, which omits
  `position` and keeps the operator's place, §3/§7.4).
- **Parallel with the terminal sender.** The §10.3 `send_roteiros.py` ENTER-per-take flow still
  works unchanged; the panel is an additional door into the same shared state. Both reach every
  display through the same broadcast path.

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

## 10. The roteiro / script-selection real-time swap — FIXED

This is the CEO's recording workflow and the headline feature: **selecting a script piece
from the roteiro bank modifies the teleprompter content in real time.** There are **two doors**
into it, and both are done-gating: the **terminal sender tool** (this section) and the
**controller roteiro panel** (§8.7, clickable parts). Both parse the same **roteiro markdown
format** (§10.1) and reach every connected display through the same broadcast path — selecting
a part by ENTER (terminal) or by click (controller) swaps the displayed content live.

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
CTAs) and the demo bank. Real ad copy, not test strings. Write this file verbatim:

```markdown
# Banco de Gravacao — Sample

> **Total de pecas:** 5 (1 anuncio: 2 hooks + 1 body + 2 CTAs)
> **Como gravar:** Grave todos os hooks seguidos, depois o body, depois os CTAs.
> Na edicao, combine qualquer Hook + Body + CTA.

---
---

# ANUNCIO 1 — "TELEPROMPTER" (Angulo: grave sem decorar)

---

## HOOKS — Anuncio 1 (2 variacoes)

### 1.H1
> Voce ainda perde tempo decorando o que vai falar na frente da camera?

### 1.H2
> E se o seu roteiro rolasse na tela, no seu ritmo, enquanto voce so olha pra lente?

---

## BODIES — Anuncio 1 (1 variacao)

### 1.B1 — Corpo
> Com o TPFlow voce cola o roteiro, abre o display no celular em cima da camera, e clica em Iniciar Apresentacao. Uma unica vez.
>
> O texto sobe sozinho, a palavra atual fica em destaque, e se voce se perder e so pausar, voltar a palavra certa, e continuar. A gravacao nao se perde.

---

## CTAs — Anuncio 1 (2 variacoes)

### 1.CTA1
> Cola o seu primeiro roteiro agora e grava o proximo video lendo direto da tela.

### 1.CTA2
> Link na descricao. Comeca hoje e nunca mais trava no meio de uma gravacao.
```

### 10.5 First-load sample content (the controller/display open on this)
The backend seeds `state.content` (and the frontend seeds `teleprompter-content` / the script
library) with this **real** sample roteiro on first load — **never** an empty box or a test
string. Use this exact text (Portuguese, the CEO's filming language) as the default
`Demo — Abertura` script, plus a short `Demo — CTA`:

```text
Demo — Abertura:
Ola pessoal, bem-vindos a mais um video do canal.

Hoje eu vou te mostrar como gravar os seus videos lendo direto da tela, sem decorar uma unica linha.

O texto rola no seu ritmo, a palavra atual fica em destaque, e voce so precisa olhar pra camera e falar.

Cola o seu roteiro, clica em Iniciar Apresentacao, e comeca a gravar.

Demo — CTA:
Gostou? Entao deixa o like, se inscreve no canal, e me conta nos comentarios qual video voce quer ver a seguir.
```

The `Demo — Abertura` body is the default `content`. (Verify J17 asserts the first-load content
is this sample, not `This is a text from Daniel!` or an empty textarea.)

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
  transition: all 0.2s ease;
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
| `backend/` | FastAPI + native WebSocket state server (§4–5). `GET /`, `POST /api/content` (X-API-Key), `WS /ws`. Single shared `local-shared` state, **seeded with the §10.5 sample content**. pydantic-settings reads `backend/.env`. Managed by uv. |
| `frontend/` | Vite + React + TS + Tailwind SPA (§6–8, §11). Controller (editor + script library + **roteiro panel with clickable parts §8.7** + presentation + drift-recovery controls) and **script-only display** off `?mode=display`. Solid-black reading surface, **original glowing-box word-by-word highlight (§7.4/§11.2)**, mirror mode. Multi-device: every controller action replicates to every display over WS (§15/J19). WS URL derived from hostname — **no env**. **No calibration. No starfield/particle libs.** |
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
message loop + merge rules, including **content-edit-does-not-reset-position**), the state model
+ defaults (§5, **seed `content` with the §10.5 sample**), play scheduling/NTP (§4.4), WPM
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
derived URL, reconnect, `isConnected`), the display (tokenizer + font math + **solid-black
surface** + **original word-by-word auto-scroll: single glowing-box `word-active` advancing
word-by-word, centered via per-word `scrollIntoView`** + **mirror mode**, §7/§8.5/§11), the controller
**editor (no calibration gate) + script library** (§8.1–8.2), the presentation view + controls +
**scrub bar / drift-recovery keybindings** (§8.3–8.4), the countdown ring (§8.6), the §11 design
tokens / slider styling. **No** calibration panel, **no** `@tsparticles`/`framer-motion`, **no**
starfield. Then `npm install`.

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
Print the **network** URLs (so the CEO can run controller and display on **two devices**):
- Controller (laptop): `http://<lan-or-tailnet-ip>:9001/`
- Display (phone at camera): `http://<lan-or-tailnet-ip>:9001/?mode=display`
- Recording from terminal: `python3 scripts/send_roteiros.py [your-roteiro.md]` (ENTER advances
  takes), **or** click roteiro parts directly in the controller's roteiro panel (§8.7).
Note the one-click flow: in the controller, **pick/paste a script → Start Presenting** (no
calibration), and **mirror** with the display's mirror toggle / `M` for a glass rig. Because
both ports bind `0.0.0.0` and the WS URL is hostname-derived, opening the display URL on a
second device replicates every controller action live (multi-device, §15/J19).

---

## 15. Done (observable conditions)

**"Done" = a human can actually RECORD a video with it.** Synthetic checks passing is NOT
done — the bar is the **7-point Definition of a Working Teleprompter**, proven by a **real
user-drive** (§16), not by green check-marks. All 7 must hold:

1. **2-DEVICE SYNC.** Two **independent** clients — a CONTROLLER and a DISPLAY-ONLY in separate
   browser contexts on separate origins (two real devices, not two tabs) — stay in lock-step:
   **every** controller action (content edit, settings, take advance/scrub, roteiro selection)
   shows on the display **≤ 1000 ms**, via the backend WS (no shared client state).
2. **SCRIPT-IN.** Paste/type/pick a script on the controller → it appears on the display. The
   app opens on a **real sample roteiro** (never a placeholder/test string).
3. **ROTEIRO REAL-TIME.** **Clicking a roteiro PART** on the controller swaps the display
   content to that part **≤ 1000 ms** and resets it to the top — in parallel with the terminal
   sender. (`POST /api/content` guards still hold: wrong key → 401, unset → 503.)
4. **PRESENT + READ LEGIBLY — the ORIGINAL word-display model.** One click into the presentation
   view; the **single current word is highlighted** (the cyan→violet **glowing box**, exactly one
   `word-active`) and **advances word-by-word**, kept **centered** via per-word `scrollIntoView`
   (§7.4/§11.2). Every word is legible (plain white; no dim/fade). The font is **large enough to
   read at camera distance**. (NOT a continuous crawl, NOT a fade model — those were inventions.)
5. **MID-TAKE CONTROL / DRIFT RECOVERY.** When auto-scroll drifts off the speaker, the take is
   **recoverable, not lost**: pause **keeps your place** (it must NOT jump to 0), scrub
   back/forward by word/line, the display follows, and resume continues from the corrected word
   (a play/resume runs the §8.6 countdown, the CEO-original).
6. **NO DEAD CONTROLS / NO SCAFFOLD.** **Every control does something** (Play/Pause, Reset, Exit,
   scrub, Speed, Text-size, Countdown, Mirror — no dead buttons); and there are **no scaffold
   tells** — no starfield, no status/units chrome on the display, no placeholder/bilingual/jargon
   strings. (The cyan glowing-box active word is the **correct original look**, not a scaffold
   tell — §11.2.)
7. **SURVIVES A REAL SESSION.** A sustained recording session — swap several roteiro parts,
   present, play, scrub repeatedly, change speed/font, mirror — runs with **zero console/page
   errors**, no crash, no stuck/NaN state, no unbounded drift, the display stays in sync, and
   the controller stays responsive (can exit back to the editor).

Idempotent: re-running where it already succeeded re-verifies (reuses `backend/.env`, restarts
services) instead of breaking state.

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
4. **Seeded content:** the initial `state:sync` on a fresh WS connect carries **non-empty**
   `content` that is the §10.5 sample (contains a recognizable sample phrase, e.g. `roteiro`),
   **not** an empty string and **not** `This is a text from Daniel!`.
5. **Content API guard:** `POST /api/content` with a **wrong** `X-API-Key` → **401**. (If you
   can launch a backend with no key, also assert **503**.)
6. **Live load over an OPEN WebSocket:** connect `ws://localhost:9000/ws`; read the initial
   `state:sync`; `POST /api/content` with **piece 1** (the correct key); the open socket
   receives a `state:sync` whose `content` == piece-1 text, **`position` == 0**, **`isPlaying`
   == false**.
7. **ENTER advance:** `POST` **piece 2**; the open socket receives a `state:sync` swapped to
   piece-2 text. (This is the script-selection real-time swap at the protocol level.)
8. **Inline edit keeps position (protocol):** send `state:update {content: "<edited>",
   isPlaying: true, position: 12}` then a follow-up `state:update {content: "<edited2>"}`; the
   resulting `state:sync` keeps **`position == 12`** (a content edit must NOT reset position;
   only the content-API door / `play:reset` resets to 0).
9. **Two-client broadcast (multi-device backstop):** open **two independent** WS connections
   (sockets 1 and 2). Send a `state:update {content: "<sentinel>"}` on socket 1; *assert* socket
   2 receives a `state:sync` with that content. Then send a roteiro-PART take-swap
   `state:update {content: "<part>", isPlaying: false, position: 0}` on socket 1; *assert* socket
   2 receives `content == <part>` **and `position == 0`**. (Replication is server-side broadcast,
   so it holds for any two clients — phones included.)
Exit 0 iff all pass; print enough to debug; finish < 2 min.

### Layer 2 — the REAL USER-DRIVE (this is the bar; it REPLACES synthetic journeys)
**Drive the app like a human recording a video** and measure the outcome of the §16b
7-point definition. Open the CONTROLLER and the DISPLAY in **two independent browser contexts**
(Playwright `browser.newContext()` twice → isolated storage) on **separate origins** (controller
`http://localhost:9001`, display `http://127.0.0.1:9001` or the LAN/tailnet IP) so 2-device sync
is proven through the backend WS, not shared client state. Then actually USE it: paste a script,
click roteiro parts, present, **play and watch the highlighted current word advance word-by-word,
centered** (the original glowing box), pause and scrub to recover, change speed/font, mirror, run
a sustained session. **A green synthetic check is NOT a pass — the pass is the measured 7-point
drive below.** Install a browser if needed (`npx playwright install
chromium`); if no browser is installable, say so next to the layer-1 proof (then §16b cannot be
claimed). Capture screenshots of **both clients** showing the same synced state.

---

## 16b. The 7-point real user-drive (the acceptance bar — drive it, don't check-mark it)

Each point is exercised by USING the app across **two independent clients** and is accepted only
against the **measured thresholds** (absolute values). These **REPLACE** the old synthetic
J-journeys: a green check-mark is not a pass; the smooth, readable, recoverable drive is.

**1. 2-DEVICE SYNC (independent clients).** Client A = controller (`localhost:9001`), client B =
display-only (`127.0.0.1:9001` / LAN / tailnet) in **separate contexts**. *Assert:* the two
origins differ (not two tabs of one context), and B reflects a controller content edit
**≤ 1000 ms** (measure & print the latency).

**2. SCRIPT-IN.** Type a unique sentence into the controller editor (or pick a Script-Library
entry). *Assert:* B's `.teleprompter-text` contains it **≤ 1000 ms**; and on first load the
content is the §10.5 sample (contains e.g. `roteiro`), never `This is a text from Daniel!` or
empty.

**3. ROTEIRO REAL-TIME.** Click a roteiro PART (`[data-testid="roteiro-part"]`) on the
controller. *Assert:* B's text becomes that part **≤ 1000 ms** and **resets to the top**
(`position == 0` / first word active); a second part-click updates B again. (Backstop: wrong
`X-API-Key` → 401, unset key → 503.)

**4. PRESENT + READ LEGIBLY — the ORIGINAL word-display.** Enter presentation in one click, press
Play, and sample the display state across ~2 s of playback. *Assert all:*
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

**5. MID-TAKE CONTROL / DRIFT RECOVERY.** While playing, press `Space` to pause. *Assert:* the
active word index is **preserved (non-zero) — pause must NOT reset to 0** (that bug loses the
take). Then `ArrowLeft` ×N (or scrub bar / click a word): *assert* the active index moves back by
N (clamped at 0), the highlight re-centers **instantly** (`behavior: 'auto'`), and the **display
follows ≤ 1000 ms**. Press `Space` to resume: *assert* playback continues from the corrected word
(a §8.6 countdown precedes the scroll, the CEO-original) and the index advances afterward.

**6. NO DEAD CONTROLS / NO SCAFFOLD.** *Assert:* (a) **every control acts** — Reset → index 0;
Mirror → `scaleX(-1)`; Speed slider extremes read `0.25× / 4.00×`; Text-size slider moves the
display font; Countdown offers `1s / 3s / 5s` — **no dead buttons**; (b) **no scaffold tells** on
the display — no `.stars`/starfield, no status pill / readouts / `vmin` jargon, no
placeholder/bilingual button text; and no `@tsparticles`/`framer-motion` in the bundle. (The
cyan glowing-box active word is the **correct original look** — NOT a scaffold tell.)

**7. SURVIVES A REAL SESSION.** Run a sustained session through both clients — swap several
roteiro parts (verify the display matches the controller each time), present, play, scrub
repeatedly, change speed and font, toggle mirror. *Assert:* **zero console/page errors**, no
crash, the active index stays finite (no NaN/stuck), the display stays in sync, and the
controller stays responsive (Exit returns to the editor).

> **Evidence (the CEO verifies by eye):** screenshots of **BOTH** independent clients
> (A controller + B display) showing the **same synced state** after a controller action AND
> after a roteiro-part click, **plus a playback frame showing the ORIGINAL highlighted current
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

**Port already in use on 9000/9001.** Detect: `lsof -i :9000 -i :9001 | grep LISTEN`. Fix:
kill the stale process (`pkill -f 'uvicorn api.main:app'; pkill -f vite`) or free the port.

**`vite: command not found` / esbuild platform errors after copying a build between machines.**
Fix: `rm -rf node_modules && npm install` (never copy `node_modules` across hosts).

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
- **Drift recovery is real.** Pause → scrub (ArrowLeft/Right, scrub bar, click-a-word) →
  resume; a paused scrub emits `state:update {position}` and moves the displays (§4.3 seam).

## 19. Cleanup
```sh
pkill -f 'uvicorn api.main:app' 2>/dev/null; pkill -f 'vite' 2>/dev/null
rm -rf "$TP_WORKSPACE"
```
