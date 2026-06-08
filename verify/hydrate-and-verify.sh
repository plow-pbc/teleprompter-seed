#!/usr/bin/env bash
# Blind rebuild-from-spec + verify, as a cold stranger, in a throwaway node:20-slim.
# Requires: Docker, and a `claude` CLI authenticated on the host (creds at ~/.claude).
# Usage:  ./verify/hydrate-and-verify.sh
#
# This is an INTENT-SPEC seed: SEED.md is the whole asset — there is NO shipped app bundle.
# A fresh blind agent is handed ONLY SEED.md and must BUILD the product (FastAPI+WS backend,
# Vite/React controller+display, the roteiro sender) from the spec alone, then author and run
# the seed's own ## Verify. A pass ends with SEED_RESULT=DONE.
#
# Note: this runs the Layer-1 (exit-code) acceptance proof headless. The seed's Layer-2
# real-browser observation (computed-style/DOM fidelity vs §11) is an agent-with-eyes step —
# run it on a host with a browser (the agent self-installs Playwright chromium per the seed).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEED="$ROOT/SEED.md"
[ -f "$SEED" ] || { echo "missing SEED.md at repo root" >&2; exit 1; }

WORK="$(mktemp -d)"
# Hand the agent ONLY the spec. No bundle — that is the whole point of an intent-spec seed.
cp "$SEED" "$WORK/SEED.md"

CLAUDE_HOME="$(mktemp -d)"; cp -R "$HOME/.claude/." "$CLAUDE_HOME/" 2>/dev/null || true
cp "$HOME/.claude.json" "$CLAUDE_HOME.json" 2>/dev/null || true

docker run --rm \
  -v "$CLAUDE_HOME:/home/node/.claude" -v "$CLAUDE_HOME.json:/home/node/.claude.json" \
  -v "$WORK:/work" node:20-slim bash -lc '
    apt-get update -qq >/dev/null 2>&1 && \
      apt-get install -y -qq sudo curl git lsof procps >/dev/null 2>&1
    echo "node ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/node
    npm i -g @anthropic-ai/claude-code --loglevel=error >/dev/null 2>&1
    chown -R node:node /work 2>/dev/null || true
    su node -c "cd /work && export HOME=/home/node && \
      claude -p --dangerously-skip-permissions \
      \"Read ./SEED.md and execute it. This is an intent-spec seed: there is NO bundle — BUILD the product from the spec alone (do not look for any reference implementation). You are running headless with no human to interview: skip the Interview turn and proceed with the safe defaults (install uv and Node deps yourself per the seed, default \\\$TP_WORKSPACE, auto-generate CONTENT_API_KEY). Scaffold the backend + frontend + roteiro sender + sample per the seed, start both services, then AUTHOR and run the ## Verify Layer-1 acceptance harness from the seed's section 16. On the final line print exactly the seed result line, e.g. SEED_RESULT=DONE.\""
  '
