<template>
  <TabBar />

  <RouterView v-slot="{ Component }">
    <KeepAlive>
      <component :is="Component" v-if="route.path !== '/visualizer'" />
    </KeepAlive>
  </RouterView>

  <!-- Always mounted, hidden via CSS — iframe never leaves the DOM so Unity doesn't reload -->
  <UnityView v-show="route.path === '/visualizer'" />

  <FurnitureDialogEnhancer />

  <ExportButtons v-if="route.path === '/'" />
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import TabBar from './components/layout/TabBar.vue'
import UnityView from './views/UnityView.vue'
import FurnitureDialogEnhancer from './components/dialogs/FurnitureDialogEnhancer.vue'
import ExportButtons from './components/ExportButtons.vue'
const route = useRoute()

// Toggle SweetHome3D pane visibility based on active tab.
// #home-pane is owned by vanilla JS outside Vue — direct DOM manipulation is required.
// Using visibility+position instead of display:none to preserve SweetHome3D's internal
// layout dimensions. display:none collapses elements to 0px, breaking splitter state.
watch(
  () => route.path,
  (path) => {
    const pane = document.getElementById('home-pane')
    if (!pane) return
    if (path === '/') {
      pane.style.visibility = ''
      pane.style.position = ''
      pane.style.pointerEvents = ''
      // Trigger resize so SweetHome3D recalculates splitter/canvas layout
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
    } else {
      pane.style.visibility = 'hidden'
      pane.style.position = 'absolute'
      pane.style.pointerEvents = 'none'
    }
  },
  { immediate: true },
)
</script>

<style>
/* #vue-app stays zero-size so it never blocks SweetHome3D interactions.
   Child views use position:fixed to escape the zero-size container. */
#vue-app {
  position: fixed;
  width: 0;
  height: 0;
  pointer-events: none;
  z-index: 1000;
}
</style>
