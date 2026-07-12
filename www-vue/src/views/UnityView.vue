<template>
  <div class="unity-view">
    <!-- Token-missing banner (shown when neither localStorage nor the add-on fallback has a token) -->
    <div v-if="missingToken" class="token-missing-banner">
      <span class="token-missing-icon">&#9888;</span>
      <span class="token-missing-text">
        Home Assistant access token is not set &mdash; temperature and sensor overlays will not update.
        Set it in <strong>Home Assistant &rarr; Add-ons &rarr; SweetHome3D &rarr; Configuration</strong>,
        then restart the add-on.
      </span>
    </div>

    <!-- Home Selector Bar -->
    <div class="home-selector-bar">
      <label for="ha-home-select" class="home-selector-label">Home:</label>
      <select
        id="ha-home-select"
        v-model="selectedHomeId"
        class="home-selector-select"
        :disabled="homes.length === 0"
        @change="onHomeChange"
      >
        <option v-if="homes.length === 0" value="">Loading…</option>
        <option v-for="h in homes" :key="h.id" :value="h.id">
          {{ h.id }}
          {{ h.hasGeometry ? '✓' : h.hasDevices ? '📋' : '—' }}
        </option>
      </select>
      <span class="home-selector-hint" v-if="selectedHome">
        <template v-if="selectedHome.hasGeometry">Full export (geometry + devices)</template>
        <template v-else-if="selectedHome.hasDevices">Devices only (run Export for Unity for geometry)</template>
        <template v-else>No data exported yet</template>
      </span>
      <button class="home-reload-btn" :disabled="!iframeSrc" title="Reload Unity visualizer" @click="reloadIframe">↻ Reload</button>
      <button
        class="home-dashboard-btn"
        :disabled="!selectedHome?.hasGeometry"
        :title="selectedHome?.hasGeometry ? 'Add this home to a Home Assistant dashboard' : 'Export for Unity (geometry) before adding to a dashboard'"
        @click="openDashboardDialog"
      >
        🖥️ Add to Dashboard
      </button>
    </div>

    <!-- Unity iframe -->
    <div v-if="!iframeSrc" class="unity-placeholder">
      <p>Loading 3D Visualizer&hellip;</p>
    </div>
    <iframe
      v-show="iframeSrc"
      ref="iframeRef"
      class="unity-frame"
      :src="iframeSrc"
      allow="autoplay; fullscreen"
      allowfullscreen
      title="Smart Home 3D Visualizer"
    />

    <!-- Add to Dashboard dialog -->
    <div v-if="showDashboardDialog" class="dashboard-dialog-backdrop" @click.self="closeDashboardDialog">
      <div class="dashboard-dialog">
        <h3>Add "{{ selectedHomeId }}" to a Dashboard</h3>

        <template v-if="!fallbackCard">
          <p v-if="dashboardsLoading" class="dashboard-dialog-loading">Loading dashboards…</p>
          <p v-else-if="dashboardLoadError" class="dashboard-dialog-error">{{ dashboardLoadError }}</p>
          <template v-else>
            <label class="dashboard-dialog-label">Dashboard</label>
            <select
              v-model="selectedDashboardUrlPath"
              class="dashboard-dialog-select"
              :disabled="dashboardsLoading"
              @change="onDashboardChange"
            >
              <option v-for="d in dashboards" :key="d.url_path ?? ''" :value="d.url_path ?? ''">
                {{ d.title }}
              </option>
            </select>

            <label class="dashboard-dialog-label">View</label>
            <select v-model.number="selectedViewIndex" class="dashboard-dialog-select" :disabled="dashboardsLoading">
              <option v-for="v in availableViews" :key="v.index" :value="v.index">
                {{ v.title }}
              </option>
            </select>
          </template>

          <div class="dashboard-dialog-actions">
            <button class="dashboard-dialog-cancel" @click="closeDashboardDialog">Cancel</button>
            <button
              class="dashboard-dialog-confirm"
              :disabled="dashboardsLoading || addingCard || dashboardLoadError !== '' || selectedViewIndex === null"
              @click="confirmAddCard"
            >
              {{ addingCard ? 'Adding…' : 'Add Card' }}
            </button>
          </div>
        </template>

        <template v-else>
          <p>Couldn't add the card automatically{{ fallbackReason ? ` (${fallbackReason})` : '' }}. Open <em>Edit Dashboard → raw configuration editor</em> and paste this card:</p>
          <textarea class="dashboard-dialog-fallback" readonly :value="JSON.stringify(fallbackCard, null, 2)" />
          <div class="dashboard-dialog-actions">
            <button class="dashboard-dialog-cancel" @click="closeDashboardDialog">Close</button>
            <button class="dashboard-dialog-confirm" @click="copyFallbackCard">Copy</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSettingsStore } from '@/stores/settingsStore'
