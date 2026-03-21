const IOT_KEYWORDS = ['sensor', 'camera', 'dimmer', 'thermostat', 'motion', 'lock', 'plug', 'bulb', 'hub']

export function resolveCatalogId(furniture: SH3DFurniture): string | null {
  try {
    const direct = furniture.getCatalogId?.()
    if (direct) return direct

    if (furniture.properties?.catalogId) return furniture.properties.catalogId

    const prop = furniture.getProperty?.('catalogId')
    if (prop) return prop

    const entries = furniture.getAdditionalProperties?.()?.entries
    if (entries) {
      for (const entry of entries) {
        if (entry.getKey?.() === 'catalogId') {
          const val = entry.getValue?.()
          if (val) return val
        }
      }
    }

    const pieceId = furniture.getCatalogPieceOfFurniture?.()?.getId?.()
    if (pieceId) return pieceId
  } catch {
    // untyped SH3D object — ignore
  }
  return null
}

export function isSmartDeviceFurniture(furniture: SH3DFurniture): boolean {
  try {
    const catalogId = resolveCatalogId(furniture)
    if (catalogId?.startsWith('ha_')) return true

    if (furniture.creator === 'HA') return true

    const categoryName = furniture.getCategory?.()?.getName?.()?.toLowerCase() ?? ''
    if (categoryName.includes('smart')) return true

    const name = furniture.getName?.()?.toLowerCase() ?? ''
    const id = catalogId?.toLowerCase() ?? ''
    if (IOT_KEYWORDS.some(kw => name.includes(kw) || id.includes(kw))) return true
  } catch {
    // ignore
  }
  return false
}

export function isSwitchFurniture(furniture: SH3DFurniture): boolean {
  try {
    const catalogId = resolveCatalogId(furniture)
    if (!catalogId) return false
    return catalogId.startsWith('ha_switch') || catalogId === 'ha_light_dimmer'
  } catch {
    return false
  }
}
