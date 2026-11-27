/**
 * unity-export-utils.js
 * Utility functions for complete Unity export including textures and device metadata
 */

class UnityExportUtilities {
  /**
   * Normalize home base name (guards against null/empty, strips .sh3x, sanitizes slashes)
   */
  static normalizeBaseName(baseName) {
    if (typeof baseName !== 'string') return 'smart-home';
    let cleaned = baseName.trim().replace(/\.sh3x$/i, '').replace(/[/\\]+/g, '_');
    return cleaned.length > 0 ? cleaned : 'smart-home';
  }

  /**
   * Safely coerce a numeric value with fallback (handles null, undefined, NaN)
   */
  static _num(value, fallback) {
    return (typeof value === 'number' && !isNaN(value)) ? value : fallback;
  }

  /**
   * Resolve catalogId across all SweetHome3D JS storage locations
   * (mirrors www-vue/src/utils/deviceDetection.ts)
   */
  static resolveCatalogId(piece) {
    if (!piece) return null;
    try {
      if (typeof piece.getCatalogId === 'function') {
        const direct = piece.getCatalogId();
        if (direct) return direct;
      }
      if (piece.properties && piece.properties.catalogId) {
        return piece.properties.catalogId;
      }
      if (typeof piece.getProperty === 'function') {
        const prop = piece.getProperty('catalogId');
        if (prop) return prop;
      }
      if (typeof piece.getAdditionalProperties === 'function') {
        const addProps = piece.getAdditionalProperties();
        const entries = addProps && addProps.entries;
        if (entries) {
          for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (entry && typeof entry.getKey === 'function' && entry.getKey() === 'catalogId') {
              const val = typeof entry.getValue === 'function' ? entry.getValue() : null;
              if (val) return val;
            }
          }
        }
      }
      if (typeof piece.getCatalogPieceOfFurniture === 'function') {
        const catalogPiece = piece.getCatalogPieceOfFurniture();
        if (catalogPiece && typeof catalogPiece.getId === 'function') {
          const pieceId = catalogPiece.getId();
          if (pieceId) return pieceId;
        }
      }
    } catch (e) {
      // Ignore untyped SH3D property errors
    }
    return null;
  }

  /**
   * Recursively flatten HomeFurnitureGroup items so grouped smart devices are included
   */
  static collectFurniturePieces(furnitureList, out = []) {
    if (!furnitureList) return out;
    for (let i = 0; i < furnitureList.length; i++) {
      const piece = furnitureList[i];
      if (!piece) continue;
      if (typeof piece.getFurniture === 'function') {
        const children = piece.getFurniture();
        if (children && children.length > 0) {
          this.collectFurniturePieces(children, out);
          continue;
        }
      }
      out.push(piece);
    }
    return out;
  }

  /**
   * Complete export for Unity: OBJ geometry + device metadata + textures
   * @param {Home} home
   * @param {HomeComponent3D} component3D
   * @param {string} [baseName='smart-home']
   * @param {Object} [options] - { download: true } (set download: false to receive Blobs directly)
   */
  static async exportForUnity(home, component3D, baseName = 'smart-home', options = {}) {
    try {
      console.log('Starting complete Unity export...');

      const safeBaseName = this.normalizeBaseName(baseName);
      const shouldDownload = options.download !== false;
      const files = [];

      // 1. Export 3D geometry to OBJ
      const objExporter = new OBJExporter();
      const geometryFileName = `${safeBaseName}_geometry.zip`;
      const geometryResult = await objExporter.exportToOBJ(
        home,
        component3D,
        geometryFileName,
        { download: shouldDownload }
      );

      if (geometryResult && geometryResult.blob) {
        files.push({ name: geometryResult.filename || geometryFileName, blob: geometryResult.blob });
      }
      console.log('Geometry exported:', geometryResult);

      // 2. Export device metadata to JSON
      const deviceData = this.extractDeviceMetadata(home);
      const devicesFileName = `${safeBaseName}_devices.json`;
      const deviceBlob = new Blob(
        [JSON.stringify(deviceData, null, 2)],
        { type: 'application/json' }
      );
      files.push({ name: devicesFileName, blob: deviceBlob });
      if (shouldDownload) {
        this.downloadBlob(deviceBlob, devicesFileName);
      }

      console.log('Device metadata exported:', deviceData.devices.length, 'devices');

      // 3. Export Unity import script
      const unityScript = this.generateUnityImportScript(safeBaseName, deviceData);
      const scriptFileName = `${safeBaseName}_Import.cs`;
      const scriptBlob = new Blob([unityScript], { type: 'text/plain' });
      files.push({ name: scriptFileName, blob: scriptBlob });
      if (shouldDownload) {
        this.downloadBlob(scriptBlob, scriptFileName);
      }

      console.log('Unity import script generated');

      return {
        success: true,
        baseName: safeBaseName,
        geometry: geometryResult,
        devices: deviceData.devices.length,
        rooms: deviceData.rooms.length,
        files: files
      };

    } catch (error) {
      console.error('Unity export error:', error);
      throw error;
    }
  }
  
    /**
   * Export both to PHP server (for HA storage) and download locally
   */
  static async exportToServerAndDownload(home, component3D, baseName) {
    // 1. Export geometry with my exporter
    const objExporter = new OBJExporter();
    await objExporter.exportToOBJ(home, component3D, `${baseName}.zip`);
    
    // 2. Also send to PHP server
    const objContent = objExporter.buildOBJContent();
    const mtlContent = objExporter.buildMTLContent();
    const homeData = this.serializeHome(home);
    
    const response = await fetch('exportForUnity.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        home_name: baseName,
        home_data: JSON.stringify(homeData),
        obj_data: objContent,
        mtl_data: mtlContent
      })
    });
    
    return await response.json();
  }

  /**
   * Extract device metadata for Unity
   * 
   * NOTE: This function filters to ONLY export IoT/smart devices.
   * To export ALL furniture instead, change the condition from:
   *   if (isDevice) { devices.push(...) }
   * to:
   *   devices.push(...) // (remove the if check)
   * 
   * The Unity import script expects only IoT devices, but you can modify
   * it to handle all furniture if needed.
   */
  static extractDeviceMetadata(home) {
    const devices = [];
    const rooms = [];
    const walls = [];
    const defaultWallHeight = this._num(home.getWallHeight ? home.getWallHeight() : null, 250);

    // Extract IoT devices from furniture (filtered, including nested furniture groups)
    if (home.getFurniture) {
      const furniture = this.collectFurniturePieces(home.getFurniture());
      let deviceIndex = 0;

      for (let i = 0; i < furniture.length; i++) {
        const piece = furniture[i];
        const catalogId = this.resolveCatalogId(piece);

        // Check if it's an IoT device (consistent with deviceDetection.ts)
        const isDevice = this.isIoTDevice(catalogId, piece);

        // FILTER: Only add IoT devices to the export
        if (isDevice) {
          // Get Home Assistant entity ID if present
          let haEntityId = null;
          try {
            if (typeof piece.getProperty === 'function') {
              haEntityId = piece.getProperty('haEntityId');
            }
          } catch (e) {
            // Property doesn't exist, that's ok
          }

          const rawName = piece.getName ? piece.getName() : null;
          const deviceData = {
            id: `device_${deviceIndex}`,
            name: (typeof rawName === 'string' && rawName.length > 0) ? rawName : `Device ${deviceIndex}`,
            type: this.getDeviceType(catalogId, piece),
            catalogId: catalogId,
            position: {
              x: this._num(piece.getX ? piece.getX() : null, 0) * 0.01, // cm to meters
              y: this._num(piece.getElevation ? piece.getElevation() : null, 0) * 0.01,
              z: this._num(piece.getY ? piece.getY() : null, 0) * 0.01
            },
            rotation: {
              y: this._num(piece.getAngle ? piece.getAngle() : null, 0) * (180 / Math.PI) // radians to degrees
            },
            isIoTDevice: true, // Always true since we filtered
            dimensions: {
              width: this._num(piece.getWidth ? piece.getWidth() : null, 0) * 0.01,
              height: this._num(piece.getHeight ? piece.getHeight() : null, 0) * 0.01,
              depth: this._num(piece.getDepth ? piece.getDepth() : null, 0) * 0.01
            }
          };

          // Add Home Assistant entity ID if present
          if (haEntityId && haEntityId.length > 0) {
            deviceData.haEntityId = haEntityId;
            console.log(`✅ Device "${deviceData.name}" has entity ID: ${haEntityId}`);
          }

          // Add controlsEntityId for switches (which light entity this switch controls)
          let controlsEntityId = null;
          try {
            if (typeof piece.getProperty === 'function') {
              controlsEntityId = piece.getProperty('controlsEntityId');
            }
          } catch (e) { /* Property doesn't exist, ok */ }

          if (controlsEntityId && controlsEntityId.length > 0) {
            deviceData.controlsEntityId = controlsEntityId;
            console.log(`🔗 Switch "${deviceData.name}" controls: ${controlsEntityId}`);
          }

          // Add switch type (regular or pressure)
          let switchType = null;
          try {
            if (typeof piece.getProperty === 'function') {
              switchType = piece.getProperty('switchType');
            }
          } catch (e) { /* ok */ }

          if (switchType) {
            deviceData.switchType = switchType; // "fixed" or "pressure"
          }

          devices.push(deviceData);
          deviceIndex++;
        }
      }
    }

    // Extract room data
    if (home.getRooms) {
      const homeRooms = home.getRooms();
      for (let i = 0; i < homeRooms.length; i++) {
        const room = homeRooms[i];
        const points = room.getPoints ? room.getPoints() : [];

        // Convert points to Unity coordinates (cm to m)
        const unityPoints = points.map(p => ({
          x: this._num(p[0], 0) * 0.01,
          z: this._num(p[1], 0) * 0.01
        }));

        rooms.push({
          id: `room_${i}`,
          name: room.getName ? room.getName() : `Room ${i}`,
          points: unityPoints,
          area: this._num(room.getArea ? room.getArea() : null, 0) * 0.0001, // cm² to m²
          floorLevel: 0,
          ceilingHeight: defaultWallHeight * 0.01
        });
      }
    }

    // Extract wall data
    if (home.getWalls) {
      const homeWalls = home.getWalls();
      for (let i = 0; i < homeWalls.length; i++) {
        const wall = homeWalls[i];

        walls.push({
          id: `wall_${i}`,
          start: {
            x: this._num(wall.getXStart ? wall.getXStart() : null, 0) * 0.01,
            z: this._num(wall.getYStart ? wall.getYStart() : null, 0) * 0.01
          },
          end: {
            x: this._num(wall.getXEnd ? wall.getXEnd() : null, 0) * 0.01,
            z: this._num(wall.getYEnd ? wall.getYEnd() : null, 0) * 0.01
          },
          height: this._num(wall.getHeight ? wall.getHeight() : null, defaultWallHeight) * 0.01,
          thickness: this._num(wall.getThickness ? wall.getThickness() : null, 10) * 0.01
        });
      }
    }

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      unitsystem: 'meters',
      coordinateSystem: {
        origin: 'center',
        yAxis: 'up',
        zAxis: 'forward'
      },
      devices: devices,
      rooms: rooms,
      walls: walls,
      metadata: {
        deviceCount: devices.filter(d => d.isIoTDevice).length,
        roomCount: rooms.length,
        wallCount: walls.length
      }
    };
  }

  /**
   * Check if a furniture piece is an IoT device.
   * Aligns with www-vue/src/utils/deviceDetection.ts so renamed HA devices are always exported.
   */
  static isIoTDevice(catalogId, piece) {
    const resolvedId = (catalogId || this.resolveCatalogId(piece) || '');
    const idLower = typeof resolvedId === 'string' ? resolvedId.toLowerCase() : '';

    // 1. Canonical HA catalog ID prefix (works even when user renames the piece)
    if (idLower.startsWith('ha_')) return true;

    if (piece) {
      // 2. HA creator metadata
      try {
        const creator = typeof piece.getCreator === 'function' ? piece.getCreator() : piece.creator;
        if (creator === 'HA') return true;
      } catch (e) { /* ignore */ }

      // 3. Smart category metadata
      try {
        const category = typeof piece.getCategory === 'function' ? piece.getCategory() : null;
        const categoryName = (category && typeof category.getName === 'function' ? category.getName() : '') || '';
        if (categoryName.toLowerCase().includes('smart')) return true;
      } catch (e) { /* ignore */ }

      // 4. Explicit HA custom properties assigned via FurnitureDialogEnhancer
      try {
        if (typeof piece.getProperty === 'function') {
          if (piece.getProperty('haEntityId') || piece.getProperty('controlsEntityId')) {
            return true;
          }
        }
      } catch (e) { /* ignore */ }
    }

    // 5. Fallback keyword matching on name or catalogId
    const deviceKeywords = [
      'sensor', 'temperature', 'humidity', 'motion', 'light',
      'camera', 'thermostat', 'switch', 'dimmer', 'plug',
      'speaker', 'display', 'monitor', 'detector', 'bulb',
      'lock', 'hub'
    ];

    const rawName = (piece && typeof piece.getName === 'function') ? piece.getName() : '';
    const name = (typeof rawName === 'string' ? rawName : '').toLowerCase();

    if (deviceKeywords.some(keyword => name.includes(keyword))) return true;
    if (idLower && deviceKeywords.some(keyword => idLower.includes(keyword))) return true;

    return false;
  }
  
  /**
   * Get Unity particle system settings based on device type
   */
  static getParticleSettings(deviceType, particleType) {
    const settings = {
      particleType: particleType,
      emissionRate: 10,
      particleLifetime: 2.0,
      startSpeed: 0.5,
      startSize: 0.1,
      color: { r: 1, g: 1, b: 1, a: 0.5 },
      simulationSpace: 'World',
      maxParticles: 1000
    };
    
    // Customize per device type
    switch (deviceType) {
      case 'temperature_sensor':
        settings.color = { r: 1.0, g: 0.3, b: 0.1, a: 0.4 }; // Orange/red
        settings.emissionRate = 20;
        settings.startSpeed = 0.3;
        settings.startSize = 0.15;
        settings.particleLifetime = 3.0;
        break;
        
      case 'humidity_sensor':
        settings.color = { r: 0.3, g: 0.6, b: 1.0, a: 0.3 }; // Blue
        settings.emissionRate = 15;
        settings.startSpeed = 0.2;
        settings.startSize = 0.08;
        break;
        
      case 'light_sensor':
      case 'light':
        settings.color = { r: 1.0, g: 1.0, b: 0.8, a: 0.6 }; // Warm white
        settings.emissionRate = 50;
        settings.startSpeed = 1.0;
        settings.startSize = 0.05;
        settings.particleLifetime = 1.5;
        break;
        
      case 'motion_sensor':
        settings.color = { r: 0.2, g: 1.0, b: 0.3, a: 0.5 }; // Green
        settings.emissionRate = 5;
        settings.startSpeed = 2.0;
        settings.startSize = 0.2;
        settings.particleLifetime = 1.0;
        break;
        
      case 'camera':
        settings.color = { r: 0.0, g: 0.5, b: 1.0, a: 0.4 }; // Blue
        settings.emissionRate = 30;
        settings.startSpeed = 1.5;
        settings.startSize = 0.03;
        break;
    }
    
    return settings;
  }
  
  /**
   * Get device type from catalog ID or name.
   * Explicit HA catalog IDs are matched first to preserve Unity SmartHomeExportData.cs DeviceCategory
   * mappings (especially ha_light_dimmer -> 'dimmer' and ha_switch_plug -> 'smart_plug').
   */
  static getDeviceType(catalogId, piece) {
    const resolvedId = (catalogId || this.resolveCatalogId(piece) || '');
    const id = typeof resolvedId === 'string' ? resolvedId.toLowerCase() : '';

    // 1. Explicit canonical HA catalog ID mapping
    const catalogTypeMap = {
      ha_sensor_temperature: 'temperature_sensor',
      ha_sensor_temp_humidity: 'temperature_sensor',
      ha_sensor_humidity: 'humidity_sensor',
      ha_sensor_motion: 'motion_sensor',
      ha_sensor_motion_light: 'motion_sensor',
      ha_sensor_light: 'light_sensor',
      ha_light_bulb: 'light',
      ha_light_ceiling: 'light',
      ha_light_dimmer: 'dimmer',
      ha_switch_plug: 'smart_plug',
      ha_switch_regular: 'switch',
      ha_switch_pressure: 'switch'
    };
    if (id && catalogTypeMap[id]) {
      return catalogTypeMap[id];
    }

    const rawName = (piece && typeof piece.getName === 'function') ? piece.getName() : '';
    const name = (typeof rawName === 'string' ? rawName : '').toLowerCase();
    const combined = name + ' ' + id;

    if (combined.includes('temperature') || combined.includes('temp')) {
      return 'temperature_sensor';
    }
    if (combined.includes('humidity')) {
      return 'humidity_sensor';
    }
    if (combined.includes('motion') || combined.includes('pir')) {
      return 'motion_sensor';
    }
    if (combined.includes('light') && combined.includes('sensor')) {
      return 'light_sensor';
    }
    if (combined.includes('plug')) {
      return 'smart_plug';
    }
    if (combined.includes('switch')) {
      return 'switch';
    }
    if (combined.includes('dimmer')) {
      return 'dimmer';
    }
    if (combined.includes('light') && !combined.includes('sensor')) {
      return 'light';
    }
    if (combined.includes('camera')) {
      return 'camera';
    }
    if (combined.includes('thermostat')) {
      return 'thermostat';
    }

    return 'unknown';
  }
  
  /**
   * Generate Unity C# import script
   */
  static generateUnityImportScript(baseName, deviceData) {
    return `using UnityEngine;
using System.Collections.Generic;
using System.IO;

/// <summary>
/// Auto-generated import script for ${baseName}
/// Generated: ${new Date().toISOString()}
/// </summary>
public class ${this.toPascalCase(baseName)}Importer : MonoBehaviour
{
    [Header("Import Settings")]
    public string objModelPath = "Assets/Models/${baseName}/${baseName}_geometry.obj";
    public string devicesJsonPath = "Assets/Models/${baseName}/${baseName}_devices.json";
    
    [Header("Device Prefabs")]
    public GameObject temperatureSensorPrefab;
    public GameObject humiditySensorPrefab;
    public GameObject motionSensorPrefab;
    public GameObject lightSensorPrefab;
    public GameObject cameraPrefab;
    public GameObject switchPrefab;
    public GameObject defaultDevicePrefab;
    
    [Header("Runtime")]
    public GameObject homeModel;
    public List<GameObject> instantiatedDevices = new List<GameObject>();
    
    void Start()
    {
        ImportHome();
    }
    
    [ContextMenu("Import Home")]
    public void ImportHome()
    {
        Debug.Log("Importing ${baseName}...");
        
        // Load and instantiate the 3D model
        LoadHomeModel();
        
        // Load and place IoT devices
        LoadIoTDevices();
        
        Debug.Log($"Import complete: {instantiatedDevices.Count} devices placed");
    }
    
    void LoadHomeModel()
    {
        // The OBJ model should already be imported by Unity
        // Find it in the scene or instantiate from prefab
        GameObject modelPrefab = Resources.Load<GameObject>("${baseName}/${baseName}_geometry");
        
        if (modelPrefab != null)
        {
            homeModel = Instantiate(modelPrefab, transform);
            homeModel.name = "${baseName}_Model";
            
            // Apply correct scale (SweetHome3D cm to Unity m)
            homeModel.transform.localScale = new Vector3(1f, 1f, 1f); // Already scaled in OBJ
            
            Debug.Log("Home model loaded successfully");
        }
        else
        {
            Debug.LogWarning($"Model prefab not found at: {objModelPath}");
        }
    }
    
    void LoadIoTDevices()
    {
        // Load device metadata JSON
        TextAsset jsonAsset = Resources.Load<TextAsset>("${baseName}/${baseName}_devices");
        
        if (jsonAsset == null)
        {
            Debug.LogWarning($"Devices JSON not found at: {devicesJsonPath}");
            return;
        }
        
        DeviceData data = JsonUtility.FromJson<DeviceData>(jsonAsset.text);
        
        foreach (var device in data.devices)
        {
            if (device.isIoTDevice)
            {
                PlaceDevice(device);
            }
        }
    }
    
    void PlaceDevice(Device device)
    {
        GameObject prefab = GetDevicePrefab(device.type);
        
        if (prefab == null)
        {
            Debug.LogWarning($"No prefab for device type: {device.type}");
            return;
        }
        
        GameObject deviceObj = Instantiate(prefab, transform);
        deviceObj.name = device.name;
        
        // Set position (already in meters from export)
        deviceObj.transform.position = new Vector3(
            device.position.x,
            device.position.y,
            device.position.z
        );
        
        // Set rotation
        deviceObj.transform.rotation = Quaternion.Euler(0, device.rotation.y, 0);
        
        // Add component to track device data
        var tracker = deviceObj.AddComponent<IoTDeviceTracker>();
        tracker.deviceId = device.id;
        tracker.deviceType = device.type;
        tracker.deviceName = device.name;
        tracker.haEntityId = device.haEntityId;  // Home Assistant entity ID
        tracker.controlsEntityId = device.controlsEntityId;
        tracker.switchType = device.switchType;
        
        instantiatedDevices.Add(deviceObj);
        
        // Log with HA entity if present
        string logMessage = $"Placed device: {device.name} at {deviceObj.transform.position}";
        if (!string.IsNullOrEmpty(device.haEntityId))
        {
            logMessage += $" (HA Entity: {device.haEntityId})";
        }
        Debug.Log(logMessage);
    }
    
    GameObject GetDevicePrefab(string deviceType)
    {
        switch (deviceType)
        {
            case "temperature_sensor":
                return temperatureSensorPrefab;
            case "humidity_sensor":
                return humiditySensorPrefab;
            case "motion_sensor":
                return motionSensorPrefab;
            case "light_sensor":
                return lightSensorPrefab;
            case "camera":
                return cameraPrefab;
            case "switch":
            case "dimmer":
            case "smart_plug":
                return switchPrefab;
            default:
                return defaultDevicePrefab;
        }
    }
    
    // Data structures matching JSON format
    [System.Serializable]
    public class DeviceData
    {
        public string version;
        public string exportedAt;
        public Device[] devices;
    }
    
    [System.Serializable]
    public class Device
    {
        public string id;
        public string name;
        public string type;
        public string catalogId;
        public Position position;
        public Rotation rotation;
        public bool isIoTDevice;
        public Dimensions dimensions;
        public string haEntityId;  // Home Assistant entity ID (optional)
        public string controlsEntityId;
        public string switchType;
    }
    
    [System.Serializable]
    public class Position
    {
        public float x;
        public float y;
        public float z;
    }
    
    [System.Serializable]
    public class Rotation
    {
        public float y;
    }
    
    [System.Serializable]
    public class Dimensions
    {
        public float width;
        public float height;
        public float depth;
    }
}

/// <summary>
/// Component to track IoT device metadata
/// </summary>
public class IoTDeviceTracker : MonoBehaviour
{
    [Header("Device Info")]
    public string deviceId;
    public string deviceType;
    public string deviceName;
    
    [Header("Home Assistant Integration")]
    public string haEntityId;  // Home Assistant entity_id (e.g., "light.living_room")
    
    [Header("Switch Configuration")]
    public string controlsEntityId;
    public string switchType;
    
    [Header("MQTT Integration")]
    public string mqttTopic;
    public object currentValue;
    
    public void UpdateFromMQTT(string topic, string payload)
    {
        mqttTopic = topic;
        // Parse payload based on device type
        // Update visualization
    }
    
    /// <summary>
    /// Check if this device has a Home Assistant entity configured
    /// </summary>
    public bool HasHomeAssistantEntity()
    {
        return !string.IsNullOrEmpty(haEntityId);
    }
    
    /// <summary>
    /// Get the MQTT topic for this device based on HA entity ID
    /// Example: light.living_room -> homeassistant/light/living_room/state
    /// </summary>
    public string GetHomeAssistantTopic()
    {
        if (!HasHomeAssistantEntity()) return null;
        
        string[] parts = haEntityId.Split('.');
        if (parts.Length != 2) return null;
        
        string domain = parts[0];
        string entity = parts[1];
        
        return $"homeassistant/{domain}/{entity}/state";
    }
}
`;
  }
  
  /**
   * Convert string to PascalCase for C# class names (null/empty safe)
   */
  static toPascalCase(str) {
    const safe = (typeof str === 'string' && str.trim().length > 0) ? str : 'SmartHome';
    const result = safe
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
    return result.length > 0 ? result : 'SmartHome';
  }
  
  /**
   * Download blob as file
   */
  static downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  /**
   * Extract textures from WebGL canvas
   */
  static async extractTexturesFromWebGL(component3D) {
    const textures = new Map();
    
    try {
      // Get WebGL canvas
      const canvas = component3D?.canvas || document.querySelector('canvas');
      
      if (!canvas) {
        console.warn('WebGL canvas not found');
        return textures;
      }
      
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) {
        console.warn('WebGL context not available');
        return textures;
      }
      
      // This is a simplified approach - actual implementation would need
      // to hook into SweetHome3D's texture loading system
      console.log('Texture extraction from WebGL - advanced feature');
      
      // TODO: Implement texture extraction from WebGL textures
      // This requires access to texture objects and their data
      
    } catch (error) {
      console.error('Texture extraction error:', error);
    }
    
    return textures;
  }
}

// Make utilities globally available
if (typeof window !== 'undefined') {
  window.UnityExportUtilities = UnityExportUtilities;
  window.exportForUnity = (home, component3D, name, options) =>
    UnityExportUtilities.exportForUnity(home, component3D, name, options);
}

// Node.js export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UnityExportUtilities;
}
