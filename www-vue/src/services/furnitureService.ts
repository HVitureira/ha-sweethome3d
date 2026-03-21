export function getFurnitureController(): SH3DFurniture | null {
  try {
    return window.application.getHomes()[0].getSelectedItems()[0] ?? null
  } catch {
    return null
  }
}

export function getCustomProperty(controller: SH3DFurniture, key: string): string | null {
  try {
    return controller.getProperty?.(key) ?? null
  } catch {
    return null
  }
}

export function setCustomProperty(controller: SH3DFurniture, key: string, value: string): void {
  try {
    controller.setProperty?.(key, value || null)
  } catch {
    // ignore
  }
}

export function getHAEntityId(furniture: SH3DFurniture): string {
  return getCustomProperty(furniture, 'haEntityId') ?? ''
}

export function setHAEntityId(controller: SH3DFurniture, value: string): void {
  setCustomProperty(controller, 'haEntityId', value)
}
