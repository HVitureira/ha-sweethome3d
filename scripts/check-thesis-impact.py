#!/usr/bin/env python3
"""
Thesis Impact Detector for ha-sweethome3d (macOS / Linux / Windows).

Inspects git diffs against architectural hotspots that correspond to thesis
chapters, papers, diagrams, or code listings. Advisory only (always exits 0).
Silent when no hotspots changed or docs/ai/thesis-evolution-log.md was already updated.
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path

EVOLUTION_LOG = "docs/ai/thesis-evolution-log.md"

HOTSPOTS = [
    (
        r"^www-vue/src/(App\.vue|router/.*|stores/.*|composables/useFurnitureDialog\.ts|components/dialogs/FurnitureDialogEnhancer\.vue|views/UnityView\.vue)$",
        "Non-Invasive Vue 3 Authoring Overlay",
        "Chapters/3. Development.tex, Chapters/6. Discussion.tex, Paper-1-Authoring/Paper-1-Authoring.tex",
    ),
    (
        r"^sweethome3d/www/lib/(objExporter|unity-export-utils|obj-exporter-integration)\.js$",
        "SweetHome3D -> Unity Export Pipeline",
        "Chapters/3. Development.tex, Listings/lst-export-js.tex, Listings/lst-device-json.tex, Figures/diagrams/authoring-export-flow.puml",
    ),
    (
        r"^sweethome3d/www/(lib/LovelaceWs\.php|lib/registerIcon\.php|addDashboardCard\.php|listDashboards\.php|haApiProxy\.php)$",
        "Home Assistant Supervisor & Lovelace Integration",
        "Chapters/3. Development.tex, Chapters/6. Discussion.tex, Figures/diagrams/dashboard-integration-flow.puml",
    ),
    (
        r"^sweethome3d/(Dockerfile|config\.yaml|build\.yaml|rootfs/etc/(nginx|php82|cont-init\.d)/.*)$",
        "HA Add-on Packaging & Runtime Infrastructure",
        "Chapters/3. Development.tex, Figures/diagrams/addon-initialization.puml",
    ),
    (
        r"^sweethome3d/www/lib/resources/DefaultFurnitureCatalog\.json$",
        "Smart IoT Furniture Catalog",
        "Chapters/3. Development.tex",
    ),
    (
        r"^www-vue/(package\.json|vite\.config\.ts)$",
        "Frontend Toolchain & Dev Architecture",
        "Chapters/3. Development.tex, Paper-1-Authoring/Paper-1-Authoring.tex",
    ),
]


def git_diff_name_status(repo_root: Path, git_range: str | None) -> list[tuple[str, str]]:
    cmds = []
    if git_range:
        cmds.append(["git", "-C", str(repo_root), "diff", "--name-status", git_range])
    else:
        cmds.append(["git", "-C", str(repo_root), "diff", "--name-status", "HEAD"])
        cmds.append(["git", "-C", str(repo_root), "diff", "--cached", "--name-status"])
        try:
            branch = subprocess.check_output(
                ["git", "-C", str(repo_root), "rev-parse", "--abbrev-ref", "HEAD"],
                text=True,
                stderr=subprocess.DEVNULL,
            ).strip()
            if branch not in ("master", "main", "HEAD"):
                cmds.append(["git", "-C", str(repo_root), "diff", "--name-status", "master..HEAD"])
        except Exception:
            pass

    seen = {}
    for cmd in cmds:
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            continue
        for line in res.stdout.splitlines():
            parts = line.split("\t")
            if len(parts) >= 2:
                status, path = parts[0], parts[-1].replace("\\", "/")
                seen[path] = status
    return sorted(seen.items())


def detect_hits(changes: list[tuple[str, str]]) -> tuple[bool, list[tuple[str, str, str, str]]]:
    log_updated = any(p == EVOLUTION_LOG for p, _ in changes)
    hits = []
    for path, status in changes:
        matched = False
        for pattern, bucket, target in HOTSPOTS:
            if re.match(pattern, path):
                hits.append((path, status, bucket, target))
                matched = True
                break
        if not matched and status in ("A", "D") and re.match(r"^(sweethome3d/www/.*\.php|www-vue/src/(views|stores)/.*\.(vue|ts))$", path):
            hits.append((
                path,
                status,
                "Added/Removed PHP Endpoint or Vue View/Store",
                "Chapters/3. Development.tex, Chapters/6. Discussion.tex",
            ))
    return log_updated, hits


def main() -> int:
    parser = argparse.ArgumentParser(description="Detect thesis-worthy architectural changes (advisory).")
    parser.add_argument("--range", dest="git_range", default=None, help="Git diff range (e.g., master..HEAD)")
    parser.add_argument("--markdown", action="store_true", help="Output GitHub PR comment Markdown")
    parser.add_argument("--verbose", action="store_true", help="Print status even when no impact is detected")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    changes = git_diff_name_status(repo_root, args.git_range)
    log_updated, hits = detect_hits(changes)

    if not hits or log_updated:
        if args.verbose:
            if not hits:
                print("Thesis impact check: no architectural hotspots touched.")
            else:
                print(f"Thesis impact check: {len(hits)} hotspot(s) touched and {EVOLUTION_LOG} updated.")
        return 0

    if args.markdown:
        print("<!-- thesis-impact-bot -->")
        print("### Thesis Evolution Check (`ha-sweethome3d`)")
        print("")
        print("This PR modifies architectural hotspot files that may warrant a mention, trade-off note, or diagram/listing update in `smart-home-thesis-intro`:")
        print("")
        print("| File | Change | Architectural Area | Suggested Thesis Target |")
        print("| :--- | :---: | :--- | :--- |")
        for path, status, bucket, target in hits:
            print(f"| `{path}` | `{status}` | {bucket} | {target} |")
        print("")
        print(f"If this represents an architectural evolution or design choice (not a routine bugfix), append a short entry to `{EVOLUTION_LOG}` so `smart-home-thesis-intro/scripts/check-code-sync.py` surfaces it automatically.")
    else:
        print("\n[Thesis Impact Advisory] Architectural hotspot(s) modified without updating docs/ai/thesis-evolution-log.md:")
        for path, status, bucket, target in hits:
            print(f"  - [{status}] {path} ({bucket}) -> {target}")
        print(f"  If this is a thesis-worthy evolution/decision (not a minor fix), log a 6-line entry in {EVOLUTION_LOG}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
