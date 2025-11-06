<?php
/**
 * Save Home Assistant entity mappings for furniture
 * Keeps entity_id mappings separate from SweetHome3D data
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$action = $_POST['action'] ?? $_GET['action'] ?? 'save';
$dataDir = __DIR__ . '/data/';
$mappingFile = $dataDir . 'ha_entity_mappings.json';

// Ensure data directory exists
if (!file_exists($dataDir)) {
    mkdir($dataDir, 0755, true);
}

/**
 * Load existing mappings
 */
function loadMappings($mappingFile) {
    if (file_exists($mappingFile)) {
        $content = file_get_contents($mappingFile);
        $data = json_decode($content, true);
        return $data ?? ['mappings' => []];
    }
    return ['mappings' => []];
}

/**
 * Save mappings
 */
function saveMappings($mappingFile, $data) {
    file_put_contents($mappingFile, json_encode($data, JSON_PRETTY_PRINT));
}

/**
 * Generate stable ID for furniture piece
 */
function generateFurnitureId($piece) {
    // Create stable ID from position + catalog
    $str = sprintf('%s_%.2f_%.2f_%.2f',
        $piece['catalogId'] ?? '',
        floatval($piece['x'] ?? 0),
        floatval($piece['y'] ?? 0),
        floatval($piece['elevation'] ?? 0)
    );
    return md5($str);
}

// Handle different actions
if ($action === 'save') {
    // Save entity mapping for a single furniture piece
    $furnitureData = json_decode($_POST['furniture'] ?? '{}', true);
    $entityId = $_POST['entity_id'] ?? '';
    
    if (empty($furnitureData) || empty($entityId)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing furniture data or entity_id']);
        exit;
    }
    
    $mappings = loadMappings($mappingFile);
    $furnitureId = generateFurnitureId($furnitureData);
    
    // Store mapping
    $mappings['mappings'][$furnitureId] = [
        'entity_id' => $entityId,
        'furniture_name' => $furnitureData['name'] ?? 'Unknown',
        'catalog_id' => $furnitureData['catalogId'] ?? '',
        'position' => [
            'x' => floatval($furnitureData['x'] ?? 0),
            'y' => floatval($furnitureData['y'] ?? 0),
            'elevation' => floatval($furnitureData['elevation'] ?? 0)
        ],
        'updated_at' => date('c')
    ];
    
    saveMappings($mappingFile, $mappings);
    
    echo json_encode([
        'success' => true,
        'furniture_id' => $furnitureId,
        'entity_id' => $entityId
    ]);
    
} elseif ($action === 'load') {
    // Load all mappings
    $mappings = loadMappings($mappingFile);
    echo json_encode($mappings);
    
} elseif ($action === 'delete') {
    // Delete a specific mapping
    $furnitureId = $_POST['furniture_id'] ?? '';
    
    if (empty($furnitureId)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing furniture_id']);
        exit;
    }
    
    $mappings = loadMappings($mappingFile);
    
    if (isset($mappings['mappings'][$furnitureId])) {
        unset($mappings['mappings'][$furnitureId]);
        saveMappings($mappingFile, $mappings);
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Mapping not found']);
    }
    
} elseif ($action === 'clear') {
    // Clear all mappings
    saveMappings($mappingFile, ['mappings' => []]);
    echo json_encode(['success' => true, 'message' => 'All mappings cleared']);
    
} else {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid action']);
}

/**
 * Helper function to merge entity mappings with furniture export data
 * Called from exportForUnity.php
 */
function mergeEntityMappings($devices) {
    $mappingFile = __DIR__ . '/data/ha_entity_mappings.json';
    $mappings = loadMappings($mappingFile);
    
    foreach ($devices as &$device) {
        // Generate same ID as used during save
        $furnitureId = generateFurnitureId([
            'catalogId' => $device['catalog_id'] ?? '',
            'x' => ($device['position']['x'] ?? 0) * 100, // Convert back to cm
            'y' => ($device['position']['z'] ?? 0) * 100,
            'elevation' => ($device['position']['y'] ?? 0) * 100
        ]);
        
        // Add entity_id if mapping exists
        if (isset($mappings['mappings'][$furnitureId])) {
            $device['entity_id'] = $mappings['mappings'][$furnitureId]['entity_id'];
        }
    }
    
    return $devices;
}
?>