import { useHaAddonTokenStatus } from '@/composables/useHaAddonTokenStatus'

defineOptions({ name: 'UnityView' })

const { hasAddonToken, refresh: refreshAddonTokenStatus } = useHaAddonTokenStatus()

interface HomeEntry {
  id: string
  hasDevices: boolean
  hasGeometry: boolean
}

const iframeRef = ref<HTMLIFrameElement | null>(null)
const iframeSrc = ref<string>('')
const hasLoaded = ref(false)
const route = useRoute()
const settingsStore = useSettingsStore()

const homes = ref<HomeEntry[]>([])
const selectedHomeId = ref<string>('')
const selectedHome = computed(() => homes.value.find(h => h.id === selectedHomeId.value) ?? null)

// Banner appears only when BOTH localStorage AND the add-on fallback lack a token,
// mirroring exactly what Unity's index.html checks (localStorage → ha-config.json).
const missingToken = computed(() =>
  !settingsStore.settings.homeAssistantAccessToken && !hasAddonToken.value
)

interface DashboardView {
  index: number
  title: string
}
interface DashboardEntry {
  url_path: string | null
  title: string
  views: DashboardView[]
}

const showDashboardDialog = ref(false)
const dashboards = ref<DashboardEntry[]>([])
const selectedDashboardUrlPath = ref<string>('')
const selectedViewIndex = ref<number | null>(null)
const dashboardLoadError = ref('')
const fallbackCard = ref<Record<string, unknown> | null>(null)
const fallbackReason = ref('')
const dashboardsLoading = ref(false)
const addingCard = ref(false)

const availableViews = computed(
  () => dashboards.value.find(d => (d.url_path ?? '') === selectedDashboardUrlPath.value)?.views ?? [],
)

function showToast(message: string, type: string) {
  console.log('[' + type + '] ' + message)
  const toast = document.createElement('div')
  toast.className = 'ha-toast ha-toast--' + (type || 'info')
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast) }, 5000)
}

function onDashboardChange() {
  selectedViewIndex.value = availableViews.value[0]?.index ?? null
}

async function openDashboardDialog() {
  showDashboardDialog.value = true
  dashboardLoadError.value = ''
  fallbackCard.value = null
  dashboardsLoading.value = true
  try {
    const resp = await fetch('listDashboards.php')
    const data = await resp.json()
    if (!resp.ok || !data.ok) {
      dashboardLoadError.value = data.reason || 'Could not load dashboards.'
      return
    }
    dashboards.value = data.dashboards
    selectedDashboardUrlPath.value = dashboards.value[0]?.url_path ?? ''
    onDashboardChange()
  } catch (e: any) {
    dashboardLoadError.value = 'Could not reach the server: ' + e.message
  } finally {
    dashboardsLoading.value = false
  }
}

function closeDashboardDialog() {
  showDashboardDialog.value = false
  fallbackCard.value = null
}

async function confirmAddCard() {
  if (!selectedHomeId.value || selectedViewIndex.value === null) return
  addingCard.value = true
  try {
    const resp = await fetch('addDashboardCard.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        homeId: selectedHomeId.value,
        urlPath: selectedDashboardUrlPath.value || null,
        viewIndex: selectedViewIndex.value,
      }),
    })
    const data = await resp.json()
    if (data.ok) {
      showToast('✅ Card added to your dashboard.', 'success')
      closeDashboardDialog()
    } else {
      fallbackReason.value = data.reason || ''
      fallbackCard.value = data.card || null
      if (!fallbackCard.value) {
        showToast('❌ Could not add the card: ' + (data.reason || 'unknown error'), 'error')
      }
    }
  } catch (e: any) {
    showToast('❌ Could not add the card: ' + e.message, 'error')
  } finally {
    addingCard.value = false
  }
}

