#!/usr/bin/env python3
"""
Progressive Disclosure & Cross-Harness AI Setup Auditor (macOS / Linux / Windows).

Validates:
- Tier 0 root AGENTS.md budget (<= 6 KB / <= 140 lines), clean UTF-8 (no mojibake), valid links
- Tier 1A subtree AGENTS.md budget (<= 4 KB / <= 100 lines)
- Tier 1B .cursor/rules/*.mdc YAML frontmatter and alwaysApply: false
- Tier 1C/2A .agents/skills/*/SKILL.md frontmatter (strict budget on custom skills; frontmatter-only on vendored/external)
- Valid JSON in .mcp.json, .cursor/mcp.json, opencode.json, skills.manifest.json
- LF-only line endings on scripts/*.sh (macOS/Linux safety)
"""

import json
import os
import re
import sys
from pathlib import Path

ROOT_MAX_BYTES = 6144
ROOT_MAX_LINES = 140
SUBDIR_MAX_BYTES = 4096
SUBDIR_MAX_LINES = 100
CUSTOM_SKILL_MAX_BYTES = 6656
CUSTOM_SKILL_MAX_LINES = 160
CUSTOM_DESC_MAX_CHARS = 380

MOJIBAKE_MARKERS = ("â”Œ", "â”€", "â†’", "ðŸ", "Â°", "â€”", "â€¢")
LINK_RE = re.compile(r"\[[^\]]+\]\(([^)]+)\)")

# Upstream/vendored skills that are intentionally large and not repo-authored
VENDORED_SKILLS = {
    "academic-paper",
    "academic-paper-reviewer",
    "academic-pipeline",
    "deep-research",
}


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def parse_frontmatter(text: str):
    if not text.startswith("---"):
        return None
    parts = text.split("---", 2)
    if len(parts) < 3:
        return None
    fm = {}
    current_key = None
    for line in parts[1].splitlines():
        if not line.strip() or line.strip().startswith("#"):
            continue
        if re.match(r"^[A-Za-z0-9_-]+\s*:", line):
            k, v = line.split(":", 1)
            current_key = k.strip()
            v = v.strip()
            if v in (">", ">-", "|", "|-"):
                fm[current_key] = ""
            else:
                fm[current_key] = v.strip('"').strip("'")
        elif current_key and line.startswith((" ", "\t")):
            fm[current_key] = (fm[current_key] + " " + line.strip()).strip()
    return fm


