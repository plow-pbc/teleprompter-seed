#!/usr/bin/env bash
# Hydrate + verify the Teleprompter seed as a cold stranger, in a throwaway node:20-slim.
# Requires: Docker, and a `claude` CLI authenticated on the host (creds at ~/.claude).
# Usage:  ./verify/hydrate-and-verify.sh
# Result: a fresh blind agent installs the bundled app from ../SEED.md (+ ../teleprompter/),
#         runs the seed's own ## Verify (Layer 1 acceptance harness), and prints the seed's
#         final line. A pass ends with SEED_RESULT=DONE.
#
# Note: this runs the Layer-1 (exit-code) acceptance proof headless. The seed's Layer-2
# real-browser observation is an interactive/agent-with-eyes step — run that on a host with a
# browser, or watch the recorded full install (see the project's seedrec recording).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SEED="$ROOT/SEED.md"
BUNDLE="$ROOT/teleprompter"
[ -f "$SEED" ] || { echo "missing SEED.md at repo root" >&2; exit 1; }
[ -f "$BUNDLE/backend/api/main.py" ] || { echo "missing teleprompter/ bundle at repo root" >&2; exit 1; }

WORK="$(mktemp -d)"
cp "$SEED" "$WORK/SEED.md"
# the seed expects its bundle at <seed-dir>/teleprompter/ — exclude generated/secret artifacts
rsync -a --exclude '.venv' --exclude 'node_modules' --exclude 'dist' \
  --exclude '__pycache__' --exclude '*.pyc' --exclude '.env' --exclude '.env.*' \
  "$BUNDLE/" "$WORK/teleprompter/"

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
      \"Read ./SEED.md and execute it. The bundle is at ./teleprompter/. You are running headless with no human to interview: skip the Interview turn and proceed with the safe defaults (install uv yourself per the seed, default \\\$TP_WORKSPACE, auto-generate CONTENT_API_KEY). Run every Step then the ## Verify Layer-1 acceptance harness. On the final line print exactly the seed result line, e.g. SEED_RESULT=DONE.\""
  '
