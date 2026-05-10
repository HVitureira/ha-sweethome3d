<#
.SYNOPSIS
Deploys the HASweetHome3D addon to a local Home Assistant instance using the Samba share.

.DESCRIPTION
This script automates the build and deployment process:
1. Reads HA_HOST from .env (defaults to homeassistant.local)
2. Builds the Vue frontend
3. Syncs the Vue dist and Unity build into the addon folder
4. Copies the addon folder to the Samba share on Home Assistant
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Split-Path -Parent $ScriptDir
$AddonRoot = Join-Path $RepoRoot "sweethome3d"

# Read HA Host from .env
$envFile = Join-Path $RepoRoot ".env"
$HA_HOST = "homeassistant.local"

if (Test-Path $envFile) {
    Write-Host "Reading .env file..."
    Get-Content $envFile | Where-Object { $_ -match "^[^#]" } | ForEach-Object {
        $name, $value = $_.Split('=', 2)
        if ($name.Trim() -eq "HA_HOST") {
            $HA_HOST = $value.Trim()
        }
    }
} else {
    Write-Host "No .env file found. Using default HA_HOST: $HA_HOST" -ForegroundColor Yellow
}

$SambaPath = "\\$HA_HOST\addons\sweethome3d"

Write-Host "🚀 Starting Local Addon Deployment" -ForegroundColor Cyan
Write-Host "Target: $SambaPath" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build Vue
Write-Host "1. Building Vue frontend..." -ForegroundColor Green
$VuePath = Join-Path $RepoRoot "www-vue"
Push-Location $VuePath
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing NPM dependencies..."
    npm install
}
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Vue build failed" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

# Step 2: Sync Vue Assets
Write-Host "2. Syncing Vue assets..." -ForegroundColor Green
$VueDist = Join-Path $VuePath "dist"
Copy-Item -Path "$VueDist\*" -Destination "$AddonRoot\www\" -Recurse -Force

# Step 3: Sync Unity Assets
$UnityBuild = Join-Path $RepoRoot "unity-build"
if (Test-Path $UnityBuild) {
    Write-Host "3. Syncing Unity WebGL build..." -ForegroundColor Green
    $UnityDest = Join-Path $AddonRoot "www\unity-visualizer"
    
    # Clean previous unity assets
    if (Test-Path $UnityDest) {
        Remove-Item "$UnityDest\*" -Recurse -Force -ErrorAction SilentlyContinue
    } else {
        New-Item -ItemType Directory -Path $UnityDest | Out-Null
    }
    
    Copy-Item -Path "$UnityBuild\*" -Destination $UnityDest -Recurse -Force
} else {
    Write-Host "3. Unity build folder not found, skipping unity sync." -ForegroundColor Yellow
}

# Step 4: Fix Line Endings (CRLF -> LF) for Linux scripts
Write-Host "4. Normalizing script line endings..." -ForegroundColor Green
$ScriptsToFix = @(
    "start.sh",
    "rootfs\etc\cont-init.d\00-banner.sh",
    "rootfs\etc\cont-init.d\10-config.sh",
    "rootfs\etc\cont-init.d\20-permissions.sh",
    "rootfs\etc\services.d\nginx\run",
    "rootfs\etc\services.d\nginx\finish",
    "rootfs\etc\services.d\php-fpm\run",
    "rootfs\etc\services.d\php-fpm\finish"
)

foreach ($file in $ScriptsToFix) {
    $fullPath = Join-Path $AddonRoot $file
    if (Test-Path $fullPath) {
        $content = Get-Content $fullPath -Raw
        $content = $content -replace "`r`n", "`n"
        Set-Content -Path $fullPath -Value $content -NoNewline
    }
}

# Step 5: Copy to Samba Share
Write-Host "5. Copying addon files to Home Assistant ($SambaPath)..." -ForegroundColor Green

if (-not (Test-Path "\\$HA_HOST\addons")) {
    Write-Host "❌ Cannot access the Samba share at \\$HA_HOST\addons" -ForegroundColor Red
    Write-Host "Ensure the Samba addon is running on your HA instance." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $SambaPath)) {
    New-Item -ItemType Directory -Path $SambaPath | Out-Null
}

Copy-Item -Path "$AddonRoot\*" -Destination $SambaPath -Recurse -Force

Write-Host ""
Write-Host "🎉 Deployment to Samba share complete!" -ForegroundColor Cyan
Write-Host "--------------------------------------------------------"
Write-Host "Next steps in the Home Assistant UI:"
Write-Host "1. Go to Settings -> Add-ons -> Add-on Store"
Write-Host "2. Click the three dots (top right) -> Check for updates"
Write-Host "3. Find 'HASweetHome3D' under Local Add-ons"
Write-Host "4. Click Install (or Rebuild if already installed)"
Write-Host "5. Click Start"
Write-Host "--------------------------------------------------------"
