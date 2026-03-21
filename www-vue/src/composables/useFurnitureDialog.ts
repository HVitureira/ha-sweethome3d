import { ref, onMounted, onUnmounted } from 'vue'
import { getFurnitureController } from '@/services/furnitureService'
import { useFurnitureStore } from '@/stores/furnitureStore'

export function useFurnitureDialog() {
  const store = useFurnitureStore()
  const dialogOpen = ref(false)
  const teleportTarget = ref<HTMLElement | null>(null)

  let observer: MutationObserver | null = null

  function isLiveDialog(el: Node): el is HTMLElement {
    return (
      el instanceof HTMLElement &&
      el.classList.contains('home-furniture-dialog') &&
      el.closest('.dialog-template') === null
    )
  }

  function onDialogOpened(liveDialog: HTMLElement): void {
    const controller = getFurnitureController()
    if (!controller) return
    store.loadFromController(controller)
    const grid = liveDialog.querySelector<HTMLElement>('[data-name="name-and-price-panel"]')
    teleportTarget.value = grid
    dialogOpen.value = true
  }

  function onDialogClosed(): void {
    store.flushPendingProps()
    store.reset()
    teleportTarget.value = null
    dialogOpen.value = false
  }

  function handleMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (isLiveDialog(node)) {
          onDialogOpened(node)
          return
        }
        if (node instanceof HTMLElement) {
          const nested = node.querySelector<HTMLElement>('.home-furniture-dialog')
          if (nested && nested.closest('.dialog-template') === null) {
            onDialogOpened(nested)
            return
          }
        }
      }
      for (const node of mutation.removedNodes) {
        if (isLiveDialog(node)) {
          onDialogClosed()
          return
        }
        if (node instanceof HTMLElement && node.querySelector('.home-furniture-dialog')) {
          if (dialogOpen.value) {
            onDialogClosed()
            return
          }
        }
      }
    }
  }

  onMounted(() => {
    observer = new MutationObserver(handleMutations)
    observer.observe(document.body, { childList: true, subtree: true })
  })

  onUnmounted(() => {
    observer?.disconnect()
    observer = null
  })

  return { dialogOpen, teleportTarget }
}
