<?php
  /*
   * listHomesExtended.php — returns homes with device/geometry availability
   *
   * Returns JSON array of objects:
   *   [{"id":"home-abc","hasDevices":true,"hasGeometry":false},...]
   *
   * Separate from listHomes.php to avoid breaking SweetHome3D core
   * which expects a plain string array.
   */

  header('Content-Type: application/json');

  $dataDir = "data";
  $homes = [];

  if (is_dir($dataDir)) {
    $handler = opendir($dataDir);
    while ($file = readdir($handler)) {
      if (!is_dir($dataDir . '/' . $file) && str_ends_with($file, '.sh3x')) {
        $homeId = substr($file, 0, -5);
        $homes[] = [
          'id'          => $homeId,
          'hasDevices'  => file_exists($dataDir . '/' . $homeId . '_devices.json'),
          'hasGeometry' => file_exists($dataDir . '/' . $homeId . '_geometry.zip'),
        ];
      }
    }
    closedir($handler);
  }

  echo json_encode($homes);
?>
