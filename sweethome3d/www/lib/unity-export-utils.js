/**
 * unity-export-utils.js
 * Utility functions for complete Unity export including textures and device metadata
 */

class UnityExportUtilities {
  /**
   * Complete export for Unity: OBJ geometry + device metadata + textures
   */
  static async exportForUnity(home, component3D, baseName = 'smart-home') {
    try {
      console.log('Starting complete Unity export...');
      
      // 1. Export 3D geometry to OBJ
      const objExporter = new OBJExporter();
      const geometryResult = await objExporter.exportToOBJ(
        home, 
        component3D, 
        `${baseName}_geometry.zip`
      );
      
      console.log('Geometry exported:', geometryResult);
      
      // 2. Export device metadata to JSON
      const deviceData = this.extractDeviceMetadata(home);
      const deviceBlob = new Blob(
        [JSON.stringify(deviceData, null, 2)], 
        {type: 'application/json'}
      );
      this.downloadBlob(deviceBlob, `${baseName}_devices.json`);
      
      console.log('Device metadata exported:', deviceData.devices.length, 'devices');
      
      // 3. Export Unity import script
      const unityScript = this.generateUnityImportScript(baseName, deviceData);
      const scriptBlob = new Blob([unityScript], {type: 'text/plain'});
      this.downloadBlob(scriptBlob, `${baseName}_Import.cs`);
      
      console.log('Unity import script generated');
      
      return {
        success: true,
        geometry: geometryResult,
        devices: deviceData.devices.length,
        rooms: deviceData.rooms.length
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
    
    // Extract IoT devices from furniture (filtered)
    if (home.getFurniture) {
      const furniture = home.getFurniture();
      let deviceIndex = 0;
      
      for (let i = 0; i < furniture.length; i++) {
        const piece = furniture[i];
        const catalogId = piece.getCatalogId ? piece.getCatalogId() : '';
        
        // Check if it's an IoT device (customize detection logic)
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
          
          const deviceData = {
            id: `device_${deviceIndex}`,
            name: piece.getName ? piece.getName() : `Device ${deviceIndex}`,
            type: this.getDeviceType(catalogId, piece),
            catalogId: catalogId,
            position: {
              x: (piece.getX ? piece.getX() : 0) * 0.01, // cm to meters
              y: (piece.getElevation ? piece.getElevation() : 0) * 0.01,
              z: (piece.getY ? piece.getY() : 0) * 0.01
            },
            rotation: {
              y: piece.getAngle ? piece.getAngle() * (180 / Math.PI) : 0 // radians to degrees
            },
            isIoTDevice: true, // Always true since we filtered
            dimensions: {
              width: (piece.getWidth ? piece.getWidth() : 0) * 0.01,
              height: (piece.getHeight ? piece.getHeight() : 0) * 0.01,
              depth: (piece.getDepth ? piece.getDepth() : 0) * 0.01
            }
          };
          
          // Add Home Assistant entity ID if present
          if (haEntityId && haEntityId.length > 0) {
            deviceData.haEntityId = haEntityId;
            console.log(`✅ Device "${deviceData.name}" has entity ID: ${haEntityId}`);
          }
          
          // Add effect radius and propagation area for Unity particle systems
          const effectData = this.extractEffectPropagation(piece, home);
          if (effectData) {
            deviceData.effectRadius = effectData.radius;
            deviceData.propagationType = effectData.type;
            deviceData.affectedArea = effectData.area;
            // Note: particleSettings removed - Unity should configure rendering based on device type
            console.log(`📡 Device "${deviceData.name}" has effect: ${effectData.type}, radius: ${effectData.radius}m`);
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
          x: p[0] * 0.01,
          z: p[1] * 0.01
        }));
        
        rooms.push({
          id: `room_${i}`,
          name: room.getName ? room.getName() : `Room ${i}`,
          points: unityPoints,
          area: (room.getArea ? room.getArea() : 0) * 0.0001, // cm² to m²
          floorLevel: 0,
          ceilingHeight: 2.5 // Default ceiling height in meters
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
            x: (wall.getXStart ? wall.getXStart() : 0) * 0.01,
            z: (wall.getYStart ? wall.getYStart() : 0) * 0.01
          },
          end: {
            x: (wall.getXEnd ? wall.getXEnd() : 0) * 0.01,
            z: (wall.getYEnd ? wall.getYEnd() : 0) * 0.01
          },
          height: (wall.getHeight ? wall.getHeight() : 250) * 0.01,
          thickness: (wall.getThickness ? wall.getThickness() : 10) * 0.01
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
   * Check if a furniture piece is an IoT device
   */
  static isIoTDevice(catalogId, piece) {
    const deviceKeywords = [
      'sensor', 'temperature', 'humidity', 'motion', 'light',
      'camera', 'thermostat', 'switch', 'dimmer', 'plug',
      'speaker', 'display', 'monitor', 'detector'
    ];
    
    const name = (piece.getName ? piece.getName() : '').toLowerCase();
    
    // Check name first (works even if catalogId is null)
    const nameMatch = deviceKeywords.some(keyword => name.includes(keyword));
    if (nameMatch) return true;
    
    // Check catalogId if available
    if (catalogId) {
      const id = catalogId.toLowerCase();
      return deviceKeywords.some(keyword => id.includes(keyword));
    }
    
    return false;
  }
  
  /**
   * Extract effect propagation data for Unity particle systems
   * This calculates the affected area based on physical propagation (walls, rooms)
   */
  static extractEffectPropagation(piece, home) {
    const deviceType = this.getDeviceType(
      piece.getCatalogId ? piece.getCatalogId() : '',
      piece
    );
    
    // Get device position
    const x = piece.getX ? piece.getX() : 0;
    const y = piece.getY ? piece.getY() : 0;
    const elevation = piece.getElevation ? piece.getElevation() : 0;
    
    // Determine default radius and propagation type based on device
    let radius = 5.0; // Default 5 meters
    let propagationType = 'room_fill'; // Default to wall-constrained
    let particleType = 'environmental'; // Default particle type
    
    // Custom settings per device type
    switch (deviceType) {
      case 'temperature_sensor':
        radius = 5.0;
        propagationType = 'room_fill';
        particleType = 'heat';
        break;
      case 'humidity_sensor':
        radius = 5.0;
        propagationType = 'room_fill';
        particleType = 'moisture';
        break;
      case 'light_sensor':
      case 'light':
        radius = 6.0;
        propagationType = 'room_fill';
        particleType = 'light';
        break;
      case 'motion_sensor':
        radius = 4.0;
        propagationType = 'circular';
        particleType = 'detection_wave';
        break;
      case 'camera':
        radius = 8.0;
        propagationType = 'directional';
        particleType = 'vision_cone';
        break;
      case 'speaker':
        radius = 6.0;
        propagationType = 'circular';
        particleType = 'sound_wave';
        break;
      default:
        radius = 3.0;
        propagationType = 'circular';
        particleType = 'generic';
    }
    
    // Try to get custom radius from furniture properties
    try {
      const storedRadius = piece.getProperty('haEffectRadius');
      if (storedRadius && !isNaN(parseFloat(storedRadius))) {
        radius = parseFloat(storedRadius);
      }
    } catch (e) {
      // Property doesn't exist
    }
    
    // Calculate affected area based on propagation type
    const affectedArea = this.calculateAffectedArea(
      x, y, radius, propagationType, home
    );
    
    return {
      radius: radius,
      type: propagationType,
      area: affectedArea
    };
  }
  
  /**
   * Calculate affected area for particle spawning in Unity
   */
  static calculateAffectedArea(x, y, maxRadius, propagationType, home) {
    const radiusCm = maxRadius * 100; // Convert meters to cm
    
    switch (propagationType) {
      case 'room_fill':
        return this.calculateRoomFilledArea(x, y, radiusCm, home);
      
      case 'circular':
        return this.calculateCircularArea(x, y, radiusCm);
      
      case 'square':
        return this.calculateSquareArea(x, y, radiusCm);
      
      case 'directional':
        return this.calculateDirectionalArea(x, y, radiusCm, home);
      
      default:
        return this.calculateCircularArea(x, y, radiusCm);
    }
  }
  
  /**
   * Calculate room-filled area (wall-constrained)
   * Returns polygon vertices in Unity coordinates (meters)
   */
  static calculateRoomFilledArea(x, y, maxRadius, home) {
    // Find room containing device
    const room = this.findRoomContaining(x, y, home);
    
    if (room && room.getPoints) {
      const points = room.getPoints();
      // Convert to Unity coordinates (cm to meters, flip Y/Z)
      return {
        type: 'polygon',
        vertices: points.map(p => ({
          x: p[0] * 0.01,
          y: 0.0, // Floor level
          z: p[1] * 0.01
        })),
        volume: true, // Fill entire room volume
        boundedByWalls: true
      };
    }
    
    // Fallback: Use flood fill with wall detection
    const samplePoints = this.sampleWallConstrainedPoints(x, y, maxRadius, home);
    
    return {
      type: 'point_cloud',
      points: samplePoints.map(p => ({
        x: p[0] * 0.01,
        y: 0.0,
        z: p[1] * 0.01
      })),
      volume: true,
      boundedByWalls: true
    };
  }
  
  /**
   * Calculate circular area (omnidirectional)
   */
  static calculateCircularArea(x, y, radius) {
    return {
      type: 'sphere',
      center: {
        x: x * 0.01,
        y: 0.0,
        z: y * 0.01
      },
      radius: radius * 0.01,
      volume: true,
      boundedByWalls: false
    };
  }
  
  /**
   * Calculate square area
   */
  static calculateSquareArea(x, y, radius) {
    const r = radius * 0.01;
    const cx = x * 0.01;
    const cz = y * 0.01;
    
    return {
      type: 'box',
      center: { x: cx, y: 0.0, z: cz },
      size: { x: r * 2, y: r * 2, z: r * 2 },
      volume: true,
      boundedByWalls: false
    };
  }
  
  /**
   * Calculate directional area (cone)
   */
  static calculateDirectionalArea(x, y, radius, home) {
    // Cone with 60 degree FOV
    return {
      type: 'cone',
      origin: {
        x: x * 0.01,
        y: 0.0,
        z: y * 0.01
      },
      direction: { x: 0, y: 0, z: 1 }, // Forward
      angle: 60, // degrees
      range: radius * 0.01,
      volume: true,
      boundedByWalls: false
    };
  }
  
  /**
   * Find room containing a point
   */
  static findRoomContaining(x, y, home) {
    if (!home || !home.getRooms) return null;
    
    const rooms = home.getRooms();
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      if (this.isPointInRoom(x, y, room)) {
        return room;
      }
    }
    return null;
  }
  
  /**
   * Point-in-polygon test
   */
  static isPointInRoom(x, y, room) {
    const points = room.getPoints ? room.getPoints() : [];
    if (points.length < 3) return false;
    
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i][0], yi = points[i][1];
      const xj = points[j][0], yj = points[j][1];
      
      const intersect = ((yi > y) !== (yj > y)) &&
                       (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  
  /**
   * Sample points constrained by walls (flood fill)
   */
  static sampleWallConstrainedPoints(x, y, maxRadius, home) {
    const points = [];
    const step = 50; // 50cm sampling
    const walls = home.getWalls ? home.getWalls() : [];
    
    for (let px = x - maxRadius; px <= x + maxRadius; px += step) {
      for (let py = y - maxRadius; py <= y + maxRadius; py += step) {
        const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
        
        if (dist <= maxRadius) {
          // Check if path crosses walls
          if (!this.pathCrossesWalls(x, y, px, py, walls)) {
            points.push([px, py]);
          }
        }
      }
    }
    
    return points;
  }
  
  /**
   * Check if line segment crosses any walls
   */
  static pathCrossesWalls(x1, y1, x2, y2, walls) {
    for (let i = 0; i < walls.length; i++) {
      const wall = walls[i];
      const wx1 = wall.getXStart ? wall.getXStart() : 0;
      const wy1 = wall.getYStart ? wall.getYStart() : 0;
      const wx2 = wall.getXEnd ? wall.getXEnd() : 0;
      const wy2 = wall.getYEnd ? wall.getYEnd() : 0;
      
      if (this.lineSegmentsIntersect(x1, y1, x2, y2, wx1, wy1, wx2, wy2)) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Line segment intersection test
   */
  static lineSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denominator = ((y4 - y3) * (x2 - x1)) - ((x4 - x3) * (y2 - y1));
    if (denominator === 0) return false;
    
    const ua = (((x4 - x3) * (y1 - y3)) - ((y4 - y3) * (x1 - x3))) / denominator;
    const ub = (((x2 - x1) * (y1 - y3)) - ((y2 - y1) * (x1 - x3))) / denominator;
    
    return (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1);
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
   * Get device type from catalog ID or name
   */
  static getDeviceType(catalogId, piece) {
    const name = (piece.getName ? piece.getName() : '').toLowerCase();
    const id = catalogId ? catalogId.toLowerCase() : '';
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
    if (combined.includes('camera')) {
      return 'camera';
    }
    if (combined.includes('thermostat')) {
      return 'thermostat';
    }
    if (combined.includes('switch')) {
      return 'switch';
    }
    if (combined.includes('dimmer')) {
      return 'dimmer';
    }
    if (combined.includes('plug')) {
      return 'smart_plug';
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
   * Convert string to PascalCase for C# class names
   */
  static toPascalCase(str) {
    return str
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
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
  window.exportForUnity = (home, component3D, name) => 
    UnityExportUtilities.exportForUnity(home, component3D, name);
}

// Node.js export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UnityExportUtilities;
}
