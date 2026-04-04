# Repository Setup Guide

This document describes how `ha-sweethome3d` and `smart-home-visualizer` should be configured as repositories, and how to manage the Unity WebGL build artifact that bridges them.

---

## Current State

| Repo | Stack | Role |
|---|---|---|
| `ha-sweethome3d` | Node / Vue 3 / PHP / Docker | HA add-on: floor plan editor + web frontend |
| `smart-home-visualizer` | Unity (C#, URP) | 3D real-time visualizer, builds to WebGL |

They are independent repos. The integration point is the Unity **WebGL build output** — a folder of static files that `ha-sweethome3d` serves at `/unity-visualizer/` inside the Docker image.

---

## Recommended Setup: Separate Repos + Build Artifact via CI

Keep the repos separate (Unity and web are very different toolchains with different contributors and release cadences) but automate the handoff using CI/CD.

### Why not a monorepo?

- Unity projects contain large binary assets (`.meta`, scenes, prefabs, Library cache). These don't belong in a web repo.
- The Unity build takes 10–30 minutes and requires a specific Unity editor version — it should be a separate CI job.
- HA add-on reviewers and web contributors should not need Unity installed.

### Why not a git submodule?

- Unity source is too large to include as a submodule (4.7 GB total, 2.1 GB Library cache).
- We only need the _build output_ (~20–50 MB), not the full Unity project.
- Build artifacts should not live in version control.

---

## Recommended CI/CD Flow

```
smart-home-visualizer (Unity repo)
  │
  │  On push to main / release tag:
  ├── GitHub Actions: Unity WebGL Build (using game-ci/unity-builder)
  ├── Compress output to unity-webgl-build.zip
  └── Upload as GitHub Release Asset  ──────────────────────────────┐
                                                                     │
ha-sweethome3d (web repo)                                            │
  │                                                                  │
  │  On push to main / release tag:                                  │
  ├── GitHub Actions: Download latest unity-webgl-build.zip  ◄───────┘
  ├── Unzip to unity-build/
  ├── npm run build (Vue)
  └── docker build → push to ghcr.io / HA add-on store
```

### smart-home-visualizer: Unity Build Workflow

Create `.github/workflows/build-webgl.yml`:

```yaml
name: Build WebGL

on:
  push:
    branches: [main]
    tags: ['v*']
  workflow_dispatch:

jobs:
  build:
    name: Unity WebGL Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          lfs: true

      - name: Cache Unity Library
        uses: actions/cache@v4
        with:
          path: Library
          key: Library-WebGL-${{ hashFiles('Assets/**', 'Packages/**', 'ProjectSettings/**') }}
          restore-keys: Library-

      - name: Build WebGL
        uses: game-ci/unity-builder@v4
        env:
          UNITY_LICENSE: ${{ secrets.UNITY_LICENSE }}
          UNITY_EMAIL: ${{ secrets.UNITY_EMAIL }}
          UNITY_PASSWORD: ${{ secrets.UNITY_PASSWORD }}
        with:
          targetPlatform: WebGL
          buildName: SmartHomeVisualizer
          buildsPath: build

      - name: Package build output
        run: |
          cd build/WebGL/SmartHomeVisualizer
          zip -r ../../../unity-webgl-build.zip .

      - name: Upload Release Asset
        uses: softprops/action-gh-release@v2
        if: startsWith(github.ref, 'refs/tags/')
        with:
          files: unity-webgl-build.zip

      - name: Upload Artifact (for non-release builds)
        uses: actions/upload-artifact@v4
        with:
          name: unity-webgl-build
          path: unity-webgl-build.zip
          retention-days: 14
```

**Required GitHub secrets**: `UNITY_LICENSE`, `UNITY_EMAIL`, `UNITY_PASSWORD`
See [game-ci documentation](https://game.ci/docs/github/activation) for Unity license activation.

---

### ha-sweethome3d: Download & Build Workflow

Create `.github/workflows/build-addon.yml`:

```yaml
name: Build Add-on

on:
  push:
    branches: [main]
    tags: ['v*']
  workflow_dispatch:
    inputs:
      unity_build_source:
        description: 'Source for Unity build (latest_release | artifact | local)'
        default: 'latest_release'

jobs:
  build:
    name: Build Docker Image
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download Unity WebGL build (latest release)
        run: |
          # Download latest release asset from smart-home-visualizer
          RELEASE_URL=$(curl -s \
            https://api.github.com/repos/YOUR_ORG/smart-home-visualizer/releases/latest \
            | jq -r '.assets[] | select(.name == "unity-webgl-build.zip") | .browser_download_url')

          echo "Downloading from: $RELEASE_URL"
          curl -L "$RELEASE_URL" -o unity-webgl-build.zip
          mkdir -p unity-build
          unzip unity-webgl-build.zip -d unity-build/

      - name: Build Docker image
        run: |
          docker build \
            -f sweethome3d/Dockerfile \
            -t ghcr.io/YOUR_ORG/ha-sweethome3d:${{ github.sha }} \
            .

      - name: Push to registry
        if: startsWith(github.ref, 'refs/tags/')
        run: |
          docker push ghcr.io/YOUR_ORG/ha-sweethome3d:${{ github.sha }}
```

Replace `YOUR_ORG` with your GitHub username/org.

---

## Local Development Setup

When working locally (without CI), you need to place the Unity build manually:

### Option A: Build Unity yourself

1. Open `smart-home-visualizer/` in Unity Editor (2022.3 LTS or later)
2. File → Build Settings → Select **WebGL** → Switch Platform
3. Player Settings → set **Compression Format** to **Brotli**
4. Click **Build** → select output folder as `ha-sweethome3d/unity-build/`
5. Run `cd www-vue && npm run dev` — Unity is served at `/unity-visualizer/`

### Option B: Download from GitHub releases

```bash
# From ha-sweethome3d/ root:
mkdir -p unity-build
curl -L https://github.com/YOUR_ORG/smart-home-visualizer/releases/latest/download/unity-webgl-build.zip \
  -o /tmp/unity-webgl-build.zip
unzip /tmp/unity-webgl-build.zip -d unity-build/
```

### Option C: Copy from a colleague's build

```bash
# From ha-sweethome3d/ root:
cp -r /path/to/colleague/unity-build-output/* unity-build/
```

---

## .gitignore Recommendations

### ha-sweethome3d

Add to `.gitignore`:
```gitignore
# Unity WebGL build output (managed by CI, not version controlled)
unity-build/Build/
unity-build/TemplateData/
unity-build/StreamingAssets/
unity-build/index.html
# Keep the .gitkeep placeholder
!unity-build/.gitkeep
```

### smart-home-visualizer

The repo should already ignore `Library/`, `Temp/`, and build output. Verify `.gitignore` contains:
```gitignore
/Library/
/Temp/
/Obj/
/Build/
/Builds/
/Logs/
/UserSettings/
*.pidb.meta
*.pdb.meta
```

---

## Versioning Strategy

Use **matching version tags** across both repos to keep them in sync:

| Tag | ha-sweethome3d | smart-home-visualizer |
|---|---|---|
| `v1.0.0` | Initial tabbed UI + settings panel | Unity build compiled against this tag |
| `v1.1.0` | Feature update | Updated Unity build |

When releasing:
1. Tag and release `smart-home-visualizer` → GitHub Actions publishes the WebGL artifact
2. Tag `ha-sweethome3d` → GitHub Actions downloads the matching artifact and builds Docker

---

## Expected `unity-build/` Structure

After placing or downloading the Unity WebGL build, the directory should look like:

```
unity-build/
├── .gitkeep                    ← tracked, keeps dir in git
├── index.html                  ← Unity entry point (reads from localStorage)
├── Build/
│   ├── Build.loader.js         ← Unity boot loader
│   ├── Build.wasm.br           ← WebAssembly binary (Brotli)
│   ├── Build.framework.js.br   ← Unity framework (Brotli)
│   └── Build.data.br           ← Scene data (Brotli)
├── TemplateData/
│   ├── style.css
│   └── favicon.ico
└── StreamingAssets/
    └── smart-viz-files/
        ├── home-{id}_devices.json   ← IoT device metadata (exported from SweetHome3D)
        └── home-{id}_geometry.zip  ← 3D model OBJ+MTL (exported from SweetHome3D)
```

> **Note**: The `StreamingAssets/smart-viz-files/` data is also what `ExportButtons.vue` writes via `/exportForUnity.php`. The Unity build bundled in `unity-build/StreamingAssets/` is just a default/demo dataset — the live export always overwrites it.

---

## Summary Checklist

- [ ] Create `.github/workflows/build-webgl.yml` in `smart-home-visualizer`
- [ ] Configure Unity license secrets in `smart-home-visualizer` GitHub repo settings
- [ ] Create `.github/workflows/build-addon.yml` in `ha-sweethome3d`
- [ ] Update `YOUR_ORG` placeholder in both workflow files
- [ ] Add `unity-build/Build/`, `unity-build/TemplateData/`, etc. to `ha-sweethome3d/.gitignore`
- [ ] Add `unity-build/.gitkeep` to git: `git add -f unity-build/.gitkeep`
- [ ] Test full local flow: build Unity → copy to `unity-build/` → `npm run dev` → verify `/unity-visualizer/`
- [ ] Test Docker build: `docker build -f sweethome3d/Dockerfile .`
