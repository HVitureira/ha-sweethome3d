<template>
  <Teleport v-if="dialogOpen && teleportTarget" :to="(teleportTarget as unknown as string)">
    <div class="ha-vue-enhancer">

      <!-- HA Entity ID — shown for all smart devices -->
      <template v-if="store.isSmartDevice">
        <div class="label-cell ha-only">
          <div>🏠 HA Entity ID:</div>
        </div>
        <div class="ha-only">
          <EntitySelector
            :model-value="store.haEntityId"
            placeholder="sensor.living_room_temperature"
            hint="Enter the Home Assistant entity_id for this smart device"
            @update:model-value="onEntityIdChange"
          />
        </div>

        <!-- Effect Radius -->
        <div class="ha-only ha-effect-radius-row">
          <div class="ha-effect-radius-label">
            📡 Effect Radius
          </div>
          <div class="ha-effect-radius-controls">
            <input
              type="range"
              min="0.5"
              max="15"
              step="0.5"
              :value="store.effectRadius"
              class="ha-range-input"
              @input="onRadiusInput"
            />
            <span class="ha-range-value">
              {{ store.effectRadius.toFixed(1) }}m
            </span>
          </div>
        </div>
      </template>

      <!-- Controls Entity ID + Switch Type — switch devices only -->
      <template v-if="store.isSwitchDevice">
        <div class="label-cell ha-switch-only">
          <div>🔗 Controls Entity ID:</div>
        </div>
        <div class="ha-switch-only">
          <EntitySelector
            :model-value="store.controlsEntityId"
            placeholder="light.bedroom_ceiling"
            hint="The light entity this switch controls (e.g., light.bedroom_ceiling)"
            @update:model-value="onControlsEntityChange"
          />
        </div>

        <div class="label-cell ha-switch-only">
          <div>⚡ Switch Type:</div>
        </div>
        <div class="ha-switch-only">
          <select
            class="ha-select"
            :value="store.switchType"
            @change="onSwitchTypeChange"
          >
            <option value="pressure">Pressure Switch (toggle + dimming)</option>
            <option value="fixed">Fixed Switch (toggle only)</option>
          </select>
          <div class="ha-hint">
            Pressure: long-press to dim. Regular: toggle only.
          </div>
        </div>
      </template>

    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useFurnitureDialog } from '@/composables/useFurnitureDialog'
import { useFurnitureStore } from '@/stores/furnitureStore'
import EntitySelector from '@/components/common/EntitySelector.vue'

const store = useFurnitureStore()
const { dialogOpen, teleportTarget } = useFurnitureDialog()

function onEntityIdChange(value: string): void {
  store.haEntityId = value
  store.commitProperty('haEntityId', value)
}

function onRadiusInput(e: Event): void {
  const value = parseFloat((e.target as HTMLInputElement).value)
  store.effectRadius = value
  store.commitProperty('effectRadius', String(value))
}

function onControlsEntityChange(value: string): void {
  store.controlsEntityId = value
  store.commitProperty('controlsEntityId', value)
}

function onSwitchTypeChange(e: Event): void {
  const value = (e.target as HTMLSelectElement).value as 'pressure' | 'fixed'
  store.switchType = value
  store.commitProperty('switchType', value)
}
</script>

<style scoped>
.ha-vue-enhancer {
  display: contents;
  pointer-events: auto;
}

.ha-hint {
  font-size: 0.85em;
  color: #666;
  margin-top: 0.3em;
}

.ha-effect-radius-row {
  grid-column: 1 / -1;
  margin-top: 15px;
}

.ha-effect-radius-label {
  color: #666;
  font-size: 12px;
  margin-bottom: 5px;
  font-weight: 500;
}

.ha-effect-radius-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ha-range-input {
  flex: 1;
  cursor: pointer;
  height: 6px;
}

.ha-range-value {
  min-width: 50px;
  text-align: right;
  font-family: monospace;
  font-weight: bold;
  color: #0066cc;
}

.ha-select {
  padding: 4px 8px;
  font-size: 14px;
}
</style>
