# Local Deployment to Home Assistant (via Samba)

Deploy this addon directly to a Home Assistant instance **without publishing to GitHub** or any addon store. This method uses the built-in Samba share to place addon files into HA's local addons directory.

---

## Prerequisites

- **Home Assistant OS** (or Supervised) running on your network
- **Samba Share addon** installed and running in HA (Settings → Add-ons → Add-on Store → search "Samba share")
- **Node.js 18+** on your dev machine (for building the Vue frontend)
- **Docker** on your dev machine (for local testing before deploying)

---

## How It Works

Home Assistant's Supervisor scans the `/addons/` directory for local addons. Any folder containing a valid `config.yaml` + `Dockerfile` will appear under **Settings → Add-ons → Add-on Store → Local Add-ons**.

The Samba addon exposes this directory as a Windows network share at:

```
\\homeassistant.local\addons
```

> **Note**: Replace `homeassistant.local` with your HA instance's IP address (e.g., `\\192.168.1.100\addons`) if mDNS resolution doesn't work on your network.

---

## Step-by-Step Deployment

### 1. Configure Hostname (Optional)

By default, the scripts assume your Home Assistant is at `homeassistant.local`. 
If it has a different IP/hostname, configure it:

1. Copy `.env.example` to `.env`
2. Edit `.env` and set `HA_HOST=your-ip-address`

### 2. Run the Deployment Script

We have automated the build, sync, and Samba network transfer into a single script.

**For Windows (PowerShell):**
```powershell
.\scripts\deploy-local.ps1
```

**For Linux / macOS:**
```bash
./scripts/deploy-local.sh
```

> **What this does:**
> 1. Builds the Vue frontend.
> 2. Syncs the Vue dist and Unity build into the `sweethome3d/www/` folder.
> 3. Fixes any line-ending issues in the linux scripts (`start.sh`, `run`, etc).
> 4. Copies the entire `sweethome3d/` folder to `\\homeassistant.local\addons\sweethome3d` via Samba.

### 3. Install the Addon in Home Assistant

1. Open the HA UI → **Settings** → **Add-ons** → **Add-on Store**
2. Click the **⋮** (three dots) in the top right → **Check for updates**
3. Scroll down to **Local Add-ons** — you should see **"HASweetHome3D"**
4. Click it → **Install**
5. Wait for the build to complete (first build takes a few minutes)
6. Click **Start**
7. Access via the sidebar entry or the **Open Web UI** button

---

## Updating After Code Changes

After making changes to the codebase, simply re-run the deployment script (`deploy-local.ps1` or `deploy-local.sh`). Then:

1. Go to the Addon page in Home Assistant.
2. Click **Rebuild**.
3. Click **Start**.

To rebuild in HA: go to the addon page → click **Rebuild** (or Uninstall + Install if Rebuild isn't shown).

---

## Troubleshooting

### Addon doesn't appear under "Local Add-ons"

- Verify the folder is at `\\homeassistant.local\addons\sweethome3d\` (not nested deeper)
- Check that `config.yaml` exists at the root of that folder
- Make sure `config.yaml` does **NOT** have an `image:` key — this forces local builds
- Click **Check for updates** again in the Add-on Store

### Build fails on Home Assistant

- Check the addon **Log** tab for build errors
- Ensure `start.sh` has Unix line endings (LF, not CRLF). If you see `exec format error` or `no such file or directory`:
  ```powershell
  # Fix line endings before copying
  (Get-Content sweethome3d\start.sh -Raw) -replace "`r`n", "`n" | Set-Content sweethome3d\start.sh -NoNewline
  ```
- The same applies to all files in `rootfs/etc/cont-init.d/` and `rootfs/etc/services.d/`

### Samba share not accessible

- Verify the Samba addon is running in HA
- Check the Samba addon configuration — ensure `addons` is listed in `enabled_shares`
- Try using the IP address directly: `\\192.168.x.x\addons`
- On Windows, you may need to enter credentials: use the username/password configured in the Samba addon

### Changes not reflected after rebuild

- HA Supervisor may cache Docker layers. Try **Uninstall** → **Install** instead of Rebuild
- Verify the files on the Samba share actually updated (check file timestamps)
