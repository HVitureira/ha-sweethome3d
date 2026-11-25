<#
.SYNOPSIS
  Cross-harness AI agent bootstrap for Windows (PowerShell 5.1+ / 7+).
.DESCRIPTION
  Installs pinned public skills from skills.manifest.json, links .agents/skills/*
  to .claude/skills/* via admin-free NTFS Junctions, installs & indexes CodeGraph MCP,
  wires Antigravity mcp_config.json, and runs check-ai-setup.py.
#>
param(
    [switch]$SkipSkills,
    [switch]$SkipCodeGraph,
    [switch]$NoAntigravityMcp,
    [switch]$Reindex
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Split-Path -Parent $ScriptDir

Write-Host "==> AI Agent Bootstrap: $(Split-Path -Leaf $RepoRoot)" -ForegroundColor Cyan

if ($Reindex) {
    if (Get-Command codegraph -ErrorAction SilentlyContinue) {
        Push-Location $RepoRoot
        try {
            codegraph sync
            if ($LASTEXITCODE -ne 0) { codegraph init -y --local-only }
        } finally { Pop-Location }
        exit 0
    } else {
        Write-Error "codegraph not found. Run .\scripts\ai-setup.ps1 first."
        exit 1
    }
}

$PythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $PythonCmd) { $PythonCmd = Get-Command python3 -ErrorAction SilentlyContinue }

# 1. Install pinned public skills from skills.manifest.json
$Manifest = Join-Path $RepoRoot "skills.manifest.json"
$Installer = Join-Path $ScriptDir "install-skills.py"
if (-not $SkipSkills -and (Test-Path $Manifest) -and $PythonCmd -and (Test-Path $Installer)) {
    Write-Host "--> Installing pinned public skills from skills.manifest.json..." -ForegroundColor Green
    & $PythonCmd.Source $Installer
}

# 2. Bridge .agents/skills/* -> .claude/skills/* via NTFS Directory Junctions (no Admin required)
$AgentsSkills = Join-Path $RepoRoot ".agents\skills"
$ClaudeSkills = Join-Path $RepoRoot ".claude\skills"
if (Test-Path $AgentsSkills) {
    Write-Host "--> Bridging .agents/skills/* -> .claude/skills/* via NTFS Junctions..." -ForegroundColor Green
    New-Item -ItemType Directory -Path $ClaudeSkills -Force | Out-Null
    Get-ChildItem -Path $AgentsSkills -Directory | ForEach-Object {
        $target = $_.FullName
        $link = Join-Path $ClaudeSkills $_.Name
        if (Test-Path $link) {
            $item = Get-Item $link -Force
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
                [IO.Directory]::Delete($link)
            } else {
                Remove-Item $link -Recurse -Force
            }
        }
        try {
            New-Item -ItemType Junction -Path $link -Target $target -ErrorAction Stop | Out-Null
        } catch {
            Copy-Item -Path $target -Destination $link -Recurse -Force
        }
    }
}

# 3. Install & initialize CodeGraph MCP
if (-not $SkipCodeGraph) {
    if (-not (Get-Command codegraph -ErrorAction SilentlyContinue)) {
        if (Get-Command npm -ErrorAction SilentlyContinue) {
            Write-Host "--> Installing @colbymchenry/codegraph globally..." -ForegroundColor Green
            npm install -g @colbymchenry/codegraph
        } else {
            Write-Warning "npm not found; install CodeGraph manually: irm https://github.com/colbymchenry/codegraph/releases/latest/download/install.ps1 | iex"
        }
    }

    if (Get-Command codegraph -ErrorAction SilentlyContinue) {
        Write-Host "--> Indexing repository with CodeGraph..." -ForegroundColor Green
        Push-Location $RepoRoot
        try {
            if (Test-Path (Join-Path $RepoRoot ".codegraph")) {
                codegraph sync
                if ($LASTEXITCODE -ne 0) { codegraph init -y --local-only }
            } else {
                codegraph init -y --local-only
            }
        } finally { Pop-Location }
    }
}

# 4. Non-destructively wire Antigravity global mcp_config.json (PS 5.1 + PS 7 safe)
if (-not $NoAntigravityMcp) {
    Write-Host "--> Checking Antigravity MCP config for codegraph..." -ForegroundColor Green
    $candidates = @(
        (Join-Path $env:USERPROFILE ".gemini\antigravity\mcp_config.json"),
        (Join-Path $env:USERPROFILE ".gemini\config\mcp_config.json")
    )
    $target = $candidates[0]
    foreach ($c in $candidates) {
        if (Test-Path $c) { $target = $c; break }
    }
    try {
        if ($PythonCmd) {
            & $PythonCmd.Source -c "
import json, os, shutil, sys
target = sys.argv[1]
os.makedirs(os.path.dirname(target), exist_ok=True)
cfg = {}
if os.path.exists(target):
    with open(target, 'r', encoding='utf-8') as f:
        cfg = json.load(f)
servers = cfg.setdefault('mcpServers', {})
if 'codegraph' not in servers:
    if os.path.exists(target):
        shutil.copy2(target, target + '.bak')
    servers['codegraph'] = {'command': 'codegraph', 'args': ['serve', '--mcp']}
    with open(target, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(cfg, f, indent=2)
        f.write('\n')
    print(f'    Added codegraph MCP server to {target} (backup saved)')
else:
    print(f'    codegraph already configured in {target}')
" $target
        } else {
            Write-Warning "Python not found; add codegraph to $target manually (see docs/ai/mcp-setup.md)."
        }
    } catch {
        Write-Warning "Could not update $target automatically ($_). See docs/ai/mcp-setup.md for manual snippet."
    }
}

# 4b. Install advisory Git pre-push hook for thesis-impact checks (preserves existing hooks like Git LFS)
$GitHooksDir = Join-Path $RepoRoot ".git\hooks"
$ImpactScript = Join-Path $ScriptDir "check-thesis-impact.py"
if ((Test-Path $GitHooksDir) -and (Test-Path $ImpactScript)) {
    $HookFile = Join-Path $GitHooksDir "pre-push"
    $Existing = if (Test-Path $HookFile) { Get-Content $HookFile -Raw } else { "#!/bin/sh`n" }
    if ($Existing -notmatch "# thesis-impact-hook") {
        $Snippet = @"

# thesis-impact-hook (advisory only - never blocks push)
_TI_PY=""
for _cand in python3 python; do
  if "`$_cand" -c "import sys" >/dev/null 2>&1; then
    _TI_PY="`$_cand"
    break
  fi
done
if [ -n "`$_TI_PY" ] && [ -f "scripts/check-thesis-impact.py" ]; then
  "`$_TI_PY" scripts/check-thesis-impact.py || true
fi
"@
        $NewContent = ($Existing.TrimEnd("`r","`n") + "`n" + $Snippet.Replace("`r`n","`n") + "`n")
        [IO.File]::WriteAllText($HookFile, $NewContent, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "    Installed advisory thesis-impact pre-push hook"
    }
}

# 5. Run Progressive Disclosure & cross-harness audit
$AuditScript = Join-Path $ScriptDir "check-ai-setup.py"
if ($PythonCmd -and (Test-Path $AuditScript)) {
    Write-Host "--> Running check-ai-setup.py..." -ForegroundColor Green
    & $PythonCmd.Source $AuditScript
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "==> Done! Open this repo in Antigravity, Claude Code, Cursor, or OpenCode." -ForegroundColor Cyan
