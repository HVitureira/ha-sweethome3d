<template>
  <nav class="tab-bar">
    <RouterLink to="/"           class="tab-item">Floor Plan</RouterLink>
    <RouterLink to="/visualizer" class="tab-item">3D Visualizer</RouterLink>
    <RouterLink to="/settings"   class="tab-item">&#9881; Settings</RouterLink>
  </nav>
</template>

<script setup lang="ts">
// RouterLink handles active class automatically via Vue Router
</script>

<style scoped>
.tab-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: #1e1e2e;
  border-bottom: 2px solid #3a3a5c;
  display: flex;
  align-items: stretch;
  z-index: 2000;
  pointer-events: all;
  user-select: none;
  box-sizing: border-box;
}

.tab-item {
  display: flex;
  align-items: center;
  padding: 0 22px;
  color: #a0a0c0;
  text-decoration: none;
  font-size: 13px;
  font-family: system-ui, sans-serif;
  font-weight: 500;
  border-right: 1px solid #3a3a5c;
  white-space: nowrap;
  transition: background 0.12s, color 0.12s;
}

.tab-item:hover {
  background: #2a2a4a;
  color: #e0e0ff;
}

.tab-item.router-link-active {
  background: #2a2a4a;
  color: #7c9fff;
  box-shadow: inset 0 -2px 0 #7c9fff;
}
</style>
