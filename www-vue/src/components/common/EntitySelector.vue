<template>
  <div class="entity-selector">
    <div class="entity-selector__input-wrap">
      <input
        ref="inputRef"
        type="text"
        size="50"
        :value="query"
        :placeholder="placeholder"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="onKeydown"
      />
      <span v-if="isLoading" class="entity-selector__status" title="Loading entities...">...</span>
      <button
        v-else-if="error"
        class="entity-selector__retry"
        :title="error"
        @mousedown.prevent="retryFetch"
      >&#9888;</button>
    </div>

    <div
      v-if="isOpen && filtered.length > 0"
      ref="dropdownRef"
      class="entity-selector__dropdown"
    >
      <div
        v-for="(entity, i) in filtered"
        :key="entity.entity_id"
        :ref="(el) => { if (i === highlightedIndex) activeOptionEl = el as HTMLElement | null }"
        :class="['entity-selector__option', { 'entity-selector__option--active': i === highlightedIndex }]"
        @mousedown.prevent="selectEntity(entity)"
        @mouseenter="highlightedIndex = i"
      >
        <span class="entity-selector__id">{{ entity.entity_id }}</span>
        <span v-if="entity.friendly_name" class="entity-selector__name">{{ entity.friendly_name }}</span>
      </div>
    </div>

    <!-- Empty/error message inside dropdown area -->
    <div v-else-if="isOpen && !isLoading && entities.length === 0 && error" class="entity-selector__dropdown entity-selector__message">
      {{ error }}
      <button class="entity-selector__retry-link" @mousedown.prevent="retryFetch">Retry</button>
    </div>

    <div v-if="hint" class="ha-hint">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { fetchEntities, type HAEntity } from '@/services/haApiService'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  hint?: string
}>(), {
  placeholder: '',
  hint: '',
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const query = ref(props.modelValue)
const entities = ref<HAEntity[]>([])
const isOpen = ref(false)
const isLoading = ref(false)
const error = ref<string | null>(null)
const highlightedIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const activeOptionEl = ref<HTMLElement | null>(null)

// Sync query when modelValue changes externally
watch(() => props.modelValue, (v) => { query.value = v })

const filtered = computed(() => {
  const q = query.value.toLowerCase().trim()
  const source = entities.value
  if (!q) return source.slice(0, 100)
  return source.filter(
    (e) => e.entity_id.includes(q) || e.friendly_name.toLowerCase().includes(q),
  ).slice(0, 100)
})

async function loadEntities(force = false) {
  isLoading.value = true
  error.value = null
  try {
    entities.value = await fetchEntities(force)
    error.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load entities'
  } finally {
    isLoading.value = false
  }
}

function onInput(e: Event) {
  query.value = (e.target as HTMLInputElement).value
  isOpen.value = true
  highlightedIndex.value = 0
}

function onFocus() {
  isOpen.value = true
  highlightedIndex.value = 0
  if (entities.value.length === 0) loadEntities()
}

function onBlur() {
  setTimeout(() => {
    isOpen.value = false
    if (query.value !== props.modelValue) {
      emit('update:modelValue', query.value)
    }
  }, 150)
}

function onKeydown(e: KeyboardEvent) {
  const list = filtered.value
  if (!isOpen.value || list.length === 0) {
    if (e.key === 'Enter') {
      emit('update:modelValue', query.value)
    }
    return
  }

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      highlightedIndex.value = (highlightedIndex.value + 1) % list.length
      scrollToActive()
      break
    case 'ArrowUp':
      e.preventDefault()
      highlightedIndex.value = (highlightedIndex.value - 1 + list.length) % list.length
      scrollToActive()
      break
    case 'Enter':
      e.preventDefault()
      selectEntity(list[highlightedIndex.value])
      break
    case 'Escape':
      isOpen.value = false
      break
  }
}

function selectEntity(entity: HAEntity) {
  query.value = entity.entity_id
  emit('update:modelValue', entity.entity_id)
  isOpen.value = false
}

function scrollToActive() {
  nextTick(() => {
    activeOptionEl.value?.scrollIntoView({ block: 'nearest' })
  })
}

async function retryFetch() {
  await loadEntities(true)
}

// Load eagerly on mount (should be cached from prefetch if it succeeded)
loadEntities()
</script>

<style scoped>
.entity-selector {
  position: relative;
}

.entity-selector__input-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
}

.entity-selector__status {
  font-size: 12px;
  color: #888;
}

.entity-selector__retry {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 0 2px;
  color: #c00;
}

.entity-selector__dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 9999;
  max-height: 240px; /* ~8 rows */
  overflow-y: auto;
  background: #fff;
  border: 1px solid #ccc;
  border-top: none;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  font-size: 13px;
}

.entity-selector__message {
  padding: 8px 10px;
  color: #888;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.entity-selector__retry-link {
  background: none;
  border: none;
  color: #0066cc;
  cursor: pointer;
  text-decoration: underline;
  font-size: 12px;
  padding: 0;
}

.entity-selector__option {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 4px 8px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
}

.entity-selector__option:hover,
.entity-selector__option--active {
  background: #e3f0ff;
}

.entity-selector__id {
  font-family: monospace;
  font-size: 12px;
  flex-shrink: 0;
}

.entity-selector__name {
  color: #888;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
