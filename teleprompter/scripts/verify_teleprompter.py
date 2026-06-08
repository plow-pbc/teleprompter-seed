"""Acceptance harness for the teleprompter seed. Exit code is the truth.

Proves the CEO's recording contract end-to-end at the protocol level:
the exact `state:sync` WebSocket broadcast that every display renders from.

Checks:
1. Backend health:    GET  :9000/        -> 200 {"status": "ok"}
2. Frontend serves:   GET  :9001/        -> 200 HTML
3. WS connects:       ws://:9000/ws      -> initial state:sync arrives
4. Live script load:  POST /api/content (piece 1 of the roteiro) -> the OPEN
   WS receives state:sync with that text, position reset to 0
5. ENTER advance:     POST piece 2       -> WS receives the swapped text live

Run from the install root:
    cd backend && uv run python ../scripts/verify_teleprompter.py

Requires the backend's own deps only (websockets is a backend dependency).
"""

import asyncio
import json
import sys
import urllib.request
from pathlib import Path

import websockets

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from send_roteiros import API_KEY, parse_roteiros  # noqa: E402

BACKEND = "http://localhost:9000"
FRONTEND = "http://localhost:9001"
WS_URL = "ws://localhost:9000/ws"
TIMEOUT = 10.0


def http_get(url: str) -> tuple[int, str]:
    with urllib.request.urlopen(url, timeout=5.0) as response:
        return response.status, response.read().decode("utf-8", errors="replace")


def post_content(text: str) -> int:
    payload = json.dumps({"content": text}).encode("utf-8")
    request = urllib.request.Request(
        f"{BACKEND}/api/content",
        data=payload,
        headers={"X-API-Key": API_KEY, "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=5.0) as response:
        return response.status


async def wait_for_content(ws, expected: str) -> dict:
    """Read WS messages until a state:sync carries the expected content."""
    while True:
        raw = await asyncio.wait_for(ws.recv(), timeout=TIMEOUT)
        message = json.loads(raw)
        if message.get("type") == "state:sync" and message["data"].get("content") == expected:
            return message["data"]


async def main() -> int:
    failures: list[str] = []

    def check(label: str, ok: bool, detail: str = "") -> None:
        print(f"  {'✅' if ok else '❌'} {label}" + (f" — {detail}" if detail else ""))
        if not ok:
            failures.append(label)

    print("== Teleprompter seed verify ==")

    # 1. Backend health
    status, body = http_get(f"{BACKEND}/")
    check("backend health 200 + status ok", status == 200 and '"ok"' in body, body[:60])

    # 2. Frontend serves
    status, body = http_get(f"{FRONTEND}/")
    check("frontend HTTP 200 + HTML", status == 200 and "<div id=\"root\"" in body)

    # Parse the bundled sample roteiro (also proves the parser fixture)
    sample = (REPO_ROOT / "sample-roteiro.md").read_text(encoding="utf-8")
    pieces = parse_roteiros(sample)
    check("sample roteiro parses to 5 pieces", len(pieces) == 5, f"got {len(pieces)}")
    hooks = [p for p in pieces if p["type"] == "HOOKS"]

    # 3-5. Live sync over an OPEN websocket (what the display renders from)
    async with websockets.connect(WS_URL, open_timeout=TIMEOUT) as ws:
        raw = await asyncio.wait_for(ws.recv(), timeout=TIMEOUT)
        initial = json.loads(raw)
        check("WS delivers initial state:sync", initial.get("type") == "state:sync")

        # Piece 1 — "load a script -> the display shows it live"
        status = post_content(hooks[0]["text"])
        check("POST /api/content piece 1 -> 200", status == 200)
        data = await wait_for_content(ws, hooks[0]["text"])
        check(
            "live state:sync carries piece 1, position reset",
            data["position"] == 0.0 and not data["isPlaying"],
        )

        # Piece 2 — "ENTER advances takes"
        status = post_content(hooks[1]["text"])
        check("POST /api/content piece 2 (ENTER advance) -> 200", status == 200)
        await wait_for_content(ws, hooks[1]["text"])
        check("live state:sync swapped to piece 2", True)

    if failures:
        print(f"\nVERIFY FAILED: {len(failures)} check(s): {failures}")
        return 1
    print("\nVERIFY PASSED — teleprompter is live and the roteiro flow works.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
