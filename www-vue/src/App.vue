<template>
  <TabBar />

  <RouterView v-slot="{ Component }">
    <KeepAlive :include="['UnityView']">
      <component :is="Component" />
    </KeepAlive>
  </RouterView>

  <FurnitureDialogEnhancer />

  <ExportButtons v-if="route.path === '/'" />
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import TabBar from './components/layout/TabBar.vue'
import FurnitureDialogEnhancer from './components/dialogs/FurnitureDialogEnhancer.vue'
import ExportButtons from './components/ExportButtons.vue'

const route = useRoute()

// Toggle SweetHome3D pane visibility based on active tab.
// #home-pane is owned by vanilla JS outside Vue — direct DOM manipulation is required.
watch(
  () => route.path,
  (path) => {
    const pane = document.getElementById('home-pane')
    if (!pane) return
    pane.style.display = path === '/' ? '' : 'none'
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
