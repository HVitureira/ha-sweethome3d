<template>
  <Teleport to="body">
    <div id="ha-export-buttons">
      <button
        id="ha-export-unity-btn"
        :disabled="isExporting"
        @click="exportForUnity"
        title="Export for Unity (Ctrl+E)"
      >
        {{ isExporting ? '⏳ Exporting…' : '📦 Export for Unity' }}
      </button>
      <button
        id="ha-export-obj-btn"
        :disabled="isExporting"
        @click="exportToOBJ"
        title="Export to OBJ (Ctrl+Shift+E)"
      >
        🔷 Export to OBJ
      </button>
    </div>

    <!-- In-DOM loading overlay (covers TabBar to prevent mid-export unmount) -->
    <div v-if="isExporting" id="ha-loading-overlay" class="ha-loading-overlay">
      <div class="ha-loading-spinner">
        <div class="ha-loading-icon">⏳</div>
        <div>{{ loadingMessage }}</div>
      </div>
    </div>

    <!-- In-DOM confirmation modal (replaces native window.confirm blocked in HA Ingress iframes) -->
    <div
      v-if="confirmDialog"
      class="ha-confirm-backdrop"
      role="dialog"
      aria-modal="true"
      @click.self="resolveConfirm(false)"
    >
      <div class="ha-confirm-dialog">
        <h3 class="ha-confirm-title">{{ confirmDialog.title }}</h3>
        <p class="ha-confirm-message">{{ confirmDialog.message }}</p>
        <div class="ha-confirm-actions">
          <button type="button" class="ha-confirm-cancel" @click="resolveConfirm(false)">
            {{ confirmDialog.cancelLabel }}
          </button>
          <button type="button" class="ha-confirm-ok" @click="resolveConfirm(true)">
            {{ confirmDialog.confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { isSmartDeviceFurniture } from '@/utils/deviceDetection'

interface ConfirmState {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  resolve: (confirmed: boolean) => void
}

const isExporting = ref(false)
const loadingMessage = ref('')
const confirmDialog = ref<ConfirmState | null>(null)

function askConfirm(opts: {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
}): Promise<boolean> {
  return new Promise((resolve) => {
    confirmDialog.value = {
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? 'Continue',
      cancelLabel: opts.cancelLabel ?? 'Cancel',
      resolve,
    }
  })
}

function resolveConfirm(confirmed: boolean) {
  const active = confirmDialog.value
  confirmDialog.value = null
  active?.resolve(confirmed)
}

function collectFurniture(furnitureList: any[], out: any[] = []): any[] {
  if (!furnitureList) return out
  for (let i = 0; i < furnitureList.length; i++) {
    const piece = furnitureList[i]
    if (!piece) continue
    if (typeof piece.getFurniture === 'function') {
      const children = piece.getFurniture()
      if (children && children.length > 0) {
        collectFurniture(children, out)
        continue
      }
    }
    out.push(piece)
  }
  return out
}

function countHADevices(home: any): number {
  let count = 0
  const UnityExportUtilities = (window as any).UnityExportUtilities
  if (home && typeof home.getFurniture === 'function') {
    const furniture = collectFurniture(home.getFurniture())
    for (let i = 0; i < furniture.length; i++) {
      const piece = furniture[i]
      const catalogId = UnityExportUtilities?.resolveCatalogId
        ? UnityExportUtilities.resolveCatalogId(piece)
        : (piece.getCatalogId ? piece.getCatalogId() : '')
      const matchedByExporter =
        UnityExportUtilities && UnityExportUtilities.isIoTDevice(catalogId, piece)
      if (matchedByExporter || isSmartDeviceFurniture(piece)) {
        count++
      }
    }
  }
  return count
}

function getActiveHome(app: any): any | null {
  const homes = app?.getHomes?.()
  if (!homes || homes.length === 0) return null
  return homes[homes.length - 1] ?? homes[0] ?? null
}

function normalizeHomeName(rawName: unknown): string {
  if (typeof rawName !== 'string') return 'smart-home'
  const cleaned = rawName.trim().replace(/\.sh3x$/i, '').replace(/[/\\]+/g, '_')
  return cleaned.length > 0 ? cleaned : 'smart-home'
}

function isUnsavedHome(app: any, rawName: unknown): boolean {
  if (typeof rawName !== 'string' || rawName.trim().length === 0) return true
  const defaultName = app?.configuration?.defaultHomeName
  return Boolean(defaultName && rawName === defaultName)
}

function showNotification(message: string, type: 'success' | 'warning' | 'error' | 'info') {
  console.log('[' + type + '] ' + message)
  const toast = document.createElement('div')
  toast.className = 'ha-toast ha-toast--' + type
  toast.textContent = message
  toast.title = 'Click to dismiss'
  toast.addEventListener('click', () => {
    if (toast.parentNode) toast.parentNode.removeChild(toast)
  })
  document.body.appendChild(toast)
  const durationMs = type === 'error' ? 9000 : 5000
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast)
  }, durationMs)
}

