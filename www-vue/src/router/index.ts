import { createRouter, createWebHashHistory } from 'vue-router'
import FloorPlanView from '@/views/FloorPlanView.vue'
import UnityView from '@/views/UnityView.vue'
import SettingsView from '@/views/SettingsView.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/',           component: FloorPlanView },
    { path: '/visualizer', component: UnityView },
    { path: '/settings',   component: SettingsView },
  ],
})
