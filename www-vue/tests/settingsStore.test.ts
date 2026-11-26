import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

// Minimal browser globals for Node test environment
const storageMap = new Map<string, string>()
const mockLocalStorage = {
  getItem: (k: string) => storageMap.get(k) ?? null,
  setItem: (k: string, v: string) => { storageMap.set(k, String(v)) },
  removeItem: (k: string) => { storageMap.delete(k) },
  clear: () => { storageMap.clear() },
}
vi.stubGlobal('localStorage', mockLocalStorage)
vi.stubGlobal('window', { location: { pathname: '/', host: 'localhost:8099', protocol: 'http:' } })
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

import { useSettingsStore } from '../src/stores/settingsStore'

describe('settingsStore -> Unity ConfigurationData contract', () => {
  beforeEach(() => {
    storageMap.clear()
    setActivePinia(createPinia())
  })

  it('emits flat toUnityConfig() keys matching C# ConfigurationData', () => {
    const store = useSettingsStore()
    store.update({
      homeAssistantAddress: 'homeassistant.local:8123',
      homeAssistantAccessToken: 'test-token',
      useSSL: false,
      minTemp: 16,
      maxTemp: 32,
      trackedEntities: ['sensor.living_room_temperature'],
    })

    const cfg = store.toUnityConfig()
    expect(cfg).toMatchObject({
      homeAssistantAddress: 'homeassistant.local:8123',
      homeAssistantAccessToken: 'test-token',
      useSSL: false,
      minTemp: 16,
      maxTemp: 32,
      trackedEntities: ['sensor.living_room_temperature'],
      sensorTopics: [],
      optimizeForWebGL: true,
    })

    // Ensure every expected top-level key exists
    for (const key of [
      'sensorBridgeType',
      'forceHomeAssistantInEditor',
      'brokerIP',
      'brokerPort',
      'useWebSockets',
      'updateInterval',
      'maxParticles',
      'interpolationPower',
      'reconnectDelay',
      'maxReconnectAttempts',
      'connectionTimeout',
    ]) {
      expect(cfg).toHaveProperty(key)
    }
  })

  it('auto-persists updates to localStorage and restores defaults on reset()', async () => {
    const store = useSettingsStore()
    store.update({ maxParticles: 2500 })
    await nextTick()

    const saved = JSON.parse(storageMap.get('ha-smart-home-settings') ?? '{}')
    expect(saved.maxParticles).toBe(2500)

    store.reset()
    expect(store.settings.maxParticles).toBe(5000)
    expect(store.settings.minTemp).toBe(18)
  })
})
