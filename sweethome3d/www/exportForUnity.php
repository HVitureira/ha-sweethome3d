<?php
/**
 * Export SweetHome3D floor plan for Unity integration
 * Extracts smart device positions and metadata
 * 
 * Part of Home Assistant Digital Twin project
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Get input
$homeName = $_POST['home_name'] ?? 'smart-home';
$homeDataRaw = $_POST['home_data'] ?? null;

if (!$homeDataRaw) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'No home data provided'
    ]);
    exit;
}

// Parse home data (JSON from SweetHome3DJS)
$homeData = json_decode($homeDataRaw, true);

if (!$homeData) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid home data format'
    ]);
    exit;
}

// Extract devices and rooms
$devices = extractDevices($homeData);
$rooms = extractRooms($homeData);
$walls = extractWalls($homeData);

// Create export package
$exportData = [
    'version' => '1.0',
    'exported_at' => date('c'),
    'home_name' => sanitizeFilename($homeName),
    'devices' => $devices,
    'rooms' => $rooms,
    'walls' => $walls,
    'metadata' => [
        'device_count' => count($devices),
        'room_count' => count($rooms),
        'export_source' => 'SweetHome3D HA Add-on'
    ]
];

// Ensure export directories exist
$dataDir = __DIR__ . '/data/';
$exportDir = $dataDir . 'exports/';
if (!file_exists($exportDir)) {
    mkdir($exportDir, 0755, true);
}

// Save devices.json with timestamp
$timestamp = date('Y-m-d_H-i-s');
$filename = sanitizeFilename($homeName);
$jsonPath = $exportDir . $filename . '_' . $timestamp . '_devices.json';

file_put_contents($jsonPath, json_encode($exportData, JSON_PRETTY_PRINT));

// Also save latest version without timestamp
$latestPath = $exportDir . $filename . '_devices.json';
file_put_contents($latestPath, json_encode($exportData, JSON_PRETTY_PRINT));

// Try to copy to Home Assistant www folder for Unity access
$haPath = '/config/www/models/';
$haCopied = false;

if (file_exists($haPath) && is_writable($haPath)) {
    copy($latestPath, $haPath . 'devices.json');
    $haCopied = true;
}

// Return success response
echo json_encode([
    'success' => true,
    'devices_count' => count($devices),
    'rooms_count' => count($rooms),
    'export_path' => 'data/exports/' . basename($jsonPath),
    'latest_path' => 'data/exports/' . basename($latestPath),
    'ha_path_copied' => $haCopied,
    'timestamp' => $timestamp,
    'devices' => array_map(function($d) {
        return ['id' => $d['id'], 'name' => $d['name'], 'type' => $d['type']];
    }, $devices)
]);

/**
 * Extract smart devices from furniture array
 */
function extractDevices($homeData) {
    $devices = [];
    
    if (!isset($homeData['furniture']) || !is_array($homeData['furniture'])) {
        return $devices;
    }
    
    foreach ($homeData['furniture'] as $item) {
        $catalogId = $item['catalogId'] ?? '';
        
        // Check if it's a Home Assistant device
        if (strpos($catalogId, 'ha_') !== 0) {
            continue;
        }
        
        // Extract device capabilities
        $capabilities = extractDeviceCapabilities($catalogId);
        
        // Extract device info
        $device = [
            'id' => generateDeviceId($item),
            'name' => $item['name'] ?? 'Unnamed Device',
            'catalog_id' => $catalogId,
            'type' => extractDeviceType($catalogId),
            'domain' => extractHADomain($catalogId),
            'capabilities' => $capabilities,
            'position' => [
                'x' => floatval($item['x'] ?? 0) / 100,  // Convert cm to meters
                'y' => floatval($item['elevation'] ?? 0) / 100,
                'z' => floatval($item['y'] ?? 0) / 100
            ],
            'rotation' => floatval($item['angle'] ?? 0) * 180 / M_PI  // Radians to degrees
        ];
        
        $devices[] = $device;
    }
    
    return $devices;
}

/**
 * Extract device capabilities from catalog ID
 * For combo sensors like temp+humidity
 */
