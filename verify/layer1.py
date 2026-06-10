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
        and by_section.get("Corpo") == 2
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
            and "canal" in content
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
