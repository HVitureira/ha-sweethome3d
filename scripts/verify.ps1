<#
.SYNOPSIS
  Verify ha-sweethome3d addon structure, Vue TypeScript check, LF endings, Unity index.html sync, and AI setup.
.PARAMETER SkipTypeCheck
  Skip running `npm run type-check` inside www-vue/.
#>
param(
    [switch]$SkipTypeCheck
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Split-Path -Parent $ScriptDir
$AddonRoot = Join-Path $RepoRoot "sweethome3d"
$ErrorCount = 0

function Check-File($rel) {
    $p = Join-Path $AddonRoot $rel
    if (-not (Test-Path $p -PathType Leaf)) {
        Write-Host "  FAIL: Missing file: $rel" -ForegroundColor Red
        $script:ErrorCount++
    } else {
        Write-Host "  OK: $rel"
    }
}

function Check-Dir($rel) {
    $p = Join-Path $AddonRoot $rel
    if (-not (Test-Path $p -PathType Container)) {
        Write-Host "  FAIL: Missing directory: $rel" -ForegroundColor Red
        $script:ErrorCount++
    } else {
        Write-Host "  OK: $rel"
    }
}

Write-Host "==> Verifying ha-sweethome3d..." -ForegroundColor Cyan

Write-Host "`n[Core Configuration & s6-overlay]"
Check-File "config.yaml"
Check-File "Dockerfile"
Check-File "build.yaml"
Check-File "start.sh"
Check-Dir "rootfs\etc\cont-init.d"
Check-File "rootfs\etc\services.d\nginx\run"
Check-File "rootfs\etc\services.d\php-fpm\run"

Write-Host "`n[Web & Unity Assets]"
Check-File "www\index.html"
Check-File "www\listHomes.php"
Check-File "www\writeData.php"
Check-File "www\deleteHome.php"
Check-File "www\unity-visualizer\index.html"
Check-Dir "www\unity-visualizer\Build"

$jsAsset = Get-ChildItem (Join-Path $AddonRoot "www\assets") -Filter "index-*.js" -ErrorAction SilentlyContinue | Select-Object -First 1
$cssAsset = Get-ChildItem (Join-Path $AddonRoot "www\assets") -Filter "index-*.css" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $jsAsset) { Write-Host "  FAIL: Missing hashed JS asset in www/assets/" -ForegroundColor Red; $ErrorCount++ }
else { Write-Host "  OK: $($jsAsset.Name)" }
if (-not $cssAsset) { Write-Host "  FAIL: Missing hashed CSS asset in www/assets/" -ForegroundColor Red; $ErrorCount++ }
else { Write-Host "  OK: $($cssAsset.Name)" }

$unityDevHtml = Join-Path $RepoRoot "unity-build\index.html"
$unityProdHtml = Join-Path $AddonRoot "www\unity-visualizer\index.html"
if ((Test-Path $unityDevHtml) -and (Test-Path $unityProdHtml)) {
    if ((Get-FileHash $unityDevHtml -Algorithm SHA256).Hash -ne (Get-FileHash $unityProdHtml -Algorithm SHA256).Hash) {
        Write-Host "  WARN: unity-build/index.html differs from sweethome3d/www/unity-visualizer/index.html (run setup.sh or deploy-local.ps1)" -ForegroundColor Yellow
    } else {
        Write-Host "  OK: Unity index.html synced between unity-build/ and sweethome3d/www/unity-visualizer/"
    }
}

Write-Host "`n[Container Script Line Endings (LF)]"
$containerScripts = @()
$containerScripts += Join-Path $AddonRoot "start.sh"
$containerScripts += (Get-ChildItem (Join-Path $AddonRoot "rootfs\etc\cont-init.d") -File -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
$containerScripts += (Get-ChildItem (Join-Path $AddonRoot "rootfs\etc\services.d") -Recurse -File -Include run,finish -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
$crlfCount = 0
foreach ($f in $containerScripts) {
    if (Test-Path $f) {
        $bytes = [IO.File]::ReadAllBytes($f)
        for ($i = 0; $i -lt $bytes.Length - 1; $i++) {
            if ($bytes[$i] -eq 13 -and $bytes[$i + 1] -eq 10) {
                Write-Host "  FAIL: CRLF detected in $($f.Replace($RepoRoot + '\', ''))" -ForegroundColor Red
                $crlfCount++
                $ErrorCount++
                break
            }
        }
    }
}
if ($crlfCount -eq 0) { Write-Host "  OK: All container scripts use LF endings" }

if (-not $SkipTypeCheck -and (Test-Path (Join-Path $RepoRoot "www-vue\node_modules"))) {
    Write-Host "`n[Vue Type-Check]"
    Push-Location (Join-Path $RepoRoot "www-vue")
    try {
        npm run type-check
        if ($LASTEXITCODE -ne 0) { $ErrorCount++ }
    } finally { Pop-Location }
}

Write-Host "`n[AI Setup Audit]"
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command python3 -ErrorAction SilentlyContinue }
if ($py) {
    & $py.Source (Join-Path $ScriptDir "check-ai-setup.py")
    if ($LASTEXITCODE -ne 0) { $ErrorCount++ }
}

Write-Host ""
if ($ErrorCount -eq 0) {
    Write-Host "==> Verification PASSED!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "==> Verification FAILED with $ErrorCount error(s)." -ForegroundColor Red
    exit 1
}
