import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'ha-smart-home-settings'

export interface SmartHomeSettings {
  // ── Home Assistant ──────────────────────────────
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

  // ── Visualization ────────────────────────────────
  minTemp: number
  maxTemp: number
  interpolationPower: number
  updateInterval: number
  maxParticles: number
  optimizeForWebGL: boolean

  // ── Connection ───────────────────────────────────
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

  // Auto-persist on every change
  watch(settings, (val) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
  }, { deep: true })

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

  return { settings, update, reset, toUnityConfig }
})
