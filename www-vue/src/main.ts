import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { router } from './router'
import App from './App.vue'
import { prefetchEntities } from './services/haApiService'

createApp(App).use(createPinia()).use(router).mount('#vue-app')

// Eagerly fetch HA entities so the selector dropdown is instant
prefetchEntities()
