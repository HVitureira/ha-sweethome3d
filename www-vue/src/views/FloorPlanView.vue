<template>
  <!-- SweetHome3D renders into #home-pane (vanilla JS, outside Vue).
       Visibility is toggled by App.vue's route watcher. -->
</template>

<script lang="ts">
// Explicit name required so KeepAlive include="FloorPlanView" can match this component.
export default { name: 'FloorPlanView' }
</script>
