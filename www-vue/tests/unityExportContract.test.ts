import { describe, it, expect, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as vm from 'node:vm'

interface LoadedExporters {
  UnityExportUtilities: {
    normalizeBaseName: (name: unknown) => string
    resolveCatalogId: (piece: unknown) => string | null
    isIoTDevice: (catalogId: string | null, piece: unknown) => boolean
    getDeviceType: (catalogId: string | null, piece: unknown) => string
    toPascalCase: (str: unknown) => string
    extractDeviceMetadata: (home: unknown) => {
      version: string
      devices: Array<Record<string, any>>
      rooms: Array<Record<string, any>>
      walls: Array<Record<string, any>>
    }
    exportForUnity: (
      home: unknown,
      component3D: unknown,
      baseName?: unknown,
      options?: { download?: boolean },
    ) => Promise<{
      success: boolean
      baseName: string
      devices: number
      rooms: number
      geometry: { vertices: number; faces: number; blob: Blob; filename: string }
      files: Array<{ name: string; blob: Blob }>
    }>
  }
  OBJExporter: new () => any
  sandboxWindow: Record<string, any>
  createObjectURLSpy: ReturnType<typeof vi.fn>
}

function loadExporters(overrides: Record<string, unknown> = {}): LoadedExporters {
  const objExporterPath = path.resolve(__dirname, '../../sweethome3d/www/lib/objExporter.js')
  const unityUtilsPath = path.resolve(__dirname, '../../sweethome3d/www/lib/unity-export-utils.js')
  const objSource = fs.readFileSync(objExporterPath, 'utf-8')
  const unitySource = fs.readFileSync(unityUtilsPath, 'utf-8')

  const createObjectURLSpy = vi.fn(() => 'blob:mock-url')
  const revokeObjectURLSpy = vi.fn()
  const sandboxWindow: Record<string, any> = {}

  class MockJSZip {
    files: Record<string, unknown> = {}
    constructor(_buf?: ArrayBuffer) {}
    file(arg: string | RegExp, content?: unknown) {
      if (arg instanceof RegExp) {
        return Object.entries(this.files).map(([name, val]) => ({
          name,
          asText: () => String(val),
          asUint8Array: () => new Uint8Array(),
        }))
      }
      this.files[arg] = content
      return this
    }
    generate() {
      return new Blob(['mock-zip-bytes'], { type: 'application/zip' })
    }
  }

  const sandbox: Record<string, unknown> = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    window: sandboxWindow,
    Math,
    Date,
    JSON,
    Blob,
    Map,
    Set,
    Uint8Array,
    ArrayBuffer,
    Promise,
    Error,
    RegExp,
    parseFloat,
    parseInt,
    isNaN,
    setTimeout,
    clearTimeout,
    AbortController,
    URL: {
      createObjectURL: createObjectURLSpy,
      revokeObjectURL: revokeObjectURLSpy,
    },
    JSZip: MockJSZip,
    ...overrides,
  }

  vm.runInNewContext(
    `${objSource}\n${unitySource}\nthis.OBJExporter = OBJExporter;\nthis.UnityExportUtilities = UnityExportUtilities;`,
    sandbox,
  )

  return {
    UnityExportUtilities: sandbox.UnityExportUtilities as LoadedExporters['UnityExportUtilities'],
    OBJExporter: sandbox.OBJExporter as LoadedExporters['OBJExporter'],
    sandboxWindow,
    createObjectURLSpy,
  }
}

const makePiece = (opts: {
  catalogId?: string | null
  name?: string | null
  creator?: string | null
  x?: number
  y?: number
  elev?: number
  props?: Record<string, string>
  modelUrl?: string | null
}) => ({
  getCatalogId: () => opts.catalogId ?? null,
  getName: () => (opts.name === undefined ? 'Unnamed' : opts.name),
  getCreator: () => opts.creator ?? null,
  getX: () => opts.x ?? 0,
  getY: () => opts.y ?? 0,
  getElevation: () => opts.elev ?? 0,
  getAngle: () => Math.PI / 2,
  getWidth: () => 5,
  getDepth: () => 5,
  getHeight: () => 8,
  getProperty: (k: string) => opts.props?.[k] ?? null,
  getModel: () => (opts.modelUrl ? { getURL: () => opts.modelUrl } : null),
})

