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

.ha-select {
  padding: 4px 8px;
  font-size: 14px;
}
</style>
