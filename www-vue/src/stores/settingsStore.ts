import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'ha-smart-home-settings'

export interface SmartHomeSettings {
  // ── Home Assistant (from addon options / ha-config.json) ──
  homeAssistantAddress: string
  homeAssistantAccessToken: string
  useSSL: boolean
  trackedEntities: string[]

  // ── MQTT (secondary) ────────────────────────────
  brokerIP: string
  brokerPort: number
  mqttUsername: string
  mqttPassword: string
  useWebSockets: boolean

  // ── Visualization (user-configurable in Settings tab) ──
  minTemp: number
  maxTemp: number
  interpolationPower: number
  updateInterval: number
  maxParticles: number
  optimizeForWebGL: boolean

  // ── Connection tuning (user-configurable in Settings tab) ──
  reconnectDelay: number
  maxReconnectAttempts: number
  connectionTimeout: number

  // ── Bridge ───────────────────────────────────────
  sensorBridgeType: number        // 0=Auto, 1=MQTT, 2=HomeAssistant
  forceHomeAssistantInEditor: boolean
}

const DEFAULTS: SmartHomeSettings = {
  homeAssistantAddress: '',
  homeAssistantAccessToken: '',
  useSSL: true,
  trackedEntities: [],

  brokerIP: '',
  brokerPort: 1883,
  mqttUsername: '',
  mqttPassword: '',
  useWebSockets: true,

  minTemp: 18,
  maxTemp: 35,
  interpolationPower: 3.95,
  updateInterval: 0.5,
  maxParticles: 5000,
  optimizeForWebGL: true,

  reconnectDelay: 5,
  maxReconnectAttempts: 10,
  connectionTimeout: 30,

  sensorBridgeType: 0,
  forceHomeAssistantInEditor: false,
}

interface AddonConfig {
  homeAssistantAddress?: string
  homeAssistantAccessToken?: string
  useSSL?: boolean
  trackedEntities?: string[]
  source?: string
}

function loadFromStorage(): SmartHomeSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<SmartHomeSettings>(loadFromStorage())
  const addonConfigLoaded = ref(false)

  let resolveConfigReady: () => void
  const configReady = new Promise<void>((resolve) => {
    resolveConfigReady = resolve
  })

  // Auto-persist on every change
  watch(settings, (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
  }, { deep: true })

  async function initFromAddonConfig(): Promise<void> {
    try {
      const resp = await fetch('ha-config.json')
      if (!resp.ok) {
        resolveConfigReady!()
        return
      }
      const addon: AddonConfig = await resp.json()
      if (addon.source !== 'addon-options') {
        resolveConfigReady!()
        return
      }

      const s = settings.value

      // Connection fields always come from addon config (overwrite localStorage)
      if (addon.homeAssistantAddress) {
        s.homeAssistantAddress = addon.homeAssistantAddress
      }
      if (addon.homeAssistantAccessToken) {
        s.homeAssistantAccessToken = addon.homeAssistantAccessToken
      }
      if (addon.useSSL !== undefined) {
        s.useSSL = addon.useSSL
      }
      if (addon.trackedEntities && addon.trackedEntities.length > 0) {
        s.trackedEntities = addon.trackedEntities
      }

      // Auto-detect HA address when running in ingress and not configured
      if (!s.homeAssistantAddress && window.location.pathname.includes('/api/hassio_ingress/')) {
        s.homeAssistantAddress = window.location.host
        s.useSSL = window.location.protocol === 'https:'
      }

      addonConfigLoaded.value = true
    } catch {
      // Standalone or dev mode — no ha-config.json, that's fine
    }
    resolveConfigReady!()
  }

  // Start loading addon config immediately
  initFromAddonConfig()

  function update(patch: Partial<SmartHomeSettings>): void {
    settings.value = { ...settings.value, ...patch }
  }

  function reset(): void {
    settings.value = { ...DEFAULTS }
  }

  // Returns flat object matching Unity's ConfigurationData struct
  function toUnityConfig(): Record<string, unknown> {
    const s = settings.value
    return {
      sensorBridgeType: s.sensorBridgeType,
      forceHomeAssistantInEditor: s.forceHomeAssistantInEditor,
      brokerIP: s.brokerIP,
      brokerPort: s.brokerPort,
      mqttUsername: s.mqttUsername,
      mqttPassword: s.mqttPassword,
      useWebSockets: s.useWebSockets,
      sensorTopics: [],
      homeAssistantAddress: s.homeAssistantAddress,
      homeAssistantAccessToken: s.homeAssistantAccessToken,
      useSSL: s.useSSL,
      trackedEntities: s.trackedEntities,
      updateInterval: s.updateInterval,
      maxParticles: s.maxParticles,
      optimizeForWebGL: s.optimizeForWebGL,
      minTemp: s.minTemp,
      maxTemp: s.maxTemp,
      interpolationPower: s.interpolationPower,
      reconnectDelay: s.reconnectDelay,
      maxReconnectAttempts: s.maxReconnectAttempts,
      connectionTimeout: s.connectionTimeout,
    }
  }

  return { settings, update, reset, toUnityConfig, addonConfigLoaded, configReady }
})
