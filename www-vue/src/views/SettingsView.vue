<template>
  <div class="settings-view">
    <div class="settings-panel">
      <h2 class="settings-title">Home Assistant Settings</h2>

      <!-- Connection -->
      <section class="settings-section">
        <h3 class="section-title">Connection</h3>

        <label class="field">
          <span class="field-label">HA Server Address</span>
          <input
            v-model="local.homeAssistantAddress"
            type="text"
            class="field-input"
            placeholder="hv-ha.duckdns.org"
            autocomplete="off"
          />
        </label>

        <label class="field">
          <span class="field-label">Long-Lived Access Token</span>
          <textarea
            v-model="local.homeAssistantAccessToken"
            class="field-input token-textarea"
            rows="4"
            placeholder="Paste your Home Assistant long-lived access token here"
            autocomplete="off"
            spellcheck="false"
          />
          <span class="field-hint">Generate in HA &#8594; Profile &#8594; Long-Lived Access Tokens</span>
        </label>

        <label class="field checkbox-field">
          <input type="checkbox" v-model="local.useSSL" />
          <span>Use SSL (HTTPS / WSS)</span>
        </label>
      </section>

      <!-- Tracked Entities -->
      <section class="settings-section">
        <h3 class="section-title">Tracked Entities</h3>
        <label class="field">
          <span class="field-label">Entity IDs (one per line)</span>
          <textarea
            v-model="trackedEntitiesText"
            class="field-input"
            rows="6"
            placeholder="light.living_room&#10;sensor.temperature_1&#10;sensor.humidity_2"
            spellcheck="false"
          />
          <span class="field-hint">These entities will be monitored and visualized in the 3D view.</span>
        </label>
      </section>

      <!-- Visualization -->
      <section class="settings-section">
        <h3 class="section-title">Visualization</h3>

        <div class="field-row">
          <label class="field">
            <span class="field-label">Min Temperature (&#176;C)</span>
            <input type="number" v-model.number="local.minTemp"
              class="field-input" step="0.5" />
          </label>
          <label class="field">
            <span class="field-label">Max Temperature (&#176;C)</span>
            <input type="number" v-model.number="local.maxTemp"
              class="field-input" step="0.5" />
          </label>
        </div>

        <div class="field-row">
          <label class="field">
            <span class="field-label">Interpolation Power</span>
            <input type="number" v-model.number="local.interpolationPower"
              class="field-input" step="0.05" min="0.1" />
          </label>
          <label class="field">
            <span class="field-label">Update Interval (s)</span>
            <input type="number" v-model.number="local.updateInterval"
              class="field-input" step="0.1" min="0.1" />
          </label>
        </div>

        <div class="field-row">
          <label class="field">
            <span class="field-label">Max Particles</span>
            <input type="number" v-model.number="local.maxParticles"
              class="field-input" step="500" min="100" />
          </label>
          <label class="field checkbox-field" style="align-self: flex-end; padding-bottom: 4px;">
            <input type="checkbox" v-model="local.optimizeForWebGL" />
            <span>Optimize for WebGL</span>
          </label>
        </div>
      </section>

      <!-- Connection Tuning -->
      <section class="settings-section">
        <h3 class="section-title">Connection Tuning</h3>
        <div class="field-row">
          <label class="field">
            <span class="field-label">Reconnect Delay (s)</span>
            <input type="number" v-model.number="local.reconnectDelay"
              class="field-input" min="1" />
          </label>
          <label class="field">
            <span class="field-label">Max Reconnect Attempts</span>
            <input type="number" v-model.number="local.maxReconnectAttempts"
              class="field-input" min="1" />
          </label>
          <label class="field">
            <span class="field-label">Connection Timeout (s)</span>
            <input type="number" v-model.number="local.connectionTimeout"
              class="field-input" min="5" />
          </label>
        </div>
      </section>

      <!-- Actions -->
      <div class="settings-actions">
        <button class="btn btn--primary" @click="save">Save Settings</button>
        <button class="btn btn--secondary" @click="resetToDefaults">Reset to Defaults</button>
        <Transition name="fade">
          <span v-if="saved" class="save-feedback">&#10003; Saved</span>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useSettingsStore, type SmartHomeSettings } from '@/stores/settingsStore'

const store = useSettingsStore()
const saved = ref(false)

const local = reactive<SmartHomeSettings>({ ...store.settings })

const trackedEntitiesText = computed({
  get: () => local.trackedEntities.join('\n'),
  set: (val: string) => {
    local.trackedEntities = val.split('\n').map(s => s.trim()).filter(Boolean)
  },
})

watch(() => store.settings, (val) => Object.assign(local, val), { deep: true })

function save() {
  store.update({ ...local })
  saved.value = true
  setTimeout(() => { saved.value = false }, 2500)
}

function resetToDefaults() {
  store.reset()
  Object.assign(local, store.settings)
}
</script>

<style scoped>
.settings-view {
  position: fixed;
  top: 40px;
  left: 0;
  right: 0;
  bottom: 0;
  background: #1a1a2e;
  overflow-y: auto;
  pointer-events: all;
  z-index: 1500;
}

.settings-panel {
  max-width: 680px;
  margin: 0 auto;
  padding: 28px 20px 64px;
  color: #d0d0e8;
  font-family: system-ui, sans-serif;
}

.settings-title {
  color: #7c9fff;
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 24px;
}

.settings-section {
  background: #23233a;
  border: 1px solid #3a3a5c;
  border-radius: 8px;
  padding: 18px 20px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-title {
  color: #8090b8;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 4px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.field-row .field {
  flex: 1;
  min-width: 140px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: #9090b8;
  letter-spacing: 0.02em;
}

.field-hint {
  font-size: 11px;
  color: #6060a0;
}

.field-input {
  background: #12122a;
  border: 1px solid #3a3a5c;
  border-radius: 4px;
  color: #e0e0ff;
  padding: 7px 10px;
  font-size: 13px;
  font-family: 'Menlo', 'Consolas', monospace;
  transition: border-color 0.15s;
  box-sizing: border-box;
  width: 100%;
}

.token-textarea {
  resize: vertical;
  min-height: 80px;
}

.field-input:focus {
  outline: none;
  border-color: #7c9fff;
}

.checkbox-field {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #b0b8d0;
  cursor: pointer;
}

.checkbox-field input[type="checkbox"] {
  accent-color: #7c9fff;
  width: 15px;
  height: 15px;
  cursor: pointer;
}

.settings-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
}

.btn {
  padding: 9px 22px;
  border-radius: 5px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background 0.15s;
}

.btn--primary {
  background: #3a5fff;
  color: white;
}

.btn--primary:hover { background: #5070ff; }

.btn--secondary {
  background: transparent;
  color: #9090b8;
  border: 1px solid #3a3a5c;
}

.btn--secondary:hover { background: #23233a; }

.save-feedback {
  font-size: 13px;
  color: #4caf90;
  font-weight: 500;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.4s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