def check_links(md_path: Path, repo_root: Path, errors: list):
    text = read_text(md_path)
    for raw_target in LINK_RE.findall(text):
        target = raw_target.split("#", 1)[0].strip()
        if not target or target.startswith(("http://", "https://", "mailto:", "file:")):
            continue
        # Companion sibling links (../other-repo) are optional when standalone
        if target.startswith("../") and not (md_path.parent / target).resolve().is_relative_to(repo_root):
            continue
        resolved = (md_path.parent / target).resolve()
        if not resolved.exists():
            errors.append(f"Broken link in {md_path.relative_to(repo_root)}: {raw_target}")


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    errors = []
    warnings = []

    print(f"Auditing AI setup in: {repo_root.name}")

    # 1. Root AGENTS.md & CLAUDE.md
    root_agents = repo_root / "AGENTS.md"
    if not root_agents.exists():
        errors.append("Missing root AGENTS.md")
    else:
        raw = root_agents.read_bytes()
        text = raw.decode("utf-8")
        lines = text.splitlines()
        if len(raw) > ROOT_MAX_BYTES:
            errors.append(f"Root AGENTS.md is {len(raw)} bytes (limit: {ROOT_MAX_BYTES})")
        if len(lines) > ROOT_MAX_LINES:
            errors.append(f"Root AGENTS.md is {len(lines)} lines (limit: {ROOT_MAX_LINES})")
        for m in MOJIBAKE_MARKERS:
            if m in text:
                errors.append(f"UTF-8 mojibake '{m}' detected in root AGENTS.md")
                break
        check_links(root_agents, repo_root, errors)

    claude_md = repo_root / "CLAUDE.md"
    if not claude_md.exists():
        errors.append("Missing CLAUDE.md (@AGENTS.md shim)")
    elif "@AGENTS.md" not in read_text(claude_md):
        errors.append("CLAUDE.md does not import @AGENTS.md")

    # 2. Subdirectory AGENTS.md
    for sub in repo_root.rglob("AGENTS.md"):
        if sub == root_agents:
            continue
        rel = sub.relative_to(repo_root)
        if any(part in {"node_modules", ".git", "Library", "Temp", ".codegraph"} for part in rel.parts):
            continue
        raw = sub.read_bytes()
        text = raw.decode("utf-8")
        lines = text.splitlines()
        if len(raw) > SUBDIR_MAX_BYTES:
            errors.append(f"{rel} is {len(raw)} bytes (limit: {SUBDIR_MAX_BYTES})")
        if len(lines) > SUBDIR_MAX_LINES:
            errors.append(f"{rel} is {len(lines)} lines (limit: {SUBDIR_MAX_LINES})")
        check_links(sub, repo_root, errors)

    # 3. Cursor scoped rules (.cursor/rules/*.mdc)
    cursor_rules_dir = repo_root / ".cursor" / "rules"
    if cursor_rules_dir.exists():
        for mdc in sorted(cursor_rules_dir.glob("*.mdc")):
            fm = parse_frontmatter(read_text(mdc))
            rel = mdc.relative_to(repo_root)
            if not fm:
                errors.append(f"{rel}: missing YAML frontmatter")
                continue
            if fm.get("alwaysApply", "").lower() == "true":
                errors.append(f"{rel}: alwaysApply must be false (Cursor natively reads AGENTS.md)")
            if "globs" not in fm:
                errors.append(f"{rel}: missing globs: scope")

    # 4. JSON configs
    for json_rel in (".mcp.json", ".cursor/mcp.json", "opencode.json", "skills.manifest.json", "codegraph.json"):
        jp = repo_root / json_rel
        if jp.exists():
            try:
                json.loads(read_text(jp))
            except Exception as e:
                errors.append(f"Invalid JSON in {json_rel}: {e}")
        elif json_rel != "skills.manifest.json":
            errors.append(f"Missing required harness config: {json_rel}")

    # 5. Skills in .agents/skills/
    manifest_external = set()
    manifest_path = repo_root / "skills.manifest.json"
    if manifest_path.exists():
        try:
            mdata = json.loads(read_text(manifest_path))
            for entry in mdata.get("skills", []):
                for s in entry.get("skills", []):
                    manifest_external.add(s)
        except Exception:
            pass

    skills_dir = repo_root / ".agents" / "skills"
    if skills_dir.exists():
        for sdir in sorted(p for p in skills_dir.iterdir() if p.is_dir()):
            skill_md = sdir / "SKILL.md"
            if not skill_md.exists():
                errors.append(f"Skill folder missing SKILL.md: .agents/skills/{sdir.name}")
                continue
            raw = skill_md.read_bytes()
            text = raw.decode("utf-8")
            fm = parse_frontmatter(text)
            if not fm or not fm.get("name") or not fm.get("description"):
                errors.append(f".agents/skills/{sdir.name}/SKILL.md: missing name/description frontmatter")
                continue
            is_external = (sdir.name in VENDORED_SKILLS) or (sdir.name in manifest_external) or (
                not (sdir / ".custom").exists() and sdir.name not in {
                    "add-ha-device-consumer",
                    "webgl-build-and-sync",
                    "new-ha-device",
                    "release-and-deploy-addon",
                    "compile-and-verify-latex",
                    "sync-thesis-from-code",
                }
            )
            if not is_external:
                lines = text.splitlines()
                if len(raw) > CUSTOM_SKILL_MAX_BYTES:
                    errors.append(f"Custom skill {sdir.name}/SKILL.md is {len(raw)} bytes (limit: {CUSTOM_SKILL_MAX_BYTES})")
                if len(lines) > CUSTOM_SKILL_MAX_LINES:
                    errors.append(f"Custom skill {sdir.name}/SKILL.md is {len(lines)} lines (limit: {CUSTOM_SKILL_MAX_LINES})")
                if len(fm["description"]) > CUSTOM_DESC_MAX_CHARS:
                    warnings.append(f"Custom skill {sdir.name} description is {len(fm['description'])} chars (recommend <= {CUSTOM_DESC_MAX_CHARS})")

    # 6. Check LF line endings on scripts/*.sh (macOS / Linux parity)
    scripts_dir = repo_root / "scripts"
    if scripts_dir.exists():
        for sh in sorted(scripts_dir.glob("*.sh")):
            if b"\r\n" in sh.read_bytes():
                errors.append(f"CRLF detected in {sh.relative_to(repo_root)} (must be LF for macOS/Linux)")

    for w in warnings:
        print(f"  WARN: {w}")
    if errors:
        for e in errors:
            print(f"  FAIL: {e}")
        print(f"Audit FAILED with {len(errors)} error(s).")
        return 1

    print("Audit PASSED (Progressive Disclosure budgets, links, configs, skills, and LF checks clean).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
