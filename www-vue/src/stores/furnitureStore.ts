import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { isSmartDeviceFurniture, isSwitchFurniture } from '@/utils/deviceDetection'
import { getCustomProperty, setCustomProperty } from '@/services/furnitureService'

export const useFurnitureStore = defineStore('furniture', () => {
  const activeController = ref<SH3DFurniture | null>(null)
  const haEntityId = ref('')
  const effectRadius = ref(3.0)
  const controlsEntityId = ref('')
  const switchType = ref<'pressure' | 'fixed'>('fixed')
  const pendingProps = ref<Record<string, string>>({})

  const isSmartDevice = computed(() =>
    activeController.value ? isSmartDeviceFurniture(activeController.value) : false,
  )
  const isSwitchDevice = computed(() =>
    activeController.value ? isSwitchFurniture(activeController.value) : false,
  )

  function loadFromController(controller: SH3DFurniture): void {
    activeController.value = controller
    haEntityId.value = getCustomProperty(controller, 'haEntityId') ?? ''
    effectRadius.value = parseFloat(getCustomProperty(controller, 'effectRadius') ?? '3.0')
    controlsEntityId.value = getCustomProperty(controller, 'controlsEntityId') ?? ''
    const storedType = getCustomProperty(controller, 'switchType')
    switchType.value = storedType === 'pressure' ? 'pressure' : 'fixed'
    pendingProps.value = {}
  }

  function commitProperty(key: string, value: string): void {
    if (!activeController.value) return
    setCustomProperty(activeController.value, key, value)
    pendingProps.value[key] = value
  }

  function flushPendingProps(): void {
    if (!activeController.value) return
    for (const [key, value] of Object.entries(pendingProps.value)) {
      setCustomProperty(activeController.value, key, value)
    }
  }

  function reset(): void {
    activeController.value = null
    haEntityId.value = ''
    effectRadius.value = 3.0
    controlsEntityId.value = ''
    switchType.value = 'fixed'
    pendingProps.value = {}
  }

  return {
    activeController,
    haEntityId,
    effectRadius,
    controlsEntityId,
    switchType,
    pendingProps,
    isSmartDevice,
    isSwitchDevice,
    loadFromController,
    commitProperty,
    flushPendingProps,
    reset,
  }
})
