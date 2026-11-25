#!/usr/bin/env python3
"""
Cross-platform public Agent Skills installer (macOS / Linux / Windows).

Reads skills.manifest.json and installs pinned skills into .agents/skills/.
Uses `npx -y skills add` when Node >= 22.20 is available; otherwise falls back
cleanly to shallow `git clone --depth 1` from GitHub and extracts matching
skill folders containing SKILL.md.
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def node_supports_skills_cli() -> bool:
    if not shutil.which("node") or not shutil.which("npx"):
        return False
    try:
        out = subprocess.check_output(["node", "-v"], text=True).strip().lstrip("v")
        major, minor = (int(x) for x in out.split(".")[:2])
        return (major, minor) >= (22, 20)
    except Exception:
        return False


def find_skill_dirs(clone_root: Path) -> dict:
    """Map skill name (frontmatter name or directory name) -> directory Path."""
    found = {}
    for skill_md in clone_root.rglob("SKILL.md"):
        if ".git" in skill_md.parts:
            continue
        sdir = skill_md.parent
        name = sdir.name
        try:
            text = skill_md.read_text(encoding="utf-8", errors="replace")
            if text.startswith("---"):
                fm = text.split("---", 2)[1]
                m = re.search(r"^\s*name\s*:\s*['\"]?([A-Za-z0-9._-]+)['\"]?", fm, re.MULTILINE)
                if m:
                    name = m.group(1)
        except Exception:
            pass
        found[name] = sdir
        found[sdir.name] = sdir
    return found


def install_via_git(source: str, wanted: list, dest_root: Path, optional: bool) -> int:
    url = source if source.startswith(("http://", "https://", "git@")) else f"https://github.com/{source}.git"
    tmp = Path(tempfile.mkdtemp(prefix="ai-skills-"))
    try:
        res = subprocess.run(
            ["git", "clone", "--depth", "1", "--quiet", url, str(tmp / "repo")],
            capture_output=True,
            text=True,
        )
        if res.returncode != 0:
            tag = "WARN (optional)" if optional else "WARN"
            print(f"    {tag}: git clone failed for {source}: {res.stderr.strip()}")
            return 0 if optional else 1

        available = find_skill_dirs(tmp / "repo")
        targets = wanted if wanted else sorted({p.name: p for p in available.values()}.keys())
        installed = 0
        for name in targets:
            src_dir = available.get(name)
            if not src_dir:
                print(f"    WARN: skill '{name}' not found in {source}")
                continue
            dst_dir = dest_root / name
            if dst_dir.exists():
                shutil.rmtree(dst_dir)
            shutil.copytree(src_dir, dst_dir)
            print(f"    Installed skill '{name}' <- {source}")
            installed += 1
        if installed == 0 and not optional:
            return 1
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main() -> int:
    repo_root = Path(__file__).resolve().parent.parent
    manifest_path = repo_root / "skills.manifest.json"
    if not manifest_path.exists():
        return 0

    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    dest_root = repo_root / ".agents" / "skills"
    dest_root.mkdir(parents=True, exist_ok=True)
    use_npx = node_supports_skills_cli()

    for entry in data.get("skills", []):
        source = entry["source"]
        wanted = entry.get("skills", [])
        optional = entry.get("optional", False)

        if use_npx:
            cmd = ["npx", "-y", "skills", "add", source, "-y"]
            for s in wanted:
                cmd.extend(["--skill", s])
            print("    Running:", " ".join(cmd))
            res = subprocess.run(cmd, cwd=repo_root)
            if res.returncode == 0:
                continue
            print(f"    INFO: npx skills failed for {source}; falling back to git clone...")

        install_via_git(source, wanted, dest_root, optional)

    return 0


if __name__ == "__main__":
    sys.exit(main())
