interface SH3DCategory {
  getName?(): string
}

interface SH3DAdditionalPropertyEntry {
  getKey?(): string
  getValue?(): string
}

interface SH3DAdditionalProperties {
  entries?: SH3DAdditionalPropertyEntry[]
}

interface SH3DCatalogPiece {
  getId?(): string
}

interface SH3DFurniture {
  getCatalogId?(): string
  getName?(): string
  getX?(): number
  getY?(): number
  getProperty?(key: string): string | null
  setProperty?(key: string, value: string | null): void
  getPropertyNames?(): string[]
  getCategory?(): SH3DCategory | null
  getAdditionalProperties?(): SH3DAdditionalProperties | null
  getCatalogPieceOfFurniture?(): SH3DCatalogPiece | null
  creator?: string
  properties?: Record<string, string>
}

interface SH3DHome {
  getSelectedItems(): SH3DFurniture[]
}

interface SH3DApplication {
  getHomes(): SH3DHome[]
}

interface Window {
  application: SH3DApplication
  homeComponent3D?: unknown
}
