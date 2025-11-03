<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Get input
$homeName = $_POST['home_name'] ?? 'smart-home';
$homeDataRaw = $_POST['home_data'] ?? null;
$objData = $_POST['obj_data'] ?? null;  // OBJ file content
$mtlData = $_POST['mtl_data'] ?? null;  // MTL file content

// ... existing validation code ...

// Existing device/room/wall extraction...
$devices = extractDevices($homeData);
$rooms = extractRooms($homeData);
$walls = extractWalls($homeData);

// ... existing JSON export code ...

// NEW: Handle OBJ/MTL export if provided
if ($objData) {
    $objPath = $exportDir . $filename . '_model.obj';
    file_put_contents($objPath, $objData);
    
    if ($mtlData) {
        $mtlPath = $exportDir . $filename . '_model.mtl';
        file_put_contents($mtlPath, $mtlData);
    }
    
    // Copy to HA www folder for Unity access
    if (file_exists($haPath) && is_writable($haPath)) {
        copy($objPath, $haPath . 'model.obj');
        if ($mtlData) {
            copy($mtlPath, $haPath . 'model.mtl');
        }
        $haCopied = true;
    }
}

// Update response to include OBJ info
echo json_encode([
    'success' => true,
    'devices_count' => count($devices),
    'rooms_count' => count($rooms),
    'export_path' => 'data/exports/' . basename($jsonPath),
    'latest_path' => 'data/exports/' . basename($latestPath),
    'ha_path_copied' => $haCopied,
    'obj_exported' => isset($objData),  // NEW
    'obj_path' => isset($objData) ? 'data/exports/' . $filename . '_model.obj' : null,  // NEW
    'timestamp' => $timestamp,
    'devices' => array_map(function($d) {
        return ['id' => $d['id'], 'name' => $d['name'], 'type' => $d['type']];
    }, $devices)
]);