"""Send roteiros (recording scripts) to the teleprompter one piece at a time.

Usage:
    python3 scripts/send_roteiros.py [path/to/roteiro.md]

Defaults to the bundled sample-roteiro.md next to this repo's root.

Parses the banco-de-gravacao markdown format (# ANUNCIO / ## HOOKS|BODIES|CTAs /
### 1.H1 with > quoted text), sends each piece to the teleprompter API and
waits for ENTER to advance to the next one. Follows the suggested recording
order: all hooks first, then all bodies, then all CTAs.

Configuration (resolution order):
- TELEPROMPTER_API_URL env var (default: http://localhost:9000/api/content)
- CONTENT_API_KEY env var; if unset, read from <repo-root>/backend/.env

Stdlib only — no third-party dependencies.
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

API_URL = os.environ.get("TELEPROMPTER_API_URL", "http://localhost:9000/api/content")


def resolve_api_key() -> str:
    """Resolve the content API key: env var first, then backend/.env."""
    key = os.environ.get("CONTENT_API_KEY", "").strip()
    if key:
        return key

    env_path = REPO_ROOT / "backend" / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("CONTENT_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
                if key:
                    return key

    print("❌ CONTENT_API_KEY not found.")
    print("   Set the CONTENT_API_KEY env var, or ensure it is present in")
    print(f"   {env_path}")
    sys.exit(1)


API_KEY = resolve_api_key()


def parse_roteiros(markdown: str) -> list[dict[str, str]]:
    """Parse the banco-gravacao markdown into individual pieces.

    Returns a list of dicts with keys: id, type, ad_num, ad_name, subtitle, text
    """
    pieces: list[dict[str, str]] = []
    current_ad_num = ""
    current_ad_name = ""
    current_type = ""

    lines = markdown.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]

        # Match ad header: # ANUNCIO 1 — "O LEILAO" (Angulo: ...)
        ad_match = re.match(
            r"^# ANUNCIO (\d+) — \"(.+?)\"", line
        )
        if ad_match:
            current_ad_num = ad_match.group(1)
            current_ad_name = ad_match.group(2)
            i += 1
            continue

        # Match section header: ## HOOKS — Anuncio 1 (10 variacoes)
        section_match = re.match(r"^## (HOOKS|BODIES|CTAs) —", line)
        if section_match:
            current_type = section_match.group(1)
            i += 1
            continue

        # Match piece header: ### 1.H1 or ### 1.B1 — Explicacao Direta
        piece_match = re.match(r"^### (\d+\.\w+)", line)
        if piece_match:
            piece_id = piece_match.group(1)
            # Optional subtitle after " — "
            subtitle = ""
            subtitle_match = re.match(r"^### \d+\.\w+ — (.+)", line)
            if subtitle_match:
                subtitle = f" ({subtitle_match.group(1)})"

            # Collect the text content (lines starting with >)
            text_lines: list[str] = []
            i += 1
            while i < len(lines):
                stripped = lines[i].strip()
                if stripped.startswith(">"):
                    # Remove the > prefix and clean up
                    content = stripped.lstrip("> ").strip()
                    if content:
                        text_lines.append(content)
                    else:
                        # Empty > line = paragraph break
                        text_lines.append("")
                elif stripped.startswith("###") or stripped.startswith("##") or stripped.startswith("# "):
                    break
                elif stripped == "---":
                    i += 1
                    continue
                else:
                    if text_lines and stripped:
                        # Non-quote content after we started collecting
                        break
                    i += 1
                    continue
                i += 1

            text = "\n".join(text_lines).strip()
            if text:
                pieces.append({
                    "id": piece_id,
                    "type": current_type,
                    "ad_num": current_ad_num,
                    "ad_name": current_ad_name,
                    "subtitle": subtitle,
                    "text": text,
                })
            continue

        i += 1

    return pieces


def piece_sort_key(piece: dict[str, str]) -> tuple[int, int, int]:
    """Extract numeric sort key from piece ID like '1.H3' -> (type, ad_num, piece_num)."""
    type_order = {"HOOKS": 0, "BODIES": 1, "CTAs": 2}
    # Extract number from ID like "1.H3" -> 3, "2.B1" -> 1, "3.CTA10" -> 10
    num_match = re.search(r"\d+$", piece["id"])
    piece_num = int(num_match.group()) if num_match else 0
    return (type_order.get(piece["type"], 99), int(piece["ad_num"]), piece_num)


def order_for_recording(pieces: list[dict[str, str]]) -> list[dict[str, str]]:
    """Order pieces for recording: all hooks, then all bodies, then all CTAs."""
    return sorted(pieces, key=piece_sort_key)


def send_to_teleprompter(content: str) -> bool:
    """Send content to the teleprompter API. Stdlib only."""
    payload = json.dumps({"content": content}).encode("utf-8")
    request = urllib.request.Request(
        API_URL,
        data=payload,
        headers={"X-API-Key": API_KEY, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=5.0) as response:
            return 200 <= response.status < 300
    except (urllib.error.URLError, urllib.error.HTTPError, OSError) as exc:
        print(f"  ⚠️  {exc}")
        return False


def format_piece_header(piece: dict[str, str], index: int, total: int) -> str:
    """Format a display header for the terminal."""
    type_emoji = {"HOOKS": "🎣", "BODIES": "📝", "CTAs": "📢"}.get(piece["type"], "")
    return (
        f"\n{'=' * 60}\n"
        f"  [{index + 1}/{total}] {type_emoji} {piece['type']} — "
        f"Anúncio {piece['ad_num']}: {piece['ad_name']}\n"
        f"  ID: {piece['id']}{piece['subtitle']}\n"
        f"{'=' * 60}"
    )


def main() -> None:
    if len(sys.argv) > 1:
        md_path = Path(sys.argv[1]).expanduser()
    else:
        md_path = REPO_ROOT / "sample-roteiro.md"

    if not md_path.exists():
        print(f"Arquivo não encontrado: {md_path}")
        sys.exit(1)

    markdown = md_path.read_text(encoding="utf-8")
    pieces = parse_roteiros(markdown)
    ordered = order_for_recording(pieces)

    if not ordered:
        print("❌ Nenhuma peça encontrada no roteiro. Confira o formato banco-de-gravação.")
        sys.exit(1)

    print(f"\n🎬 Banco de Gravação — {md_path.name}")
    print(f"   Total de peças: {len(ordered)}")
    print(f"   Hooks: {sum(1 for p in ordered if p['type'] == 'HOOKS')}")
    print(f"   Bodies: {sum(1 for p in ordered if p['type'] == 'BODIES')}")
    print(f"   CTAs: {sum(1 for p in ordered if p['type'] == 'CTAs')}")
    print("\n   Pressione ENTER para avançar, 'q' para sair, número para pular.\n")

    i = 0
    while i < len(ordered):
        piece = ordered[i]
        header = format_piece_header(piece, i, len(ordered))
        print(header)
        print(f"\n  {piece['text'][:100]}{'...' if len(piece['text']) > 100 else ''}\n")

        # Send to teleprompter
        if send_to_teleprompter(piece["text"]):
            print("  ✅ Enviado ao teleprompter")
        else:
            print("  ❌ Erro ao enviar ao teleprompter")

        try:
            user_input = input("  [ENTER=próximo | q=sair | número=pular] > ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\n\n👋 Saindo...")
            sys.exit(0)

        if user_input.lower() == "q":
            print("\n👋 Saindo...")
            break
        elif user_input.isdigit():
            target = int(user_input) - 1
            if 0 <= target < len(ordered):
                i = target
            else:
                print(f"  ⚠️  Número inválido. Use 1-{len(ordered)}")
        else:
            i += 1

    print("\n🎬 Gravação finalizada!")


if __name__ == "__main__":
    main()
