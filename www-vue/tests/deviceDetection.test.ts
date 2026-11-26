import { describe, it, expect } from 'vitest'
import {
  resolveCatalogId,
  isSmartDeviceFurniture,
  isSwitchFurniture,
} from '../src/utils/deviceDetection'

describe('deviceDetection contract', () => {
  it('resolves catalogId across all 5 SH3D fallback paths', () => {
    expect(resolveCatalogId({ getCatalogId: () => 'ha_sensor_temperature' })).toBe('ha_sensor_temperature')
    expect(resolveCatalogId({ properties: { catalogId: 'ha_light_bulb' } })).toBe('ha_light_bulb')
    expect(resolveCatalogId({ getProperty: (k: string) => (k === 'catalogId' ? 'ha_switch_plug' : null) })).toBe('ha_switch_plug')
    expect(
      resolveCatalogId({
        getAdditionalProperties: () => ({
          entries: [{ getKey: () => 'catalogId', getValue: () => 'ha_sensor_motion' }],
        }),
      }),
    ).toBe('ha_sensor_motion')
    expect(
      resolveCatalogId({
        getCatalogPieceOfFurniture: () => ({ getId: () => 'ha_light_ceiling' }),
      }),
    ).toBe('ha_light_ceiling')
    expect(resolveCatalogId({})).toBeNull()
  })

  it('identifies HA smart devices and ignores ordinary furniture', () => {
    expect(isSmartDeviceFurniture({ getCatalogId: () => 'ha_sensor_humidity' })).toBe(true)
    expect(isSmartDeviceFurniture({ creator: 'HA' })).toBe(true)
    expect(isSmartDeviceFurniture({ getCategory: () => ({ getName: () => 'Smart Sensors' }) })).toBe(true)
    expect(isSmartDeviceFurniture({ getName: () => 'Living Room Thermostat' })).toBe(true)
    expect(isSmartDeviceFurniture({ getCatalogId: () => 'sh3d_sofa_01', getName: () => 'Armchair' })).toBe(false)
  })

  it('identifies switch and dimmer furniture accurately', () => {
    expect(isSwitchFurniture({ getCatalogId: () => 'ha_switch_pressure' })).toBe(true)
    expect(isSwitchFurniture({ getCatalogId: () => 'ha_switch_regular' })).toBe(true)
    expect(isSwitchFurniture({ getCatalogId: () => 'ha_light_dimmer' })).toBe(true)
    expect(isSwitchFurniture({ getCatalogId: () => 'ha_light_bulb' })).toBe(false)
    expect(isSwitchFurniture({ getCatalogId: () => 'ha_sensor_temperature' })).toBe(false)
  })
})
