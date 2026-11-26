import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as vm from 'node:vm'

function loadUnityExportUtilities() {
  const filePath = path.resolve(__dirname, '../../sweethome3d/www/lib/unity-export-utils.js')
  const source = fs.readFileSync(filePath, 'utf-8')
  const sandbox: Record<string, unknown> = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    window: {},
    Math,
    Date,
    JSON,
    Blob,
  }
  vm.runInNewContext(`${source}\nthis.UnityExportUtilities = UnityExportUtilities;`, sandbox)
  return sandbox.UnityExportUtilities as {
    extractDeviceMetadata: (home: unknown) => {
      version: string
      devices: Array<Record<string, unknown>>
      rooms: Array<Record<string, unknown>>
      walls: Array<Record<string, unknown>>
    }
  }
}

describe('unity-export-utils.js -> smart-home-visualizer JSON contract', () => {
  it('filters IoT devices, converts cm -> meters with SH3D Y -> Unity Z, and preserves switch wiring', () => {
    const UnityExportUtilities = loadUnityExportUtilities()

    const makePiece = (opts: {
      catalogId: string
      name: string
      x: number
      y: number
      elev: number
      props?: Record<string, string>
    }) => ({
      getCatalogId: () => opts.catalogId,
      getName: () => opts.name,
      getX: () => opts.x,
      getY: () => opts.y,
      getElevation: () => opts.elev,
      getAngle: () => Math.PI / 2,
      getWidth: () => 5,
      getDepth: () => 5,
      getHeight: () => 8,
      getProperty: (k: string) => opts.props?.[k] ?? null,
    })

    const mockHome = {
      getFurniture: () => [
        // Ordinary furniture — MUST be excluded
        makePiece({ catalogId: 'sh3d_sofa', name: 'Sofa', x: 100, y: 200, elev: 0 }),
        // Temperature sensor — MUST be exported in meters (SH3D Y -> Unity Z)
        makePiece({
          catalogId: 'ha_sensor_temperature',
          name: 'Living Room Temp',
          x: 500,
          y: 300,
          elev: 150,
          props: { haEntityId: 'sensor.living_room_temp' },
        }),
        // Pressure switch — MUST preserve controlsEntityId & switchType
        makePiece({
          catalogId: 'ha_switch_pressure',
          name: 'Bedroom Switch',
          x: 200,
          y: 400,
          elev: 120,
          props: {
            haEntityId: 'switch.bedroom_wall',
            controlsEntityId: 'light.bedroom_ceiling',
            switchType: 'pressure',
          },
        }),
      ],
      getRooms: () => [],
      getWalls: () => [],
    }

    const exported = UnityExportUtilities.extractDeviceMetadata(mockHome)
    expect(exported.devices).toHaveLength(2)

    const sensor = exported.devices[0] as Record<string, any>
    expect(sensor.isIoTDevice).toBe(true)
    expect(sensor.haEntityId).toBe('sensor.living_room_temp')
    expect(sensor.position).toEqual({ x: 5, y: 1.5, z: 3 })
    expect(sensor.dimensions).toEqual({ width: 0.05, height: 0.08, depth: 0.05 })
    expect(sensor.rotation.y).toBeCloseTo(90, 5)

    const sw = exported.devices[1] as Record<string, any>
    expect(sw.haEntityId).toBe('switch.bedroom_wall')
    expect(sw.controlsEntityId).toBe('light.bedroom_ceiling')
    expect(sw.switchType).toBe('pressure')
    expect(sw.position).toEqual({ x: 2, y: 1.2, z: 4 })
  })
})
