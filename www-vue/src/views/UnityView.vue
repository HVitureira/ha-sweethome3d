<template>
  <div class="unity-view">
    <div v-if="!iframeSrc" class="unity-placeholder">
      <p>Loading 3D Visualizer&hellip;</p>
    </div>
    <iframe
      v-show="iframeSrc"
      ref="iframeRef"
      class="unity-frame"
      :src="iframeSrc"
      allow="autoplay; fullscreen"
      title="Smart Home 3D Visualizer"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSettingsStore } from '@/stores/settingsStore'

defineOptions({ name: 'UnityView' })

const iframeRef = ref<HTMLIFrameElement | null>(null)
const iframeSrc = ref<string>('')
const hasLoaded = ref(false)
const route = useRoute()
const settingsStore = useSettingsStore()

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

onMounted(() => {
  writeConfigToStorage()
  iframeSrc.value = '/unity-visualizer/index.html'
  iframeRef.value?.addEventListener('load', () => {
    hasLoaded.value = true
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
}

.unity-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #5050a0;
  font-family: system-ui, sans-serif;
  font-size: 14px;
}

.unity-frame {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}
</style>
