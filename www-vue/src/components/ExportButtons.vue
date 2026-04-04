<template>
  <Teleport to="body">
    <div id="ha-export-buttons">
      <button id="ha-export-unity-btn" @click="exportForUnity" title="Export for Unity (Ctrl+E)">
        📦 Export for Unity
      </button>
      <button id="ha-export-obj-btn" @click="exportToOBJ" title="Export to OBJ (Ctrl+Shift+E)">
        🔷 Export to OBJ
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

function countHADevices(home: any): number {
  let count = 0
  const UnityExportUtilities = (window as any).UnityExportUtilities
  if (home.getFurniture) {
    const furniture = home.getFurniture()
    for (let i = 0; i < furniture.length; i++) {
      const piece = furniture[i]
      const catalogId = piece.getCatalogId ? piece.getCatalogId() : ''
      if (UnityExportUtilities && UnityExportUtilities.isIoTDevice(catalogId, piece)) {
        count++
      }
    }
  }
  return count
}

function showNotification(message: string, type: string) {
  console.log('[' + type + '] ' + message)
  const toast = document.createElement('div')
  toast.className = 'ha-toast ha-toast--' + (type || 'info')
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast) }, 5000)
}

function showLoading(message: string) {
  const overlay = document.createElement('div')
  overlay.id = 'ha-loading-overlay'
  overlay.className = 'ha-loading-overlay'
  const spinner = document.createElement('div')
  spinner.className = 'ha-loading-spinner'
  spinner.innerHTML = '<div class="ha-loading-icon">⏳</div><div>' + message + '</div>'
  overlay.appendChild(spinner)
  document.body.appendChild(overlay)
}

function hideLoading() {
  const overlay = document.getElementById('ha-loading-overlay')
  if (overlay) overlay.remove()
}

function showError(message: string) {
  alert('❌ Error: ' + message)
  console.error('Error:', message)
}

async function exportForUnity() {
  console.log('📤 Starting Unity export to server...')
  const app = (window as any).application
  const UnityExportUtilities = (window as any).UnityExportUtilities

  if (!app) { showError('Application not ready'); return }
  if (typeof UnityExportUtilities === 'undefined') {
    showError('Unity export utilities not loaded. Please refresh the page.')
    return
  }

  try {
    const homes = app.getHomes()
    if (!homes || homes.length === 0) { showError('No home loaded'); return }

    const home = homes[0]
    const homeName = home.getName ? home.getName() : 'smart-home'
    const deviceCount = countHADevices(home)

    if (deviceCount === 0) {
      const proceed = confirm(
        'No smart devices found in the floor plan.\n\n' +
        'Add smart devices from the "Smart Devices" category in the furniture catalog before exporting.\n\n' +
        'Export anyway?'
      )
      if (!proceed) return
    }

    showLoading('Exporting for Unity: 3D model + device data → saving to server...')

    // ── Blob interception ─────────────────────────────────────────────────────
    // SH3D's export uses URL.createObjectURL + anchor.click for all downloads.
    // We intercept both to capture blobs and POST them to the server instead.
    const captured: { name: string; blob: Blob }[] = []
    const blobUrlMap = new Map<string, Blob>()

    const origCreateObjectURL = (URL.createObjectURL as typeof URL.createObjectURL).bind(URL)
    const origRevokeObjectURL = URL.revokeObjectURL.bind(URL)
    const origAnchorClick = HTMLAnchorElement.prototype.click

    URL.createObjectURL = (obj: Blob | MediaSource) => {
      const url = origCreateObjectURL(obj as Blob)
      if (obj instanceof Blob) blobUrlMap.set(url, obj)
      return url
    }
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      if (this.download && this.href && blobUrlMap.has(this.href)) {
        captured.push({ name: this.download, blob: blobUrlMap.get(this.href)! })
        origRevokeObjectURL(this.href)
        blobUrlMap.delete(this.href)
        return // suppress browser download
      }
      origAnchorClick.call(this)
    }

    let result: any
    try {
      result = await UnityExportUtilities.exportForUnity(
        home,
        (window as any).homeComponent3D || null,
        homeName,
      )
    } finally {
      // Always restore patches, even if export throws
      URL.createObjectURL = origCreateObjectURL
      HTMLAnchorElement.prototype.click = origAnchorClick
    }
    // ── End interception ─────────────────────────────────────────────────────
    // POST all captured blobs to the server
    const serverResults: string[] = []

    for (const { name, blob } of captured) {
      const resp = await fetch(
        `writeData.php?path=${encodeURIComponent(name)}`,
        { method: 'POST', body: blob },
      )
      serverResults.push(resp.ok ? `✓ ${name}` : `✗ ${name} (HTTP ${resp.status})`)
    }

    hideLoading()

    if (serverResults.length === 0) {
      showNotification('⚠️ Nothing captured — OBJExporter may not be loaded yet.', 'warning')
    } else {
      const devCount = result?.devices ?? '?'
      showNotification(
        `✅ Exported for Unity — ${serverResults.join(', ')} · ${devCount} device(s)`,
        'success',
      )
    }
    console.log('✅ Unity export complete. Saved:', serverResults)
  } catch (e: any) {
    hideLoading()
    showError('Unity export failed: ' + e.message)
    console.error('❌ Unity export error:', e)
  }
}

async function exportToOBJ() {
  console.log('📦 Starting OBJ export...')
  const app = (window as any).application

  if (!app) { showError('Application not ready'); return }

  try {
    const homes = app.getHomes()
    if (!homes || homes.length === 0) {
      showError('No home loaded. Please create or open a home first.')
      return
    }

    const home = homes[0]
    const homeName = home.getName ? home.getName() : 'smart-home'

    showLoading('Exporting 3D model to OBJ...')

    const OBJExporter = (window as any).OBJExporter
    const exporter = new OBJExporter()
    const result = await exporter.exportToOBJ(
      home,
      (window as any).homeComponent3D || null,
      homeName + '.zip'
    )

    hideLoading()
    console.log('✅ OBJ export complete:', result)
    showNotification(`Export successful! ${result.vertices} vertices, ${result.faces} faces`, 'success')
  } catch (e: any) {
    hideLoading()
    showError('OBJ export failed: ' + e.message)
    console.error('❌ OBJ export error:', e)
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.ctrlKey && e.shiftKey && e.key === 'E') {
    e.preventDefault()
    exportToOBJ()
  } else if (e.ctrlKey && !e.shiftKey && e.key === 'e') {
    e.preventDefault()
    exportForUnity()
  }
}

onMounted(() => { document.addEventListener('keydown', onKeyDown) })
onUnmounted(() => { document.removeEventListener('keydown', onKeyDown) })
</script>

<!-- Global styles for dynamically appended toast/overlay elements -->
<style>
.ha-toast {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
  padding: 12px 20px;
  border-radius: 4px;
  color: white;
  font-size: 14px;
  max-width: 400px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.ha-toast--success { background-color: #4CAF50; }
.ha-toast--warning { background-color: #FF9800; }
.ha-toast--error   { background-color: #F44336; }
.ha-toast--info    { background-color: #2196F3; }

.ha-loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ha-loading-spinner {
  background: white;
  padding: 30px;
  border-radius: 8px;
  text-align: center;
}

.ha-loading-icon {
  font-size: 18px;
  margin-bottom: 10px;
}
</style>

<style scoped>
#ha-export-buttons {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: all;
}

#ha-export-unity-btn {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

#ha-export-unity-btn:hover {
  background-color: #45a049;
}

#ha-export-obj-btn {
  background-color: #2196F3;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

#ha-export-obj-btn:hover {
  background-color: #1976D2;
}
</style>
