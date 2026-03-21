<template>
  <FurnitureDialogEnhancer />
  <ExportButtons />
</template>

<script setup lang="ts">
import FurnitureDialogEnhancer from './components/dialogs/FurnitureDialogEnhancer.vue'
import ExportButtons from './components/ExportButtons.vue'
</script>

<style>
#vue-app {
  position: fixed;
  width: 0;
  height: 0;
  pointer-events: none;
  z-index: 1000;
}
</style>
