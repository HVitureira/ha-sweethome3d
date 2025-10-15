<?php 
  /*
   * readData.php 
   *
   * Sweet Home 3D, Copyright (c) 2024 Space Mushrooms <info@sweethome3d.com>
   *
   * This program is free software; you can redistribute it and/or modify
   * it under the terms of the GNU General Public License as published by
   * the Free Software Foundation; either version 2 of the License, or
   * (at your option) any later version.
   *
   * This program is distributed in the hope that it will be useful,
   * but WITHOUT ANY WARRANTY; without even the implied warranty of
   * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   * GNU General Public License for more details.
   *
   * You should have received a copy of the GNU General Public License
   * along with this program; if not, write to the Free Software
   * Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
   */
   
  // Reads data from the file name in "path" parameter
  $dataDir = "data";
  $path = $_GET['path'] ?? '';
  
  if (empty($path)) {
    http_response_code(400);
    echo "Missing path parameter";
    exit;
  }
  
  $dataFile = $dataDir."/".$path;
  
  if (!file_exists($dataFile)) {
    // Return default empty object for userPreferences.json
    if ($path === 'userPreferences.json') {
      header('Content-Type: application/json');
      echo json_encode([
        "unit" => "CENTIMETER",
        "language" => "en",
        "currency" => "USD",
        "furnitureCatalogViewedInTree" => true,
        "navigationPanelVisible" => true,
        "magnetismEnabled" => true,
        "rulersVisible" => true,
        "gridVisible" => true,
        "defaultFontName" => "Arial",
        "wallsAlpha" => 0,
        "newWallHeight" => 250,
        "newWallThickness" => 7.5,
        "autoSaveDelayForRecovery" => 300000,
        "recentHomes" => []
      ]);
    } else {
      http_response_code(404);
      echo "File not found";
    }
    exit;
  }
  
  // Set appropriate content type
  if (pathinfo($dataFile, PATHINFO_EXTENSION) === 'json') {
    header('Content-Type: application/json');
  }
  
  // Output file contents
  readfile($dataFile);
?>