function showError(message: string) {
  console.error('❌ Export error:', message)
  showNotification('❌ ' + message, 'error')
}

async function exportForUnity() {
  if (isExporting.value || confirmDialog.value) return

  console.log('📤 Starting Unity export to server...')
  const app = (window as any).application
  const UnityExportUtilities = (window as any).UnityExportUtilities

  if (!app) {
    showError('Application not ready yet. Please wait a moment and try again.')
    return
  }
  if (typeof UnityExportUtilities === 'undefined') {
    showError('Unity export utilities not loaded. Please refresh the page.')
    return
  }

  try {
    const home = getActiveHome(app)
    if (!home) {
      showError('No home loaded yet. Please wait for the editor to finish loading or open a home.')
      return
    }

    const rawHomeName = home.getName ? home.getName() : null
    if (isUnsavedHome(app, rawHomeName)) {
      const proceedUnsaved = await askConfirm({
        title: 'Home Not Saved Yet',
        message:
          'This floor plan has not been saved yet, so its exported files will not appear in the 3D Visualizer tab until you save the home first. Do you want to export anyway?',
        cancelLabel: 'Cancel (Save First)',
        confirmLabel: 'Export Anyway',
      })
      if (!proceedUnsaved) return
    }

    const safeHomeName = normalizeHomeName(rawHomeName)
    const deviceCount = countHADevices(home)

    if (deviceCount === 0) {
      const proceedNoDevices = await askConfirm({
        title: 'No Smart Devices Found',
        message:
          'No smart devices were found in the floor plan. Add smart devices from the Smart Sensors, Smart Lights, or Smart Switches catalog categories before exporting, or continue to export geometry only.',
        cancelLabel: 'Cancel',
        confirmLabel: 'Export Anyway',
      })
      if (!proceedNoDevices) return
    }

    isExporting.value = true
    loadingMessage.value = 'Exporting for Unity: 3D model + device data → saving to server...'

    const result = await UnityExportUtilities.exportForUnity(
      home,
      (window as any).homeComponent3D || null,
      safeHomeName,
      { download: false },
    )

    const files: { name: string; blob: Blob }[] = Array.isArray(result?.files) ? result.files : []

    if (files.length === 0) {
      showNotification('⚠️ Nothing exported — OBJExporter may not be loaded yet.', 'warning')
      return
    }

    loadingMessage.value = `Uploading ${files.length} file(s) to server...`

    const succeeded: string[] = []
    const failed: string[] = []

    for (const { name, blob } of files) {
      try {
        const resp = await fetch(`writeData.php?path=${encodeURIComponent(name)}`, {
          method: 'POST',
          body: blob,
          credentials: 'same-origin',
        })
        if (resp.ok) {
          succeeded.push(`✓ ${name}`)
        } else {
          let detail = `HTTP ${resp.status}`
          try {
            const text = (await resp.text()).trim()
            if (text) detail += `: ${text.slice(0, 120)}`
          } catch { /* ignore */ }
          failed.push(`✗ ${name} (${detail})`)
        }
      } catch (uploadErr: any) {
        failed.push(`✗ ${name} (${uploadErr?.message || 'network error'})`)
      }
    }

    const devCount = result?.devices ?? '?'
    if (failed.length === files.length) {
      showError(`Unity export upload failed: ${failed.join(', ')}`)
    } else if (failed.length > 0) {
      showNotification(
        `⚠️ Partial export — Saved: ${succeeded.join(', ')} · Failed: ${failed.join(', ')}`,
        'warning',
      )
      window.dispatchEvent(new CustomEvent('ha-home-exported', { detail: { homeId: safeHomeName } }))
    } else {
      showNotification(
        `✅ Exported for Unity — ${succeeded.join(', ')} · ${devCount} device(s)`,
        'success',
      )
      window.dispatchEvent(new CustomEvent('ha-home-exported', { detail: { homeId: safeHomeName } }))
    }
    console.log('✅ Unity export complete. Saved:', succeeded, 'Failed:', failed)
  } catch (e: any) {
    showError('Unity export failed: ' + (e?.message || String(e)))
    console.error('❌ Unity export error:', e)
  } finally {
    isExporting.value = false
    loadingMessage.value = ''
  }
}

