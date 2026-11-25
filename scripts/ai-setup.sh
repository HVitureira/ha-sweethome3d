#!/usr/bin/env bash
# Cross-platform AI agent bootstrap (macOS Bash 3.2+ and Linux)
# Installs pinned skills, bridges .agents/skills -> .claude/skills,
# installs & indexes CodeGraph MCP, and wires Antigravity mcp_config.json.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SKIP_SKILLS=0
SKIP_CODEGRAPH=0
SKIP_ANTIGRAVITY=0
REINDEX_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --skip-skills) SKIP_SKILLS=1 ;;
    --skip-codegraph) SKIP_CODEGRAPH=1 ;;
    --no-antigravity-mcp) SKIP_ANTIGRAVITY=1 ;;
    --reindex) REINDEX_ONLY=1 ;;
    -h|--help)
      echo "Usage: ./scripts/ai-setup.sh [--skip-skills] [--skip-codegraph] [--no-antigravity-mcp] [--reindex]"
      exit 0
      ;;
  esac
done

PYTHON_BIN=""
if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
fi

echo "==> AI Agent Bootstrap: $(basename "$REPO_ROOT")"

if [ "$REINDEX_ONLY" -eq 1 ]; then
  if command -v codegraph >/dev/null 2>&1; then
    (cd "$REPO_ROOT" && (codegraph sync || codegraph init -y --local-only))
  else
    echo "codegraph not found. Run without --reindex first."
    exit 1
  fi
  exit 0
fi

# 1. Install pinned public skills from skills.manifest.json (if present)
MANIFEST="$REPO_ROOT/skills.manifest.json"
if [ "$SKIP_SKILLS" -eq 0 ] && [ -f "$MANIFEST" ] && [ -n "$PYTHON_BIN" ] && [ -f "$SCRIPT_DIR/install-skills.py" ]; then
  echo "--> Installing pinned public skills from skills.manifest.json..."
  "$PYTHON_BIN" "$SCRIPT_DIR/install-skills.py"
fi

# 2. Bridge .agents/skills/* -> .claude/skills/* using relative symlinks (Claude Code)
if [ -d "$REPO_ROOT/.agents/skills" ]; then
  echo "--> Linking .agents/skills/* -> .claude/skills/* for Claude Code..."
  mkdir -p "$REPO_ROOT/.claude/skills"
  for skill_dir in "$REPO_ROOT/.agents/skills"/*; do
    [ -d "$skill_dir" ] || continue
    skill_name="$(basename "$skill_dir")"
    ln -sfn "../../.agents/skills/$skill_name" "$REPO_ROOT/.claude/skills/$skill_name"
  done
fi

# 3. Install & initialize CodeGraph MCP
if [ "$SKIP_CODEGRAPH" -eq 0 ]; then
  if ! command -v codegraph >/dev/null 2>&1; then
    if command -v npm >/dev/null 2>&1; then
      echo "--> Installing @colbymchenry/codegraph globally..."
      npm install -g @colbymchenry/codegraph || echo "WARN: global npm install failed; install manually with 'npm i -g @colbymchenry/codegraph'"
    else
      echo "WARN: npm not found; install CodeGraph manually: curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh"
    fi
  fi

  if command -v codegraph >/dev/null 2>&1; then
    echo "--> Indexing repository with CodeGraph..."
    if [ -d "$REPO_ROOT/.codegraph" ]; then
      (cd "$REPO_ROOT" && codegraph sync) || (cd "$REPO_ROOT" && codegraph init -y --local-only) || true
    else
      (cd "$REPO_ROOT" && codegraph init -y --local-only) || true
    fi
  fi
fi

# 4. Non-destructively wire Antigravity global mcp_config.json
if [ "$SKIP_ANTIGRAVITY" -eq 0 ] && [ -n "$PYTHON_BIN" ]; then
  echo "--> Checking Antigravity MCP config for codegraph..."
  "$PYTHON_BIN" - <<'PY'
import json, os, shutil
home = os.path.expanduser("~")
candidates = [
    os.path.join(home, ".gemini", "antigravity", "mcp_config.json"),
    os.path.join(home, ".gemini", "config", "mcp_config.json"),
]
target = next((p for p in candidates if os.path.exists(p)), candidates[0])
os.makedirs(os.path.dirname(target), exist_ok=True)
cfg = {}
if os.path.exists(target):
    try:
        with open(target, "r", encoding="utf-8") as f:
            cfg = json.load(f)
    except Exception as e:
        print(f"    WARN: could not parse {target}: {e}")
        raise SystemExit(0)
servers = cfg.setdefault("mcpServers", {})
if "codegraph" not in servers:
    if os.path.exists(target):
        shutil.copy2(target, target + ".bak")
    servers["codegraph"] = {"command": "codegraph", "args": ["serve", "--mcp"]}
    with open(target, "w", encoding="utf-8", newline="\n") as f:
        json.dump(cfg, f, indent=2)
        f.write("\n")
    print(f"    Added codegraph MCP server to {target} (backup saved)")
else:
    print(f"    codegraph already configured in {target}")
PY
fi

# 5. Run Progressive Disclosure & cross-harness audit
if [ -n "$PYTHON_BIN" ] && [ -f "$SCRIPT_DIR/check-ai-setup.py" ]; then
  echo "--> Running check-ai-setup.py..."
  "$PYTHON_BIN" "$SCRIPT_DIR/check-ai-setup.py"
fi

echo "==> Done! Open this repo in Antigravity, Claude Code, Cursor, or OpenCode."