describe('unity-export-utils.js -> smart-home-visualizer JSON contract', () => {
  it('filters IoT devices, converts cm -> meters with SH3D Y -> Unity Z, and preserves switch wiring', () => {
    const { UnityExportUtilities } = loadExporters()

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

    const sensor = exported.devices[0]
    expect(sensor.isIoTDevice).toBe(true)
    expect(sensor.haEntityId).toBe('sensor.living_room_temp')
    expect(sensor.position).toEqual({ x: 5, y: 1.5, z: 3 })
    expect(sensor.dimensions).toEqual({ width: 0.05, height: 0.08, depth: 0.05 })
    expect(sensor.rotation.y).toBeCloseTo(90, 5)

    const sw = exported.devices[1]
    expect(sw.haEntityId).toBe('switch.bedroom_wall')
    expect(sw.controlsEntityId).toBe('light.bedroom_ceiling')
    expect(sw.switchType).toBe('pressure')
    expect(sw.position).toEqual({ x: 2, y: 1.2, z: 4 })
  })

  it('detects renamed HA devices whose catalogId is stored as a custom property (quarto5.sh3x structure)', () => {
    const { UnityExportUtilities } = loadExporters()

    const mockHome = {
      getFurniture: () => [
        // Exact SH3D behavior: getCatalogId() === null, catalogId stored in getProperty('catalogId')
        makePiece({
          catalogId: null,
          name: 'Candeeiro Sala', // Portuguese name with no English keywords
          creator: 'HA',
          props: {
            catalogId: 'ha_light_bulb',
            haEntityId: 'light.living_room',
          },
        }),
        makePiece({
          catalogId: null,
          name: 'Quarto 1', // Renamed temperature sensor
          creator: 'HA',
          props: {
            catalogId: 'ha_sensor_temp_humidity',
            haEntityId: 'sensor.bedroom_temp',
          },
        }),
        makePiece({
          catalogId: null,
          name: null, // Null name must never crash .toLowerCase()
          creator: 'HA',
          props: { catalogId: 'ha_switch_regular' },
        }),
      ],
      getRooms: () => [],
      getWalls: () => [],
    }

    const exported = UnityExportUtilities.extractDeviceMetadata(mockHome)
    expect(exported.devices).toHaveLength(3)

    expect(exported.devices[0]).toMatchObject({
      name: 'Candeeiro Sala',
      catalogId: 'ha_light_bulb',
      type: 'light',
      haEntityId: 'light.living_room',
    })
    expect(exported.devices[1]).toMatchObject({
      name: 'Quarto 1',
      catalogId: 'ha_sensor_temp_humidity',
      type: 'temperature_sensor',
    })
    expect(exported.devices[2]).toMatchObject({
      name: 'Device 2',
      catalogId: 'ha_switch_regular',
      type: 'switch',
    })
  })

  it('maps all 12 DefaultFurnitureCatalog.json HA devices to exact Unity DeviceCategory types even when renamed', () => {
    const { UnityExportUtilities } = loadExporters()

    const expectedTypes: Array<[string, string]> = [
      ['ha_sensor_temperature', 'temperature_sensor'],
      ['ha_sensor_humidity', 'humidity_sensor'],
      ['ha_sensor_temp_humidity', 'temperature_sensor'],
      ['ha_sensor_motion', 'motion_sensor'],
      ['ha_sensor_light', 'light_sensor'],
      ['ha_sensor_motion_light', 'motion_sensor'],
      ['ha_light_bulb', 'light'],
      ['ha_light_ceiling', 'light'],
      ['ha_light_dimmer', 'dimmer'],
      ['ha_switch_plug', 'smart_plug'],
      ['ha_switch_regular', 'switch'],
      ['ha_switch_pressure', 'switch'],
    ]

    for (const [catalogId, expectedType] of expectedTypes) {
      const renamedPiece = makePiece({
        catalogId: null,
        name: 'Custom Label',
        creator: 'HA',
        props: { catalogId },
      })
      expect(UnityExportUtilities.isIoTDevice(null, renamedPiece)).toBe(true)
      expect(UnityExportUtilities.getDeviceType(null, renamedPiece)).toBe(expectedType)
    }
  })

  it('flattens HomeFurnitureGroup items and handles null wall.getHeight() with home.getWallHeight() fallback', () => {
    const { UnityExportUtilities } = loadExporters()

    const groupedSensor = makePiece({
      catalogId: null,
      name: 'Nested Sensor',
      creator: 'HA',
      x: 300,
      y: 400,
      elev: 100,
      props: { catalogId: 'ha_sensor_humidity', haEntityId: 'sensor.bath_humidity' },
    })

    const mockHome = {
      getWallHeight: () => 280,
      getFurniture: () => [
        {
          getName: () => 'Group 1',
          getFurniture: () => [groupedSensor],
        },
      ],
      getRooms: () => [],
      getWalls: () => [
        {
          getXStart: () => 0,
          getYStart: () => 0,
          getXEnd: () => 400,
          getYEnd: () => 0,
          getHeight: () => null, // SH3D default height inheritance
          getThickness: () => null,
        },
      ],
    }

    const exported = UnityExportUtilities.extractDeviceMetadata(mockHome)
    expect(exported.devices).toHaveLength(1)
    expect(exported.devices[0].type).toBe('humidity_sensor')
    expect(exported.walls[0].height).toBeCloseTo(2.8, 5)
    expect(exported.walls[0].thickness).toBeCloseTo(0.1, 5)
  })

  it('exports blobs directly when download:false and handles null/empty/.sh3x baseName without crashing', async () => {
    const { UnityExportUtilities, sandboxWindow, createObjectURLSpy } = loadExporters()

    // Verify OBJExporter attaches to window without obj-exporter-integration.js
    expect(typeof sandboxWindow.OBJExporter).toBe('function')

    const mockHome = {
      getName: () => null,
      getWallHeight: () => 250,
      getWalls: () => [
        {
          getXStart: () => 0,
          getYStart: () => 0,
          getXEnd: () => 300,
          getYEnd: () => 0,
          getHeight: () => null, // Must NOT crash v[1].toFixed()
          getThickness: () => 10,
        },
      ],
      getRooms: () => [],
      getFurniture: () => [
        makePiece({
          catalogId: null,
          name: 'Quarto Luz',
          creator: 'HA',
          props: { catalogId: 'ha_light_bulb', haEntityId: 'light.quarto' },
        }),
      ],
    }

    // baseName = null must fall back to 'smart-home' cleanly
    const resNull = await UnityExportUtilities.exportForUnity(mockHome, null, null, { download: false })
    expect(resNull.success).toBe(true)
    expect(resNull.baseName).toBe('smart-home')
    expect(resNull.devices).toBe(1)
    expect(resNull.files.map(f => f.name)).toEqual([
      'smart-home_geometry.zip',
      'smart-home_devices.json',
      'smart-home_Import.cs',
    ])
    expect(createObjectURLSpy).not.toHaveBeenCalled()

    // baseName with .sh3x extension & slash must be normalized
    const resSh3x = await UnityExportUtilities.exportForUnity(mockHome, null, 'floor1/quarto5.sh3x', {
      download: false,
    })
    expect(resSh3x.baseName).toBe('floor1_quarto5')
    expect(resSh3x.files.map(f => f.name)).toEqual([
      'floor1_quarto5_geometry.zip',
      'floor1_quarto5_devices.json',
      'floor1_quarto5_Import.cs',
    ])
  })

  it('OBJExporter rebases jar: URLs, deduplicates parallel model ZIP fetches, and falls back on fetch failure', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('missing')) {
        return { ok: false, status: 404, statusText: 'Not Found' }
      }
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(8),
      }
    })

    // Custom JSZip stub that returns a minimal OBJ for any valid buffer
    class ModelJSZip {
      private hasObj: boolean
      constructor(buf?: ArrayBuffer) {
        this.hasObj = Boolean(buf && buf.byteLength > 0)
      }
      file(arg: string | RegExp) {
        if (arg instanceof RegExp && this.hasObj) {
          return [
            {
              name: 'sensor.obj',
              asText: () => 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n',
              asUint8Array: () => new Uint8Array(),
            },
          ]
        }
        return []
      }
      generate() {
        return new Blob(['zip'], { type: 'application/zip' })
      }
    }

    const { OBJExporter } = loadExporters({ fetch: fetchMock, JSZip: ModelJSZip })
    const exporter = new OBJExporter()

    // Verify jar: rebasing preserves actual ZIP filename (even when inner OBJ name differs)
    const rebased = exporter._resolveModelURL(
      makePiece({
        modelUrl: 'jar:http://localhost:8099/lib/resources/models/custom_pack.zip!/inner_v2.obj',
      }),
    )
    expect(rebased).toBe('lib/resources/models/custom_pack.zip')

    // Export 3 identical sensors + 1 failing model -> fetch should run ONCE for the shared ZIP + once for missing
    const sensorUrl = 'jar:http://localhost:8099/lib/resources/models/ha-sensor-temp.zip!/ha-sensor-temp.obj'
    const missingUrl = 'jar:http://localhost:8099/lib/resources/models/missing.zip!/missing.obj'

    const mockHome = {
      getName: () => 'dedup-test',
      getWalls: () => [],
      getRooms: () => [],
      getFurniture: () => [
        makePiece({ name: 'Sensor 1', modelUrl: sensorUrl }),
        makePiece({ name: 'Sensor 2', modelUrl: sensorUrl }),
        makePiece({ name: 'Sensor 3', modelUrl: sensorUrl }),
        makePiece({ name: 'Missing Model', modelUrl: missingUrl }),
      ],
    }

    const result = await exporter.exportToOBJ(mockHome, null, 'dedup-test.zip', { download: false })
    expect(result.success).toBe(true)
    expect(result.vertices).toBeGreaterThan(0)
    expect(result.faces).toBeGreaterThan(0)

    const sensorCalls = fetchMock.mock.calls.filter(([u]) => u === 'lib/resources/models/ha-sensor-temp.zip')
    const missingCalls = fetchMock.mock.calls.filter(([u]) => u === 'lib/resources/models/missing.zip')
    expect(sensorCalls).toHaveLength(1)
    expect(missingCalls).toHaveLength(1)
  })
})