async function exportToOBJ() {
  if (isExporting.value || confirmDialog.value) return

  console.log('📦 Starting OBJ export...')
  const app = (window as any).application
  const OBJExporter = (window as any).OBJExporter || (globalThis as any).OBJExporter

  if (!app) {
    showError('Application not ready yet. Please wait a moment and try again.')
    return
  }
  if (typeof OBJExporter !== 'function') {
    showError('OBJExporter not loaded. Please refresh the page.')
    return
  }

  try {
    const home = getActiveHome(app)
    if (!home) {
      showError('No home loaded. Please create or open a home first.')
      return
    }

    const rawHomeName = home.getName ? home.getName() : null
    const safeHomeName = normalizeHomeName(rawHomeName)

    isExporting.value = true
    loadingMessage.value = 'Exporting 3D model to OBJ...'

    const exporter = new OBJExporter()
    const result = await exporter.exportToOBJ(
      home,
      (window as any).homeComponent3D || null,
      safeHomeName + '.zip',
      { download: true },
    )

    console.log('✅ OBJ export complete:', result)
    showNotification(`Export successful! ${result.vertices} vertices, ${result.faces} faces`, 'success')
  } catch (e: any) {
    showError('OBJ export failed: ' + (e?.message || String(e)))
    console.error('❌ OBJ export error:', e)
  } finally {
    isExporting.value = false
    loadingMessage.value = ''
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (confirmDialog.value) {
    if (e.key === 'Escape') {
      e.preventDefault()
      resolveConfirm(false)
    }
    return
  }
  if (isExporting.value) return

  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'e') {
    e.preventDefault()
    exportToOBJ()
  } else if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'e') {
    e.preventDefault()
    exportForUnity()
  }
}

onMounted(() => { document.addEventListener('keydown', onKeyDown) })
onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown)
  if (confirmDialog.value) resolveConfirm(false)
})
</script>

<!-- Global styles for dynamically appended toast elements -->
<style>
.ha-toast {
  position: fixed;
  top: 52px;
  right: 20px;
  z-index: 10001;
  padding: 12px 20px;
  border-radius: 4px;
  color: white;
  font-size: 14px;
  font-family: system-ui, sans-serif;
  max-width: 440px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  pointer-events: all;
  word-break: break-word;
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
  pointer-events: all;
}

.ha-loading-spinner {
  background: white;
  color: #222;
  padding: 28px 32px;
  border-radius: 8px;
  text-align: center;
  font-family: system-ui, sans-serif;
  font-size: 14px;
  max-width: 420px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.ha-loading-icon {
  font-size: 22px;
  margin-bottom: 10px;
}

.ha-confirm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: all;
}

.ha-confirm-dialog {
  background: #161630;
  color: #e0e0f5;
  border: 1px solid #3a3a6a;
  border-radius: 8px;
  padding: 20px 24px;
  width: 420px;
  max-width: 90vw;
  font-family: system-ui, sans-serif;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
}

.ha-confirm-title {
  margin: 0 0 10px;
  font-size: 16px;
  color: #ffffff;
}

.ha-confirm-message {
  margin: 0 0 18px;
  font-size: 13px;
  line-height: 1.5;
  color: #c0c0e0;
}

.ha-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.ha-confirm-cancel,
.ha-confirm-ok {
  border: none;
  border-radius: 4px;
  padding: 7px 14px;
  font-size: 13px;
  cursor: pointer;
}

.ha-confirm-cancel {
  background: #2a2a4a;
  color: #c0c0e0;
}

.ha-confirm-cancel:hover {
  background: #3a3a60;
}

.ha-confirm-ok {
  background: #4CAF50;
  color: #ffffff;
}

.ha-confirm-ok:hover {
  background: #45a049;
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

#ha-export-unity-btn:hover:not(:disabled) {
  background-color: #45a049;
}

#ha-export-unity-btn:disabled {
  opacity: 0.65;
  cursor: wait;
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

#ha-export-obj-btn:hover:not(:disabled) {
  background-color: #1976D2;
}

#ha-export-obj-btn:disabled {
  opacity: 0.65;
  cursor: wait;
}
</style>
