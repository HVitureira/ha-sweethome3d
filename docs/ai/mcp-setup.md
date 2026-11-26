# MCP Setup Guide (CodeGraph MCP)

This repository uses **CodeGraph MCP (`@colbymchenry/codegraph`)** for fast, local AST symbol search across `www-vue/src/`, PHP endpoints, and custom SweetHome3D export scripts on **macOS and Windows**.

## 1. Automated Setup

```bash
# macOS / Linux
./scripts/ai-setup.sh
```

```powershell
# Windows (PowerShell)
.\scripts\ai-setup.ps1
```

## 2. Harness Configuration Map

| Harness | Config File | Status |
| :--- | :--- | :--- |
| **Claude Code** | `.mcp.json` | Committed in repo root |
| **Cursor** | `.cursor/mcp.json` | Committed in repo |
| **OpenCode** | `opencode.json` (`mcp.codegraph`) | Committed in repo root |
| **Antigravity** | `~/.gemini/antigravity/mcp_config.json` *(or `~/.gemini/config/mcp_config.json`)* | Merged automatically by `ai-setup` |

### Manual Antigravity Snippet

```json
{
  "mcpServers": {
    "codegraph": {
      "command": "codegraph",
      "args": ["serve", "--mcp"]
    }
  }
}
```

## 3. Noise Control & Sync

- [codegraph.json](../../codegraph.json) excludes `sweethome3d.min.js` (2.5 MB), other minified vendor libs, `node_modules/`, `www/assets/`, `unity-build/`, `www/unity-visualizer/`, and `test-data/`.
- Run `codegraph sync` (or `codegraph status`) after branch switches or major refactors.
