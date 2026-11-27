<?php
  /*
   * writeData.php 21 sept 2023
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

  // Saves the posted data in the file name in "path" parameter
  $dataDir = is_dir('/data/homes') ? '/data/homes' : 'data';
  if (!is_dir($dataDir) && !mkdir($dataDir, 0755, true)) {
    http_response_code(500);
    echo "Failed to create data directory";
    exit;
  }

  $rawPath = $_GET['path'] ?? '';
  if (!is_string($rawPath) || $rawPath === '' || str_contains($rawPath, "\0")) {
    http_response_code(400);
    echo "Missing or invalid path parameter";
    exit;
  }

  // Normalize separators and reject absolute paths or parent-directory traversal
  $normalizedPath = str_replace('\\', '/', $rawPath);
  if (str_starts_with($normalizedPath, '/')) {
    http_response_code(400);
    echo "Invalid path parameter";
    exit;
  }

  $segments = explode('/', $normalizedPath);
  foreach ($segments as $segment) {
    if ($segment === '' || $segment === '.' || $segment === '..') {
      http_response_code(400);
      echo "Invalid path segment";
      exit;
    }
  }

  $realDataDir = realpath($dataDir);
  if ($realDataDir === false) {
    http_response_code(500);
    echo "Data directory unavailable";
    exit;
  }

  $dataFile = $realDataDir . DIRECTORY_SEPARATOR . implode(DIRECTORY_SEPARATOR, $segments);
  $parentDir = dirname($dataFile);

  if (!is_dir($parentDir) && !mkdir($parentDir, 0755, true)) {
    http_response_code(500);
    echo "Failed to create target directory";
    exit;
  }

  $realParentDir = realpath($parentDir);
  if (
    $realParentDir === false ||
    ($realParentDir !== $realDataDir && !str_starts_with($realParentDir, $realDataDir . DIRECTORY_SEPARATOR))
  ) {
    http_response_code(400);
    echo "Path escapes data directory";
    exit;
  }

  $in = fopen("php://input", "rb");
  if ($in === false) {
    http_response_code(500);
    echo "Failed to read request body";
    exit;
  }

  $tmpFile = $realParentDir . DIRECTORY_SEPARATOR . basename($dataFile) . '.tmp.' . getmypid() . '.' . bin2hex(random_bytes(4));
  $out = fopen($tmpFile, 'wb');
  if ($out === false) {
    fclose($in);
    http_response_code(500);
    echo "Failed to open target file for writing";
    exit;
  }

  $writeFailed = false;
  while (!feof($in)) {
    $chunk = fread($in, 8192);
    if ($chunk === false) {
      $writeFailed = true;
      break;
    }
    if ($chunk !== '' && fwrite($out, $chunk) === false) {
      $writeFailed = true;
      break;
    }
  }

  fclose($in);
  $closed = fclose($out);

  if ($writeFailed || !$closed) {
    @unlink($tmpFile);
    http_response_code(500);
    echo "Failed while writing file";
    exit;
  }

  if (!rename($tmpFile, $dataFile)) {
    @unlink($tmpFile);
    http_response_code(500);
    echo "Failed to finalize saved file";
    exit;
  }
?>