async function copyFallbackCard() {
  if (!fallbackCard.value) return
  try {
    await navigator.clipboard.writeText(JSON.stringify(fallbackCard.value, null, 2))
    showToast('Card config copied to clipboard.', 'success')
  } catch (e: any) {
    showToast('Could not copy automatically — select the text manually.', 'warning')
  }
}

function writeConfigToStorage() {
  localStorage.setItem('ha-smart-home-settings', JSON.stringify(settingsStore.settings))
}

function sendConfigToIframe() {
  if (!iframeRef.value?.contentWindow) return
  iframeRef.value.contentWindow.postMessage(
    {
      type: 'SMART_HOME_CONFIG_UPDATE',
      config: settingsStore.toUnityConfig(),
    },
    '*',
  )
}

function getUnityDataBaseUrl(): string {
  const { origin, pathname } = window.location
  let basePath = pathname

  // If this is the Unity iframe route, strip that segment.
  const unitySegment = '/unity-visualizer'
  const unityIndex = basePath.indexOf(unitySegment)
  if (unityIndex >= 0) {
    basePath = basePath.slice(0, unityIndex)
  }

  // Normalize trailing slashes while preserving root.
  basePath = basePath.replace(/\/+$/, '')

  return basePath ? `${origin}${basePath}` : origin
}

function sendLoadHome(homeId: string) {
  if (!iframeRef.value?.contentWindow) return
  iframeRef.value.contentWindow.postMessage(
    {
      type: 'LOAD_HOME',
      homeId,
      // Needed so Unity fetches /data/* from the addon root even under ingress.
      baseUrl: getUnityDataBaseUrl(),
    },
    '*',
  )
}

function onHomeChange() {
  if (selectedHomeId.value && hasLoaded.value) {
    sendLoadHome(selectedHomeId.value)
  }
}

function reloadIframe() {
  iframeSrc.value = ''
  setTimeout(() => {
    iframeSrc.value = 'unity-visualizer/index.html'
    hasLoaded.value = false
  }, 50)
}

async function fetchHomes() {
  try {
    const resp = await fetch('listHomesExtended.php')
    if (resp.ok) {
      const newHomes: HomeEntry[] = await resp.json()
      homes.value = newHomes
      // Preserve the current selection if it still exists; otherwise default to
      // the currently open SH3D home, else first. This prevents the subtle bug
      // where the user picked home A in Unity but is editing home B in SH3D —
      // the old "always re-derive" logic would yank their selection to B on
      // every tab switch.
      const stillExists = newHomes.find(h => h.id === selectedHomeId.value)
      if (!stillExists) {
        const currentName: string =
          (window as any).application?.getHomes?.()[0]?.getName?.() ?? ''
        const match = newHomes.find(h => h.id === currentName)
        selectedHomeId.value = match?.id ?? newHomes[0]?.id ?? ''
      }
    }
  } catch (e) {
    console.warn('[UnityView] Could not load home list:', e)
  }
}

onMounted(async () => {
  await settingsStore.configReady
  writeConfigToStorage()
  await fetchHomes()
  iframeSrc.value = 'unity-visualizer/index.html'
  iframeRef.value?.addEventListener('load', () => {
    hasLoaded.value = true
    // Send selected home once Unity is ready (short delay for Unity init)
    setTimeout(() => {
      if (selectedHomeId.value) sendLoadHome(selectedHomeId.value)
    }, 3000)
  })

})

watch(() => route.path, async (path) => {
  if (path === '/visualizer') {
    // Refresh the home list — a new home may have been saved/exported
    // on the Floor Plan tab since the last visit.
    await fetchHomes()
    // Refresh add-on token status too — the user may have just configured
    // the token in HA add-on config and returned (Path B = addon restart +
    // iframe reload, but a fresh re-fetch keeps the banner honest either way).
    refreshAddonTokenStatus()
    if (hasLoaded.value) {
      writeConfigToStorage()
      sendConfigToIframe()
      // Re-send LOAD_HOME so Unity picks up any re-exported geometry for
      // the currently selected home (bug: "exported a new house, but the
      // 3D scene inside Unity still reflects the previous export").
      if (selectedHomeId.value) sendLoadHome(selectedHomeId.value)
    }
  }
})
</script>

