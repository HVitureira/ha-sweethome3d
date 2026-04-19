<template>
  <div class="unity-view">
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSettingsStore } from '@/stores/settingsStore'

defineOptions({ name: 'UnityView' })

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

function sendLoadHome(homeId: string) {
  if (!iframeRef.value?.contentWindow) return
  iframeRef.value.contentWindow.postMessage(
    {
      type: 'LOAD_HOME',
      homeId,
      baseUrl: window.location.origin + window.location.pathname.replace(/\/[^/]*$/, ''),
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
      homes.value = await resp.json()
      // Default to the currently open SH3D home if possible
      const currentName: string =
        (window as any).application?.getHomes?.()[0]?.getName?.() ?? ''
      const match = homes.value.find(h => h.id === currentName)
      selectedHomeId.value = match?.id ?? homes.value[0]?.id ?? ''
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

watch(() => route.path, (path) => {
  if (path === '/visualizer' && hasLoaded.value) {
    writeConfigToStorage()
    sendConfigToIframe()
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