function extractDeviceCapabilities($catalogId) {
    $capabilities = [];
    
    if (strpos($catalogId, 'temp_humidity') !== false) {
        $capabilities = ['temperature', 'humidity'];
    } elseif (strpos($catalogId, 'motion_light') !== false) {
        $capabilities = ['motion', 'luminosity'];
    } elseif (strpos($catalogId, 'temperature') !== false) {
        $capabilities = ['temperature'];
    } elseif (strpos($catalogId, 'humidity') !== false) {
        $capabilities = ['humidity'];
    } elseif (strpos($catalogId, 'motion') !== false) {
        $capabilities = ['motion'];
    } elseif (strpos($catalogId, 'luminosity') !== false || strpos($catalogId, 'light') !== false) {
        $capabilities = ['luminosity'];
    } elseif (strpos($catalogId, 'dimmer') !== false) {
        $capabilities = ['brightness'];
    }
    
    return $capabilities;
}

/**
 * Extract rooms from home data
 */
function extractRooms($homeData) {
    $rooms = [];
    
    if (!isset($homeData['rooms']) || !is_array($homeData['rooms'])) {
        return $rooms;
    }
    
    foreach ($homeData['rooms'] as $room) {
        $points = [];
        
        if (isset($room['points']) && is_array($room['points'])) {
            foreach ($room['points'] as $point) {
                $points[] = [
                    floatval($point[0] ?? 0) / 100,  // Convert to meters
                    floatval($point[1] ?? 0) / 100
                ];
            }
        }
        
        $rooms[] = [
            'name' => $room['name'] ?? 'Unnamed Room',
            'bounds' => $points,
            'area' => floatval($room['area'] ?? 0) / 10000,  // cm² to m²
            'floor_level' => $room['level']['name'] ?? 'Ground Floor'
        ];
    }
    
    return $rooms;
}

/**
 * Extract walls for Unity reconstruction
 */
function extractWalls($homeData) {
    $walls = [];
    
    if (!isset($homeData['walls']) || !is_array($homeData['walls'])) {
        return $walls;
    }
    
    foreach ($homeData['walls'] as $wall) {
        $walls[] = [
            'start' => [
                floatval($wall['xStart'] ?? 0) / 100,
                floatval($wall['yStart'] ?? 0) / 100
            ],
            'end' => [
                floatval($wall['xEnd'] ?? 0) / 100,
                floatval($wall['yEnd'] ?? 0) / 100
            ],
            'height' => floatval($wall['height'] ?? 250) / 100,
            'thickness' => floatval($wall['thickness'] ?? 10) / 100
        ];
    }
    
    return $walls;
}

/**
 * Generate unique device ID from item properties
 */
function generateDeviceId($item) {
    $name = $item['name'] ?? 'device';
    $cleanName = preg_replace('/[^a-z0-9]+/', '_', strtolower($name));
    $cleanName = trim($cleanName, '_');
    
    // Add unique suffix based on position
    $posStr = sprintf('%.2f_%.2f_%.2f', 
        $item['x'] ?? 0, 
        $item['y'] ?? 0, 
        $item['elevation'] ?? 0
    );
    $suffix = substr(md5($posStr), 0, 6);
    
    return $cleanName . '_' . $suffix;
}

/**
 * Extract device type from catalog ID
 * ha_sensor_temperature -> temperature
 */
function extractDeviceType($catalogId) {
    $parts = explode('_', $catalogId);
    
    // Handle combo sensors
    if (count($parts) >= 4) {
        return $parts[2] . '_' . $parts[3]; // temp_humidity, motion_light
    }
    
    // ha_sensor_temperature -> temperature
    if (count($parts) >= 3) {
        return $parts[2];
    }
    
    // ha_light -> light
    if (count($parts) >= 2) {
        return $parts[1];
    }
    
    return 'unknown';
}

/**
 * Extract Home Assistant domain from catalog ID
 */
function extractHADomain($catalogId) {
    if (strpos($catalogId, 'ha_sensor_') === 0) return 'sensor';
    if (strpos($catalogId, 'ha_light') === 0) return 'light';
    if (strpos($catalogId, 'ha_switch') === 0) return 'switch';
    if (strpos($catalogId, 'ha_binary_') === 0) return 'binary_sensor';
    
    return 'sensor'; // default
}

/**
 * Sanitize filename
 */
function sanitizeFilename($filename) {
    $filename = preg_replace('/[^a-zA-Z0-9_-]/', '_', $filename);
    $filename = preg_replace('/_+/', '_', $filename);
    $filename = trim($filename, '_');
    return $filename ?: 'home';
}
?>