<style scoped>
.unity-view {
  position: fixed;
  top: 40px;
  left: 0;
  right: 0;
  bottom: 0;
  background: #0a0a14;
  pointer-events: all;
  z-index: 1500;
  display: flex;
  flex-direction: column;
}

/* ── Token-missing banner (between tab bar and home selector) ── */
.token-missing-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 14px;
  background: #3a1414;
  border-bottom: 1px solid #8a2a2a;
  color: #ffb0b0;
  font-family: system-ui, sans-serif;
  font-size: 12px;
  line-height: 1.45;
  flex-shrink: 0;
}

.token-missing-icon {
  flex-shrink: 0;
  font-size: 14px;
  line-height: 1.45;
}

.token-missing-text {
  flex: 1;
}

.token-missing-banner strong {
  color: #ffd0d0;
}

/* ── Home Selector Bar ── */
.home-selector-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background: #12122a;
  border-bottom: 1px solid #2a2a4a;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.home-selector-label {
  color: #9090c0;
  font-size: 13px;
  font-family: system-ui, sans-serif;
  white-space: nowrap;
}

.home-selector-select {
  background: #1c1c38;
  color: #d0d0f0;
  border: 1px solid #3a3a6a;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 13px;
  cursor: pointer;
  min-width: 180px;
}

.home-selector-select:hover {
  border-color: #6060a0;
}

.home-selector-hint {
  color: #6060a0;
  font-size: 12px;
  font-family: system-ui, sans-serif;
  font-style: italic;
}

.home-reload-btn {
  background: #2a2a5a;
  color: #a0a0d0;
  border: 1px solid #3a3a7a;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 13px;
  cursor: pointer;
  margin-left: auto;
  white-space: nowrap;
}

.home-reload-btn:hover:not(:disabled) {
  background: #3a3a7a;
  color: #d0d0ff;
}

.home-reload-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.home-dashboard-btn {
  background: #2a2a5a;
  color: #a0a0d0;
  border: 1px solid #3a3a7a;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.home-dashboard-btn:hover:not(:disabled) {
  background: #3a3a7a;
  color: #d0d0ff;
}

.home-dashboard-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

/* ── Add to Dashboard dialog ── */
.dashboard-dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dashboard-dialog {
  background: #161630;
  color: #d0d0f0;
  border: 1px solid #3a3a6a;
  border-radius: 8px;
  padding: 20px;
  width: 360px;
  max-width: 90vw;
  font-family: system-ui, sans-serif;
}

.dashboard-dialog h3 {
  margin: 0 0 14px;
  font-size: 15px;
  word-break: break-word;
}

.dashboard-dialog-label {
  display: block;
  font-size: 12px;
  color: #9090c0;
  margin: 10px 0 4px;
}

.dashboard-dialog-select {
  width: 100%;
  background: #1c1c38;
  color: #d0d0f0;
  border: 1px solid #3a3a6a;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 13px;
}

.dashboard-dialog-error {
  color: #ff8080;
  font-size: 13px;
}

.dashboard-dialog-loading {
  color: #a0a0d0;
  font-size: 13px;
}

.dashboard-dialog-fallback {
  width: 100%;
  height: 160px;
  margin-top: 10px;
  background: #0e0e1e;
  color: #c0c0e0;
  border: 1px solid #3a3a6a;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  resize: vertical;
}

.dashboard-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.dashboard-dialog-cancel,
.dashboard-dialog-confirm {
  border: none;
  border-radius: 4px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
}

.dashboard-dialog-cancel {
  background: #2a2a4a;
  color: #a0a0d0;
}

.dashboard-dialog-confirm {
  background: #4CAF50;
  color: white;
}

.dashboard-dialog-confirm:disabled {
  opacity: 0.4;
  cursor: default;
}

/* ── Unity content ── */
.unity-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #5050a0;
  font-family: system-ui, sans-serif;
  font-size: 14px;
}

.unity-frame {
  flex: 1;
  width: 100%;
  border: none;
  display: block;
}
</style>
