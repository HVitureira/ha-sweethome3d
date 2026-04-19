/**
 * OBJExporter.js - Export SweetHome3D scene to OBJ format with textures
 * Compatible with the JavaScript version of SweetHome3D
 * Based on the Java OBJWriter implementation
 * 
 * Version: 2.0 - With actual model loading support
 * Updated: 2025-11-02 22:34
 * 
 * Usage:
 *   const exporter = new OBJExporter();
 *   exporter.exportToOBJ(home, component3D, 'my-home.zip');
 */

class OBJExporter {
  constructor() {
    this.vertices = [];
    this.normals = [];
    this.texCoords = [];
    this.faces = [];
    this.materials = new Map();
    this.textures = new Map();
    this.currentMaterial = null;
    this.vertexIndex = 1;
    this.normalIndex = 1;
    this.texCoordIndex = 1;
    this.precision = 7; // Decimal places for coordinates
    this.textureHashes = new Map(); // hash -> textureName for O(1) deduplication

    // Initialize default materials if available
    this.defaultMaterials = new Map();
    if (typeof DEFAULT_MTL_CONTENT !== 'undefined') {
        try {
            // Re-use parseMTLTextures logic but with empty texture map
            this.defaultMaterials = this.parseMTLTextures(DEFAULT_MTL_CONTENT, new Map());
            // console.log(`Loaded ${this.defaultMaterials.size} default materials.`);
        } catch (e) {
            console.warn("Failed to parse default materials:", e);
        }
    }
  }

  /**
   * Main export function - exports entire home to OBJ with textures
   * @param {Home} home - The SweetHome3D home object
   * @param {HomeComponent3D} component3D - The 3D component with rendered scene
   * @param {string} filename - Output filename (will be .zip)
   */
  async exportToOBJ(home, component3D, filename = 'home.zip') {
    // Uncomment for debugging export initialization
    // console.log('🚀 Starting OBJ export...');
    // console.log('Home:', home);
    // console.log('Component3D:', component3D);
    // console.log('Filename:', filename);
    
    // Check if JSZip is available
    if (typeof JSZip === 'undefined') {
      throw new Error('JSZip library not loaded. Please include jszip.min.js');
    }
    
    // Validate home object
    if (!home) {
      throw new Error('Home object is null or undefined');
    }

    this.reset();
    
    try {
      // Export header
      const objHeader = this.generateHeader(home);
      
      // Reference to MTL file
      const mtlFileName = 'materials.mtl';
      let objContent = objHeader;
      objContent += `mtllib ${mtlFileName}\n\n`;
      
      // Export geometry from home
      await this.exportHome(home, component3D);
      
      // Build OBJ file content
      objContent += this.buildOBJContent();
      
      // Build MTL file content
      const mtlContent = this.buildMTLContent();
      
      // Create ZIP file with OBJ, MTL, and textures
      const zipBlob = await this.createZipFile(
        filename.replace('.zip', ''),
        objContent,
        mtlContent
      );
      
      // Trigger download
      this.downloadBlob(zipBlob, filename.endsWith('.zip') ? filename : filename + '.zip');
      
      const result = {
        success: true,
        vertices: this.vertices.length,
        faces: this.faces.length,
        materials: this.materials.size,
        textures: this.textures.size
      };

      console.log('✅ OBJ Export completed:', result);
      return result;
      
    } catch (error) {
      console.error('❌ OBJ Export error:', error);
      console.error('Stack trace:', error.stack);
      throw error;
    }
  }

  /**
   * Generate OBJ file header
   */
  generateHeader(home) {
    const date = new Date().toISOString();
    const homeName = home.getName ? home.getName() : 'Untitled';
    
    return `# Exported from SweetHome3D JS
# Home: ${homeName}
# Date: ${date}
# Exporter: OBJExporter.js for Unity Digital Twin Integration

`;
  }

  /**
   * Export all elements from home
   */
  async exportHome(home, component3D) {
    // Uncomment for detailed debugging of home element counts
    // console.log('📦 Exporting home elements...');
    // console.log('Home object:', home);
    
    let wallCount = 0, roomCount = 0, furnitureCount = 0;
    
    // Export walls
    if (home.getWalls) {
      const walls = home.getWalls();
      // Uncomment to debug wall count: console.log('Found walls:', walls ? walls.length : 0);
      if (walls && walls.length > 0) {
        for (let i = 0; i < walls.length; i++) {
          await this.exportWall(walls[i], `wall_${i}`);
          wallCount++;
        }
      }
    }
    
    // Export rooms (floors and ceilings)
    if (home.getRooms) {
      const rooms = home.getRooms();
      // Uncomment to debug room count: console.log('Found rooms:', rooms ? rooms.length : 0);
      if (rooms && rooms.length > 0) {
        for (let i = 0; i < rooms.length; i++) {
          await this.exportRoom(rooms[i], `room_${i}`);
          roomCount++;
        }
      }
    }
    
    // Export furniture — parallel fetch, sequential integrate
    if (home.getFurniture) {
      const furniture = home.getFurniture();
      if (furniture && furniture.length > 0) {
        // Phase 1: Resolve model URLs and prepare metadata (synchronous)
        const furnitureItems = [];
        for (let i = 0; i < furniture.length; i++) {
          furnitureItems.push({ piece: furniture[i], name: `furniture_${i}` });
        }

        // Phase 2: Prefetch all model ZIPs in parallel batches of 6
        const BATCH_SIZE = 6;
        const prefetched = new Array(furnitureItems.length);
        for (let batchStart = 0; batchStart < furnitureItems.length; batchStart += BATCH_SIZE) {
          const batchEnd = Math.min(batchStart + BATCH_SIZE, furnitureItems.length);
          const batchPromises = [];
          for (let i = batchStart; i < batchEnd; i++) {
            batchPromises.push(
              this.prefetchFurnitureModel(furnitureItems[i].piece, furnitureItems[i].name)
                .then(data => { prefetched[i] = data; })
                .catch(() => { prefetched[i] = null; })
            );
          }
          await Promise.all(batchPromises);
        }

        // Phase 3: Integrate sequentially (shared state: vertices, faces, etc.)
        for (let i = 0; i < furnitureItems.length; i++) {
          const data = prefetched[i];
          if (data && data.objContent) {
            const { piece } = furnitureItems[i];
            const pX = piece.getX ? piece.getX() : 0;
            const pY = piece.getY ? piece.getY() : 0;
            const elev = piece.getElevation ? piece.getElevation() : 0;
            const ang = piece.getAngle ? piece.getAngle() : 0;
            this.addComment(`Furniture: ${furnitureItems[i].name} - ${piece.getName ? piece.getName() : 'Unknown'}`);
            await this.integrateOBJContent(data.objContent, pX, pY, elev, ang, furnitureItems[i].name, piece, data.materialTextureMap);
          } else if (data && data.useBoundingBox) {
            this.addComment(`Furniture: ${furnitureItems[i].name} - ${furnitureItems[i].piece.getName ? furnitureItems[i].piece.getName() : 'Unknown'}`);
            this.exportFurnitureBoundingBox(furnitureItems[i].piece, furnitureItems[i].name);
          }
          furnitureCount++;
        }
      }
    }
    
    // Uncomment for export summary: console.log(`📊 Export summary: ${wallCount} walls, ${roomCount} rooms, ${furnitureCount} furniture items`);
    // Uncomment to see geometry stats: console.log(`📊 Generated: ${this.vertices.length} vertices, ${this.faces.length} faces`);
    
    // If nothing was exported, throw an error
    if (this.vertices.length === 0) {
      const totalItems = wallCount + roomCount + furnitureCount;
      if (totalItems === 0) {
        throw new Error('No geometry exported. The home is empty - no walls, rooms, or furniture found.');
      } else {
        throw new Error(`No geometry exported. Found ${totalItems} items but failed to generate geometry.`);
      }
    }
  }

  /**
   * Export a wall to OBJ format
   */
  async exportWall(wall, name) {
    if (!wall) {
      return;
    }
    
    const xStart = wall.getXStart ? wall.getXStart() : 0;
    const yStart = wall.getYStart ? wall.getYStart() : 0;
    const xEnd = wall.getXEnd ? wall.getXEnd() : 0;
    const yEnd = wall.getYEnd ? wall.getYEnd() : 0;
    const height = wall.getHeight ? wall.getHeight() : 250;
    const thickness = wall.getThickness ? wall.getThickness() : 10;
    
    // Skip if wall has no length
    if (xStart === xEnd && yStart === yEnd) {
      return;
    }
    
    // Calculate wall direction
    const dx = xEnd - xStart;
    const dy = yEnd - yStart;
    const length = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / length; // Normal perpendicular to wall
    const ny = dx / length;
    
    // Wall vertices (front face)
    const v1 = [xStart - nx * thickness / 2, 0, yStart - ny * thickness / 2];
    const v2 = [xEnd - nx * thickness / 2, 0, yEnd - ny * thickness / 2];
    const v3 = [xEnd - nx * thickness / 2, height, yEnd - ny * thickness / 2];
    const v4 = [xStart - nx * thickness / 2, height, yStart - ny * thickness / 2];
    
    // Back face
    const v5 = [xStart + nx * thickness / 2, 0, yStart + ny * thickness / 2];
    const v6 = [xEnd + nx * thickness / 2, 0, yEnd + ny * thickness / 2];
    const v7 = [xEnd + nx * thickness / 2, height, yEnd + ny * thickness / 2];
    const v8 = [xStart + nx * thickness / 2, height, yStart + ny * thickness / 2];

    // Extract wall index from name (e.g., 'wall_5' -> 5)
    const wallIndex = parseInt(name.split('_')[1]) || 0;

    // Get materials for both sides of the wall
    const leftMaterialName = await this.getWallMaterial(wall, wallIndex);
    const rightMaterialName = await this.getWallRightSideMaterial(wall, wallIndex);

    this.addComment(`Wall: ${name}`);

    // Get material info for both sides
    const leftMaterial = this.materials.get(leftMaterialName);
    const rightMaterial = this.materials.get(rightMaterialName);
    const hasLeftTexture = leftMaterial && leftMaterial.texture;
    const hasRightTexture = rightMaterial && rightMaterial.texture;

    // Front face (left side material) - faces negative normal direction
    this.setMaterial(leftMaterialName);
    if (hasLeftTexture) {
      this.addQuadWithTexture(v1, v2, v3, v4, [0, 0, -1], leftMaterial.textureTransform);
    } else {
      this.addQuad(v1, v2, v3, v4, [0, 0, -1]);
    }

    // Back face (right side material) - faces positive normal direction
    this.setMaterial(rightMaterialName);
    if (hasRightTexture) {
      this.addQuadWithTexture(v6, v5, v8, v7, [0, 0, 1], rightMaterial.textureTransform);
    } else {
      this.addQuad(v6, v5, v8, v7, [0, 0, 1]);
    }

    // Top face - use left side material as default
    this.setMaterial(leftMaterialName);
    if (hasLeftTexture) {
      this.addQuadWithTexture(v4, v3, v7, v8, [0, 1, 0], leftMaterial.textureTransform);
    } else {
      this.addQuad(v4, v3, v7, v8, [0, 1, 0]);
    }

    // Side faces (ends of wall) - use left side material
    if (hasLeftTexture) {
      this.addQuadWithTexture(v5, v1, v4, v8, [-nx, 0, -ny], leftMaterial.textureTransform);
      this.addQuadWithTexture(v2, v6, v7, v3, [nx, 0, ny], leftMaterial.textureTransform);
    } else {
      this.addQuad(v5, v1, v4, v8, [-nx, 0, -ny]);
      this.addQuad(v2, v6, v7, v3, [nx, 0, ny]);
    }
  }

  /**
   * Export a room (floor and ceiling)
   */
  async exportRoom(room, name) {
    if (!room) {
      return;
    }

    const points = room.getPoints ? room.getPoints() : [];
    if (points.length < 3) {
      return;
    }

    const floorLevel = 0;
    const ceilingHeight = 250; // Default ceiling height

    // Extract room index from name (e.g., 'room_5' -> 5)
    const roomIndex = parseInt(name.split('_')[1]) || 0;

    this.addComment(`Room: ${name} - ${room.getName ? room.getName() : 'Unnamed'}`);

    // Floor with texture support
    const floorMaterial = await this.getRoomFloorMaterialWithTexture(room, roomIndex);
    this.setMaterial(floorMaterial);

    const floorMat = this.materials.get(floorMaterial);
    const hasFloorTexture = floorMat && floorMat.texture;

    // Triangulate floor polygon
    const floorTriangles = this.triangulatePolygon(points, floorLevel, true);
    for (const tri of floorTriangles) {
      if (hasFloorTexture) {
        this.addTriangleWithTexture(tri[0], tri[1], tri[2], [0, -1, 0], floorMat.textureTransform);
      } else {
        this.addTriangle(tri[0], tri[1], tri[2], [0, -1, 0]);
      }
    }

    // Ceiling with texture support
    const ceilingMaterial = await this.getRoomCeilingMaterialWithTexture(room, roomIndex);
    this.setMaterial(ceilingMaterial);

    const ceilingMat = this.materials.get(ceilingMaterial);
    const hasCeilingTexture = ceilingMat && ceilingMat.texture;

    // Triangulate ceiling polygon
    const ceilingTriangles = this.triangulatePolygon(points, ceilingHeight, false);
    for (const tri of ceilingTriangles) {
      if (hasCeilingTexture) {
        this.addTriangleWithTexture(tri[0], tri[1], tri[2], [0, 1, 0], ceilingMat.textureTransform);
      } else {
        this.addTriangle(tri[0], tri[1], tri[2], [0, 1, 0]);
      }
    }
  }

  /**
   * Export furniture piece
   */
  async exportFurniture(piece, name, component3D) {
    if (!piece) {
      console.warn('⚠️ Furniture piece is null or undefined');
      return;
    }
    
    const x = piece.getX ? piece.getX() : 0;
    const y = piece.getY ? piece.getY() : 0;
    const elevation = piece.getElevation ? piece.getElevation() : 0;
    const angle = piece.getAngle ? piece.getAngle() : 0;
    
    const pieceName = piece.getName ? piece.getName() : 'Unnamed';
    const catalogId = piece.getCatalogId ? piece.getCatalogId() : null;
    
    // Uncomment for detailed furniture debugging
    // console.log(`  📦 Exporting furniture: ${name} (${pieceName})`);
    // console.log(`    Catalog ID: ${catalogId}`);
    
    this.addComment(`Furniture: ${name} - ${pieceName}`);
    
    // Try to get model URL/path from piece
    const model = piece.getModel ? piece.getModel() : null;
    
    // Check if we can get the model URL
    let modelURL = null;
    if (model && model.getURL) {
      modelURL = model.getURL();
    }
    
    // If no model URL, try to construct from catalog ID
    if (!modelURL && catalogId) {
      // Try to construct model path from catalog ID
      // Usually in format: lib/resources/models/modelname.zip
      modelURL = `lib/resources/models/${catalogId}.zip`;
    }
    
    // Try to load and export actual model
    if (modelURL) {
      try {
        // Handle JAR URLs (jar:file:...!/...) or plain OBJ references
        if (modelURL.startsWith('jar:')) {
          const jarMatch = modelURL.match(/jar:[^!]+!\/(.+)/);
          if (jarMatch) {
            const innerPath = jarMatch[1];
            // The inner path is like "chest.obj" but we need "lib/resources/models/chest.zip"
            const fileNameMatch = innerPath.match(/([^\/]+)\.obj$/i);
            if (fileNameMatch) {
              const baseName = fileNameMatch[1];
              modelURL = `lib/resources/models/${baseName}.zip`;
            } else {
              modelURL = innerPath.startsWith('lib/') ? innerPath : `lib/${innerPath}`;
            }
          }
        } else if (modelURL.endsWith('.obj')) {
          // If it's just a .obj file, convert to .zip
          const fileNameMatch = modelURL.match(/([^\/]+)\.obj$/i);
          if (fileNameMatch) {
            const baseName = fileNameMatch[1];
            modelURL = `lib/resources/models/${baseName}.zip`;
          }
        }
        
        await this.exportModelFromURL(modelURL, x, y, elevation, angle, name, piece);
        // Uncomment to track 3D model exports: console.log(`    ✅ Exported 3D model: ${pieceName}`);
        return;
      } catch (error) {
        // Only log errors in production for serious issues
        console.error(`Failed to load model for ${pieceName}:`, error.message);
        // Uncomment for detailed error debugging: console.error('Full error:', error);
      }
    }
    
    // Fallback: Use bounding box representation
    this.exportFurnitureBoundingBox(piece, name);
    // Uncomment to track bounding box fallbacks: console.log(`    ℹ️ Exported as bounding box: ${pieceName}`);
  }

  /**
   * Prefetch a furniture model's ZIP, extract OBJ content + material data.
   * Returns { objContent, materialTextureMap } or { useBoundingBox: true } on failure.
   * Does NOT modify shared exporter state (vertices/faces) — safe for parallel calls.
   */
  async prefetchFurnitureModel(piece, name) {
    if (!piece) return null;

    const catalogId = piece.getCatalogId ? piece.getCatalogId() : null;
    const model = piece.getModel ? piece.getModel() : null;

    let modelURL = null;
    if (model && model.getURL) modelURL = model.getURL();
    if (!modelURL && catalogId) modelURL = `lib/resources/models/${catalogId}.zip`;

    if (!modelURL) return { useBoundingBox: true };

    // Resolve JAR / OBJ URLs to ZIP paths
    if (modelURL.startsWith('jar:')) {
      const jarMatch = modelURL.match(/jar:[^!]+!\/(.+)/);
      if (jarMatch) {
        const fileNameMatch = jarMatch[1].match(/([^\/]+)\.obj$/i);
        if (fileNameMatch) modelURL = `lib/resources/models/${fileNameMatch[1]}.zip`;
        else modelURL = jarMatch[1].startsWith('lib/') ? jarMatch[1] : `lib/${jarMatch[1]}`;
      }
    } else if (modelURL.endsWith('.obj')) {
      const fileNameMatch = modelURL.match(/([^\/]+)\.obj$/i);
      if (fileNameMatch) modelURL = `lib/resources/models/${fileNameMatch[1]}.zip`;
    }

    try {
      return await this._fetchAndParseModelZip(modelURL, name);
    } catch (error) {
      console.error(`Failed to prefetch model for ${piece.getName ? piece.getName() : name}:`, error.message);
      return { useBoundingBox: true };
    }
  }

  /**
   * Fetch a model ZIP and extract OBJ content + material texture map.
   * Textures are added to the exporter (addTexture is safe for concurrent calls since
   * it only appends to this.textures Map with unique keys).
   */
  async _fetchAndParseModelZip(modelURL, name) {
    return new Promise((resolve, reject) => {
      ZIPTools.getZIP(modelURL, false, {
        zipReady: async (zip) => {
          try {
            let objFile = null, objFileName = null, mtlFile = null;
            const textureFiles = [];

            const files = zip.file(/.*/);
            for (let i = 0; i < files.length; i++) {
              const fileName = files[i].name.toLowerCase();
              if (fileName.endsWith('.obj')) { objFile = files[i]; objFileName = files[i].name; }
              else if (fileName.endsWith('.mtl')) { mtlFile = files[i]; }
              else if (fileName.match(/\.(jpg|jpeg|png|bmp|gif)$/)) { textureFiles.push(files[i]); }
            }

            if (!objFile) { reject(new Error('No OBJ file found in model ZIP')); return; }

            // Find matching MTL
            const expectedMtlName = objFileName.replace(/\.obj$/i, '.mtl');
            let selectedMtlFile = mtlFile;
            for (let i = 0; i < files.length; i++) {
              if (files[i].name.toLowerCase().endsWith(expectedMtlName.toLowerCase()) ||
                  files[i].name.toLowerCase() === expectedMtlName.toLowerCase()) {
                selectedMtlFile = files[i]; break;
              }
            }

            // Extract textures (addTexture uses hash dedup, safe for concurrent calls)
            const textureMap = new Map();
            for (const texFile of textureFiles) {
              try {
                const texData = texFile.asUint8Array().buffer;
                const texBaseName = `furniture_${name}_${texFile.name.split('.')[0]}`;
                const texName = await this.addTexture(texBaseName, texFile.name, texData);
                textureMap.set(texFile.name, texName);
              } catch (e) { console.warn(`Failed to extract texture ${texFile.name}:`, e.message); }
            }

            // Parse MTL
            let materialTextureMap = new Map();
            if (selectedMtlFile) {
              materialTextureMap = this.parseMTLTextures(selectedMtlFile.asText(), textureMap);
            }

            resolve({ objContent: objFile.asText(), materialTextureMap });
          } catch (error) { reject(error); }
        },
        zipError: (error) => { reject(new Error(`Failed to load ZIP: ${error}`)); }
      });
    });
  }

  /**
   * Load and export 3D model from URL (ZIP file containing OBJ)
   */
  async exportModelFromURL(modelURL, x, y, elevation, angle, name, piece) {
    // Uncomment to debug model loading: console.log(`    📥 Loading model from: ${modelURL}`);

    return new Promise((resolve, reject) => {
      // Use SweetHome3D's ZIPTools to load the ZIP file (same as ModelLoader)
      ZIPTools.getZIP(modelURL, false, {
        zipReady: async (zip) => {
          try {
            // Find OBJ, MTL, and texture files in the ZIP
            let objFile = null;
            let objFileName = null;
            let mtlFile = null;
            const textureFiles = [];

            const files = zip.file(/.*/);
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              const fileName = file.name.toLowerCase();

              if (fileName.endsWith('.obj')) {
                objFile = file;
                objFileName = file.name;
              } else if (fileName.endsWith('.mtl')) {
                mtlFile = file;
              } else if (fileName.match(/\.(jpg|jpeg|png|bmp|gif)$/)) {
                textureFiles.push(file);
              }
            }

            if (!objFile) {
              reject(new Error('No OBJ file found in model ZIP'));
              return;
            }

            // Prefer MTL file validation (look for one matching the OBJ name)
            const expectedMtlName = objFileName.replace(/\.obj$/i, '.mtl');
            let selectedMtlFile = mtlFile; // Default to last found
            
            // Try to find exact match
            const files2 = zip.file(/.*/);
            for (let i = 0; i < files2.length; i++) {
               if (files2[i].name.toLowerCase().endsWith(expectedMtlName.toLowerCase()) || 
                   files2[i].name.toLowerCase() === expectedMtlName.toLowerCase()) {
                 selectedMtlFile = files2[i];
                 break;
               }
            }

            // Uncomment to see which OBJ files are loaded: 
            // console.log(`    📄 Found OBJ file: ${objFileName}`);
            // if (selectedMtlFile) console.log(`    📄 Found MTL file: ${selectedMtlFile.name}`); (uncommented below)

            // Extract textures from ZIP
            const textureMap = new Map(); // originalFileName -> exportedTextureName
            for (const texFile of textureFiles) {
              try {
                const texData = texFile.asUint8Array().buffer;
                const texBaseName = `furniture_${name}_${texFile.name.split('.')[0]}`;
                const texName = await this.addTexture(texBaseName, texFile.name, texData);
                textureMap.set(texFile.name, texName);
              } catch (error) {
                console.warn(`⚠️ Failed to extract texture ${texFile.name}:`, error.message);
              }
            }

            // Parse MTL file to map materials to textures
            let materialTextureMap = new Map();
            if (selectedMtlFile) {
              const mtlContent = selectedMtlFile.asText();
              materialTextureMap = this.parseMTLTextures(mtlContent, textureMap);
              // console.log(`    🎨 Parsed ${materialTextureMap.size} materials from MTL`);
            } else {
              console.warn(`    ⚠️ No MTL file found for ${objFileName}, materials will be generic`);
            }

            // Read OBJ content
            const objContent = objFile.asText();

            // Parse and integrate the OBJ file with texture mapping
            await this.integrateOBJContent(objContent, x, y, elevation, angle, name, piece, materialTextureMap);

            resolve();
          } catch (error) {
            reject(error);
          }
        },
        zipError: (error) => {
          reject(new Error(`Failed to load ZIP: ${error}`));
        }
      });
    });
  }

  /**
   * Parse MTL file to extract texture references and material colors
   * @param {string} mtlContent - MTL file content
   * @param {Map} textureMap - Map of original texture names to exported names
   * @returns {Map} - Map of material names to material data {texture, diffuse, ambient, specular, shininess}
   */
  parseMTLTextures(mtlContent, textureMap) {
    const materialDataMap = new Map();
    const lines = mtlContent.split('\n');
    let currentMaterial = null;
    let currentData = null;

    // Create case-insensitive texture lookup
    const textureMapLower = new Map();
    for (const [key, value] of textureMap) {
      textureMapLower.set(key.toLowerCase(), value);
    }

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('newmtl ')) {
        // Save previous material data
        if (currentMaterial && currentData) {
          materialDataMap.set(currentMaterial, currentData);
        }
        currentMaterial = trimmed.substring(7).trim();
        currentData = {
          texture: null,
          diffuse: [0.8, 0.8, 0.8],  // Default gray
          ambient: [0.2, 0.2, 0.2],
          specular: [0.0, 0.0, 0.0],
          shininess: 30
        };
      } else if (currentMaterial && currentData) {
        const parseVal = (val, def) => {
            const parsed = parseFloat(val);
            return isNaN(parsed) ? def : parsed;
          };

          if (trimmed.startsWith('map_Kd ')) {
            const texturePath = trimmed.substring(7).trim();
            // Get filename and handle both forward and back slashes
            const textureFileName = texturePath.split(/[/\\]/).pop();

            // Case-insensitive texture lookup
            const lowerFileName = textureFileName.toLowerCase();
            if (textureMapLower.has(lowerFileName)) {
              currentData.texture = textureMapLower.get(lowerFileName);
            }
          } else if (trimmed.startsWith('Kd ')) {
            // Parse diffuse color: Kd r g b
            const parts = trimmed.substring(3).trim().split(/\s+/);
            if (parts.length >= 3) {
              currentData.diffuse = [
                parseVal(parts[0], 0.8),
                parseVal(parts[1], 0.8),
                parseVal(parts[2], 0.8)
              ];
            }
          } else if (trimmed.startsWith('Ka ')) {
            // Parse ambient color: Ka r g b
            const parts = trimmed.substring(3).trim().split(/\s+/);
            if (parts.length >= 3) {
              currentData.ambient = [
                parseVal(parts[0], 0.2),
                parseVal(parts[1], 0.2),
                parseVal(parts[2], 0.2)
              ];
            }
          } else if (trimmed.startsWith('Ks ')) {
            // Parse specular color: Ks r g b
            const parts = trimmed.substring(3).trim().split(/\s+/);
            if (parts.length >= 3) {
              currentData.specular = [
                parseVal(parts[0], 0.0),
                parseVal(parts[1], 0.0),
                parseVal(parts[2], 0.0)
              ];
            }
          } else if (trimmed.startsWith('Ns ')) {
            // Parse shininess: Ns value
            currentData.shininess = parseVal(trimmed.substring(3).trim(), 30);
          }
      }
    }

    // Save last material
    if (currentMaterial && currentData) {
      materialDataMap.set(currentMaterial, currentData);
    }

    return materialDataMap;
  }

  /**
   * Parse OBJ content and add to our export with transformations
   */
  async integrateOBJContent(objContent, x, y, elevation, angle, name, piece, materialTextureMap = new Map()) {
    const lines = objContent.split('\n');

    // Track the starting indices for this model
    const vertexOffset = this.vertexIndex - 1;
    const normalOffset = this.normalIndex - 1;
    const texCoordOffset = this.texCoordIndex - 1;

    // Get target dimensions
    const width = piece.getWidth ? piece.getWidth() : 1;
    const depth = piece.getDepth ? piece.getDepth() : 1;
    const height = piece.getHeight ? piece.getHeight() : 1;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Check for furniture color override (user-applied color in SweetHome3D)
    const colorOverride = piece.getColor ? piece.getColor() : null;
    let overrideR = 0.8, overrideG = 0.8, overrideB = 0.8;
    if (colorOverride !== null && colorOverride !== undefined) {
      overrideR = (colorOverride >> 16 & 0xFF) / 255.0;
      overrideG = (colorOverride >> 8 & 0xFF) / 255.0;
      overrideB = (colorOverride & 0xFF) / 255.0;
    }

    const materialName = `furniture_${name}`;

    // Create default furniture material with color override if applicable
    if (colorOverride !== null && colorOverride !== undefined) {
      this.materials.set(materialName, {
        name: materialName,
        ambient: [overrideR * 0.2, overrideG * 0.2, overrideB * 0.2],
        diffuse: [overrideR, overrideG, overrideB],
        specular: [0.3, 0.3, 0.3],
        shininess: 30,
        transparency: 1.0,
        texture: null
      });
    }
    this.setMaterial(materialName);

    // Pre-build lowercase lookup maps for O(1) case-insensitive material matching
    const materialMapLower = new Map();
    if (typeof materialTextureMap.get === 'function') {
      for (const [key, value] of materialTextureMap) {
        materialMapLower.set(key.toLowerCase(), value);
      }
    }
    const defaultMaterialsLower = new Map();
    if (this.defaultMaterials) {
      for (const [key, value] of this.defaultMaterials) {
        defaultMaterialsLower.set(key.toLowerCase(), value);
      }
    }

    // ---- Single pass: collect raw vertices + bounds, process normals/UVs/faces/materials ----
    const rawVerts = []; // store raw vertex positions for deferred transform
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    const vertexStartIdx = this.vertices.length; // where this model's vertices begin in the master array

    let currentObjMaterial = null;

    // Reusable face-vertex buffer (avoids per-face array allocation)
    const fvBuf = new Array(16);

    for (let lineIdx = 0, lineCount = lines.length; lineIdx < lineCount; lineIdx++) {
      const trimmed = lines[lineIdx].trim();
      if (trimmed.length === 0 || trimmed.charCodeAt(0) === 35) continue; // skip empty/'#'

      // Detect line type by first characters (faster than startsWith for hot loop)
      const c0 = trimmed.charCodeAt(0);
      const c1 = trimmed.charCodeAt(1);

      if (c0 === 118) { // 'v'
        if (c1 === 32) {
          // Vertex: 'v '
          const parts = trimmed.split(/\s+/);
          const vx = parseFloat(parts[1]);
          const vy = parseFloat(parts[2]);
          const vz = parseFloat(parts[3]);

          // Track bounds incrementally
          if (vx < minX) minX = vx; if (vx > maxX) maxX = vx;
          if (vy < minY) minY = vy; if (vy > maxY) maxY = vy;
          if (vz < minZ) minZ = vz; if (vz > maxZ) maxZ = vz;

          // Store raw position; will transform after bounds are known
          rawVerts.push(vx, vy, vz);
          this.vertices.push(null); // placeholder — overwritten after loop
          this.vertexIndex++;

        } else if (c1 === 110) {
          // Normal: 'vn'
          const parts = trimmed.split(/\s+/);
          const nx = parseFloat(parts[1]);
          const ny = parseFloat(parts[2]);
          const nz = parseFloat(parts[3]);

          // Rotate normal (no translation)
          const rotNx = nx * cos - nz * sin;
          const rotNz = nx * sin + nz * cos;

          this.normals.push([rotNx, ny, rotNz]);
          this.normalIndex++;

        } else if (c1 === 116) {
          // Texture coord: 'vt'
          const parts = trimmed.split(/\s+/);
          this.texCoords.push([parseFloat(parts[1]), parseFloat(parts[2])]);
          this.texCoordIndex++;
        }

      } else if (c0 === 102 && c1 === 32) {
        // Face: 'f '
        const parts = trimmed.split(/\s+/);
        const faceCount = parts.length - 1;

        // Parse face vertices into reusable buffer
        for (let fi = 0; fi < faceCount; fi++) {
          const indices = parts[fi + 1].split('/');
          const vIdx = parseInt(indices[0]);
          const vtIdx = indices[1] && indices[1] !== '' ? parseInt(indices[1]) : null;
          const vnIdx = indices[2] && indices[2] !== '' ? parseInt(indices[2]) : null;

          fvBuf[fi] = {
            v: vIdx > 0 ? vIdx + vertexOffset : this.vertexIndex + vIdx,
            vt: vtIdx !== null ? (vtIdx > 0 ? vtIdx + texCoordOffset : this.texCoordIndex + vtIdx) : null,
            vn: vnIdx !== null ? (vnIdx > 0 ? vnIdx + normalOffset : this.normalIndex + vnIdx) : null
          };
        }

        // Fan triangulation (works for tris, quads, and n-gons)
        for (let i = 1; i < faceCount - 1; i++) {
          this.faces.push({
            vertices: [fvBuf[0].v, fvBuf[i].v, fvBuf[i + 1].v],
            normals: [fvBuf[0].vn, fvBuf[i].vn, fvBuf[i + 1].vn],
            texCoords: [fvBuf[0].vt, fvBuf[i].vt, fvBuf[i + 1].vt],
            material: this.currentMaterial
          });
        }

      } else if (c0 === 117) {
        // usemtl: 'u'
        if (!trimmed.startsWith('usemtl ')) continue;
        currentObjMaterial = trimmed.substring(7).trim();

        let mtlData = null;
        const lowerMaterial = currentObjMaterial.toLowerCase();

        if (materialMapLower.size > 0) {
          mtlData = materialTextureMap.get(currentObjMaterial) || materialMapLower.get(lowerMaterial) || null;
        }
        if (!mtlData && this.defaultMaterials) {
          mtlData = this.defaultMaterials.get(currentObjMaterial) || defaultMaterialsLower.get(lowerMaterial) || null;
        }

        if (mtlData) {
          const specificMaterialName = `${materialName}_${currentObjMaterial.replace(/[^a-zA-Z0-9_]/g, '')}`;
          if (!this.materials.has(specificMaterialName)) {
            this.materials.set(specificMaterialName, {
              name: specificMaterialName,
              ambient: mtlData.ambient || [0.2, 0.2, 0.2],
              diffuse: mtlData.diffuse || [0.8, 0.8, 0.8],
              specular: mtlData.specular || [0.0, 0.0, 0.0],
              shininess: mtlData.shininess || 30,
              transparency: 1.0,
              texture: mtlData.texture || null,
              textureTransform: mtlData.textureTransform || { xOffset: 0, yOffset: 0, angle: 0, scale: 1.0 }
            });
          }
          this.setMaterial(specificMaterialName);
        } else {
          console.warn(`Material '${currentObjMaterial}' not found in MTL or defaults. Using gray.`);
          this.setMaterial(materialName);
        }
      }
      // 'o' and 'g' directives are intentionally ignored (no group support needed)
    }

    // ---- Deferred vertex transform: now that bounds are known, transform raw vertices in-place ----
    const modelWidth = maxX - minX;
    const modelHeight = maxY - minY;
    const modelDepth = maxZ - minZ;

    const centerX = (minX + maxX) / 2;
    const centerY = minY; // Keep bottom at origin
    const centerZ = (minZ + maxZ) / 2;

    const scaleX = modelWidth > 0 ? width / modelWidth : 1;
    const scaleY = modelHeight > 0 ? height / modelHeight : 1;
    const scaleZ = modelDepth > 0 ? depth / modelDepth : 1;

    for (let i = 0, vi = vertexStartIdx, len = rawVerts.length; i < len; i += 3, vi++) {
      // Center, scale, rotate, translate
      let vx = (rawVerts[i] - centerX) * scaleX;
      let vy = (rawVerts[i + 1] - centerY) * scaleY;
      let vz = (rawVerts[i + 2] - centerZ) * scaleZ;

      const rotX = vx * cos - vz * sin;
      const rotZ = vx * sin + vz * cos;

      this.vertices[vi] = [x + rotX, elevation + vy, y + rotZ];
    }
  }

  /**
   * Export furniture as bounding box (fallback)
   */
  exportFurnitureBoundingBox(piece, name) {
    const x = piece.getX ? piece.getX() : 0;
    const y = piece.getY ? piece.getY() : 0;
    const elevation = piece.getElevation ? piece.getElevation() : 0;
    const width = piece.getWidth ? piece.getWidth() : 50;
    const depth = piece.getDepth ? piece.getDepth() : 50;
    const height = piece.getHeight ? piece.getHeight() : 50;
    const angle = piece.getAngle ? piece.getAngle() : 0;

    // Uncomment to debug bounding box dimensions: console.log(`    📐 Box dimensions: ${width.toFixed(1)} x ${depth.toFixed(1)} x ${height.toFixed(1)}`);
    // Uncomment to debug bounding box position: console.log(`    📍 Position: (${x.toFixed(1)}, ${y.toFixed(1)}, ${elevation.toFixed(1)}), angle: ${(angle * 180 / Math.PI).toFixed(1)}°`);

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Box vertices in local coordinates
    const localVerts = [
      [-width/2, 0, -depth/2],
      [width/2, 0, -depth/2],
      [width/2, 0, depth/2],
      [-width/2, 0, depth/2],
      [-width/2, height, -depth/2],
      [width/2, height, -depth/2],
      [width/2, height, depth/2],
      [-width/2, height, depth/2]
    ];

    // Transform vertices
    const verts = localVerts.map(v => {
      const rx = v[0] * cos - v[2] * sin;
      const rz = v[0] * sin + v[2] * cos;
      return [x + rx, elevation + v[1], y + rz];
    });

    // Check for furniture color override
    const furnitureColor = piece.getColor ? piece.getColor() : null;
    const materialName = `furniture_${name}`;

    // Create material with correct color
    if (furnitureColor !== null && furnitureColor !== undefined) {
      const r = (furnitureColor >> 16 & 0xFF) / 255.0;
      const g = (furnitureColor >> 8 & 0xFF) / 255.0;
      const b = (furnitureColor & 0xFF) / 255.0;

      this.materials.set(materialName, {
        name: materialName,
        ambient: [r * 0.2, g * 0.2, b * 0.2],
        diffuse: [r, g, b],
        specular: [0.3, 0.3, 0.3],
        shininess: 30,
        transparency: 1.0,
        texture: null
      });
    }

    this.setMaterial(materialName);
    
    // Bottom
    this.addQuad(verts[0], verts[1], verts[2], verts[3], [0, -1, 0]);
    // Top
    this.addQuad(verts[4], verts[7], verts[6], verts[5], [0, 1, 0]);
    // Sides
    this.addQuad(verts[0], verts[3], verts[7], verts[4], [-cos, 0, -sin]);
    this.addQuad(verts[1], verts[5], verts[6], verts[2], [cos, 0, sin]);
    this.addQuad(verts[3], verts[2], verts[6], verts[7], [sin, 0, -cos]);
    this.addQuad(verts[0], verts[4], verts[5], verts[1], [-sin, 0, cos]);
  }

  /**
   * Triangulate 2D polygon for floor/ceiling
   */
  triangulatePolygon(points, elevation, flipNormal) {
    const triangles = [];
    
    // Simple ear clipping triangulation
    // For complex polygons, consider using a proper triangulation library
    if (points.length === 3) {
      const p0 = [points[0][0], elevation, points[0][1]];
      const p1 = [points[1][0], elevation, points[1][1]];
      const p2 = [points[2][0], elevation, points[2][1]];
      triangles.push(flipNormal ? [p2, p1, p0] : [p0, p1, p2]);
    } else if (points.length === 4) {
      // Quad - split into 2 triangles
      const p0 = [points[0][0], elevation, points[0][1]];
      const p1 = [points[1][0], elevation, points[1][1]];
      const p2 = [points[2][0], elevation, points[2][1]];
      const p3 = [points[3][0], elevation, points[3][1]];
      
      if (flipNormal) {
        triangles.push([p0, p2, p1]);
        triangles.push([p0, p3, p2]);
      } else {
        triangles.push([p0, p1, p2]);
        triangles.push([p0, p2, p3]);
      }
    } else {
      // Fan triangulation from first point
      for (let i = 1; i < points.length - 1; i++) {
        const p0 = [points[0][0], elevation, points[0][1]];
        const p1 = [points[i][0], elevation, points[i][1]];
        const p2 = [points[i+1][0], elevation, points[i+1][1]];
        triangles.push(flipNormal ? [p0, p2, p1] : [p0, p1, p2]);
      }
    }
    
    return triangles;
  }

  /**
   * Add a quad face (2 triangles)
   */
  addQuad(v1, v2, v3, v4, normal) {
    this.addTriangle(v1, v2, v3, normal);
    this.addTriangle(v1, v3, v4, normal);
  }

  /**
   * Add a triangle face
   */
  addTriangle(v1, v2, v3, normal) {
    const i1 = this.addVertex(v1);
    const i2 = this.addVertex(v2);
    const i3 = this.addVertex(v3);
    const ni = this.addNormal(normal);

    this.faces.push({
      vertices: [i1, i2, i3],
      normals: [ni, ni, ni],
      texCoords: [null, null, null], // Add texture coordinates if needed
      material: this.currentMaterial
    });
  }

  /**
   * Add a quad face with texture coordinates (2 triangles)
   * @param {Array} v1 - Vertex 1 [x, y, z]
   * @param {Array} v2 - Vertex 2 [x, y, z]
   * @param {Array} v3 - Vertex 3 [x, y, z]
   * @param {Array} v4 - Vertex 4 [x, y, z]
   * @param {Array} normal - Normal vector [x, y, z]
   * @param {Object} textureTransform - Texture transform parameters
   */
  addQuadWithTexture(v1, v2, v3, v4, normal, textureTransform) {
    this.addTriangleWithTexture(v1, v2, v3, normal, textureTransform);
    this.addTriangleWithTexture(v1, v3, v4, normal, textureTransform);
  }

  /**
   * Add a triangle face with texture coordinates
   * @param {Array} v1 - Vertex 1 [x, y, z]
   * @param {Array} v2 - Vertex 2 [x, y, z]
   * @param {Array} v3 - Vertex 3 [x, y, z]
   * @param {Array} normal - Normal vector [x, y, z]
   * @param {Object} textureTransform - Texture transform parameters
   */
  addTriangleWithTexture(v1, v2, v3, normal, textureTransform) {
    // Add vertices and normal
    const i1 = this.addVertex(v1);
    const i2 = this.addVertex(v2);
    const i3 = this.addVertex(v3);
    const ni = this.addNormal(normal);

    // Generate and add UV coordinates
    const uvs = this.generateTriangleUVs([v1, v2, v3], textureTransform);
    const ti1 = this.addTexCoord(uvs[0][0], uvs[0][1]);
    const ti2 = this.addTexCoord(uvs[1][0], uvs[1][1]);
    const ti3 = this.addTexCoord(uvs[2][0], uvs[2][1]);

    this.faces.push({
      vertices: [i1, i2, i3],
      normals: [ni, ni, ni],
      texCoords: [ti1, ti2, ti3], // NOW HAS VALUES
      material: this.currentMaterial
    });
  }

  /**
   * Add vertex and return its index
   */
  addVertex(v) {
    // Check if vertex already exists (for efficiency)
    const key = this.formatNumber(v[0]) + ',' + 
                this.formatNumber(v[1]) + ',' + 
                this.formatNumber(v[2]);
    
    // For now, always add new vertex (can optimize later)
    this.vertices.push(v);
    return this.vertexIndex++;
  }

  /**
   * Add normal and return its index
   */
  addNormal(n) {
    // Unity compatibility: Validate normals
    // Check for NaN or zero length
    if (isNaN(n[0]) || isNaN(n[1]) || isNaN(n[2])) {
      return null;
    }
    
    // Check for zero length vector (approximate)
    if (Math.abs(n[0]) < 1e-6 && Math.abs(n[1]) < 1e-6 && Math.abs(n[2]) < 1e-6) {
      return null;
    }

    this.normals.push(n);
    return this.normalIndex++;
  }

  /**
   * Add texture coordinate
   */
  addTexCoord(u, v) {
    this.texCoords.push([u, v]);
    return this.texCoordIndex++;
  }

  /**
   * Set current material
   */
  setMaterial(materialName) {
    if (!this.materials.has(materialName)) {
      // Create default material based on type
      // Note: For furniture, we use neutral gray - actual colors come from MTL files
      let diffuse = [0.8, 0.8, 0.8]; // Default neutral gray
      let specular = [0.3, 0.3, 0.3];
      let shininess = 30;

      // Set sensible default colors based on material name prefix
      // Only for walls/floors/ceilings - furniture uses original model colors
      if (materialName.startsWith('default_wall')) {
        // Off-white wall color (only for default_wall, not specific wall materials)
        diffuse = [0.95, 0.93, 0.88];
        specular = [0.1, 0.1, 0.1];
        shininess = 10;
      } else if (materialName.startsWith('default_floor')) {
        // Light beige floor color
        diffuse = [0.85, 0.80, 0.70];
        specular = [0.2, 0.2, 0.2];
        shininess = 20;
      } else if (materialName.startsWith('default_ceiling')) {
        // White ceiling color
        diffuse = [0.98, 0.98, 0.98];
        specular = [0.05, 0.05, 0.05];
        shininess = 5;
      }
      // Note: furniture_ materials keep neutral gray - their actual colors
      // are set when parsing the MTL file in integrateOBJContent()

      this.materials.set(materialName, {
        name: materialName,
        ambient: [diffuse[0] * 0.2, diffuse[1] * 0.2, diffuse[2] * 0.2],
        diffuse: diffuse,
        specular: specular,
        shininess: shininess,
        transparency: 1.0,
        texture: null
      });
    }
    this.currentMaterial = materialName;
  }

  /**
   * Get material name for wall (with texture support)
   * @param {Wall} wall - Wall object
   * @param {number} wallIndex - Wall index for naming
   * @returns {Promise<string>} - Material name
   */
  async getWallMaterial(wall, wallIndex) {
    // 1. Check for textures FIRST (textures take priority over colors)
    const leftSideTexture = wall.getLeftSideTexture ? wall.getLeftSideTexture() : null;

    if (leftSideTexture) {
      try {
        const textureImage = leftSideTexture.getImage ? leftSideTexture.getImage() : null;
        if (textureImage) {
          const textureURL = textureImage.getURL ? textureImage.getURL() : null;
          if (textureURL) {
            const textureData = await this.fetchTextureData(textureURL);
            const textureName = await this.addTexture(`wall_${wallIndex}_left`, textureURL, textureData);
            const transform = this.parseTextureTransform(leftSideTexture);

            const materialName = `wall_${wallIndex}_left_textured`;
            this.materials.set(materialName, {
              name: materialName,
              ambient: [0.2, 0.2, 0.2],
              diffuse: [0.8, 0.8, 0.8],
              specular: [0.3, 0.3, 0.3],
              shininess: 20,
              transparency: 1.0,
              texture: textureName,
              textureTransform: transform
            });

            return materialName;
          }
        }
      } catch (error) {
        console.warn(`⚠️ Failed to load texture for wall ${wallIndex}:`, error.message);
        // Fall through to color-based material
      }
    }

    // 2. Fall back to color-based material
    const leftSideColor = wall.getLeftSideColor ? wall.getLeftSideColor() : null;

    if (leftSideColor) {
      const r = (leftSideColor >> 16 & 0xFF) / 255.0;
      const g = (leftSideColor >> 8 & 0xFF) / 255.0;
      const b = (leftSideColor & 0xFF) / 255.0;

      const materialName = `wall_${Math.round(r*255)}_${Math.round(g*255)}_${Math.round(b*255)}`;

      if (!this.materials.has(materialName)) {
        this.materials.set(materialName, {
          name: materialName,
          ambient: [r * 0.2, g * 0.2, b * 0.2],
          diffuse: [r, g, b],
          specular: [0.3, 0.3, 0.3],
          shininess: 20,
          transparency: 1.0,
          texture: null
        });
      }

      return materialName;
    }

    return 'default_wall';
  }

  /**
   * Get material name for wall right side (with texture support)
   * @param {Wall} wall - Wall object
   * @param {number} wallIndex - Wall index for naming
   * @returns {Promise<string>} - Material name
   */
  async getWallRightSideMaterial(wall, wallIndex) {
    // 1. Check for textures FIRST (textures take priority over colors)
    const rightSideTexture = wall.getRightSideTexture ? wall.getRightSideTexture() : null;

    if (rightSideTexture) {
      try {
        const textureImage = rightSideTexture.getImage ? rightSideTexture.getImage() : null;
        if (textureImage) {
          const textureURL = textureImage.getURL ? textureImage.getURL() : null;
          if (textureURL) {
            const textureData = await this.fetchTextureData(textureURL);
            const textureName = await this.addTexture(`wall_${wallIndex}_right`, textureURL, textureData);
            const transform = this.parseTextureTransform(rightSideTexture);

            const materialName = `wall_${wallIndex}_right_textured`;
            this.materials.set(materialName, {
              name: materialName,
              ambient: [0.2, 0.2, 0.2],
              diffuse: [0.8, 0.8, 0.8],
              specular: [0.3, 0.3, 0.3],
              shininess: 20,
              transparency: 1.0,
              texture: textureName,
              textureTransform: transform
            });

            return materialName;
          }
        }
      } catch (error) {
        console.warn(`⚠️ Failed to load right side texture for wall ${wallIndex}:`, error.message);
        // Fall through to color-based material
      }
    }

    // 2. Fall back to color-based material
    const rightSideColor = wall.getRightSideColor ? wall.getRightSideColor() : null;

    if (rightSideColor) {
      const r = (rightSideColor >> 16 & 0xFF) / 255.0;
      const g = (rightSideColor >> 8 & 0xFF) / 255.0;
      const b = (rightSideColor & 0xFF) / 255.0;

      const materialName = `wall_right_${Math.round(r*255)}_${Math.round(g*255)}_${Math.round(b*255)}`;

      if (!this.materials.has(materialName)) {
        this.materials.set(materialName, {
          name: materialName,
          ambient: [r * 0.2, g * 0.2, b * 0.2],
          diffuse: [r, g, b],
          specular: [0.3, 0.3, 0.3],
          shininess: 20,
          transparency: 1.0,
          texture: null
        });
      }

      return materialName;
    }

    // 3. If no right side specified, use left side as fallback
    return this.getWallMaterial(wall, wallIndex);
  }

  /**
   * Get material for room floor
   */
  getRoomFloorMaterial(room) {
    const floorColor = room.getFloorColor ? room.getFloorColor() : null;
    
    if (floorColor) {
      const r = (floorColor >> 16 & 0xFF) / 255.0;
      const g = (floorColor >> 8 & 0xFF) / 255.0;
      const b = (floorColor & 0xFF) / 255.0;
      
      const materialName = `floor_${Math.round(r*255)}_${Math.round(g*255)}_${Math.round(b*255)}`;
      
      if (!this.materials.has(materialName)) {
        this.materials.set(materialName, {
          name: materialName,
          ambient: [r * 0.2, g * 0.2, b * 0.2],
          diffuse: [r, g, b],
          specular: [0.1, 0.1, 0.1],
          shininess: 10,
          transparency: 1.0,
          texture: null
        });
      }
      
      return materialName;
    }
    
    return 'default_floor';
  }

  /**
   * Get material for room ceiling
   */
  getRoomCeilingMaterial(room) {
    const ceilingColor = room.getCeilingColor ? room.getCeilingColor() : null;

    if (ceilingColor) {
      const r = (ceilingColor >> 16 & 0xFF) / 255.0;
      const g = (ceilingColor >> 8 & 0xFF) / 255.0;
      const b = (ceilingColor & 0xFF) / 255.0;

      const materialName = `ceiling_${Math.round(r*255)}_${Math.round(g*255)}_${Math.round(b*255)}`;

      if (!this.materials.has(materialName)) {
        this.materials.set(materialName, {
          name: materialName,
          ambient: [r * 0.2, g * 0.2, b * 0.2],
          diffuse: [r, g, b],
          specular: [0.1, 0.1, 0.1],
          shininess: 10,
          transparency: 1.0,
          texture: null
        });
      }

      return materialName;
    }

    return 'default_ceiling';
  }

  /**
   * Get material for room floor with texture support
   * @param {Room} room - Room object
   * @param {number} roomIndex - Room index for naming
   * @returns {Promise<string>} - Material name
   */
  async getRoomFloorMaterialWithTexture(room, roomIndex) {
    // 1. Check for textures FIRST
    const floorTexture = room.getFloorTexture ? room.getFloorTexture() : null;

    if (floorTexture) {
      try {
        const textureImage = floorTexture.getImage ? floorTexture.getImage() : null;
        if (textureImage) {
          const textureURL = textureImage.getURL ? textureImage.getURL() : null;
          if (textureURL) {
            const textureData = await this.fetchTextureData(textureURL);
            const textureName = await this.addTexture(`room_${roomIndex}_floor`, textureURL, textureData);
            const transform = this.parseTextureTransform(floorTexture);

            const materialName = `room_${roomIndex}_floor_textured`;
            this.materials.set(materialName, {
              name: materialName,
              ambient: [0.2, 0.2, 0.2],
              diffuse: [0.8, 0.8, 0.8],
              specular: [0.1, 0.1, 0.1],
              shininess: 10,
              transparency: 1.0,
              texture: textureName,
              textureTransform: transform
            });

            return materialName;
          }
        }
      } catch (error) {
        console.warn(`⚠️ Failed to load floor texture for room ${roomIndex}:`, error.message);
        // Fall through to color-based material
      }
    }

    // 2. Fall back to color-based material
    return this.getRoomFloorMaterial(room);
  }

  /**
   * Get material for room ceiling with texture support
   * @param {Room} room - Room object
   * @param {number} roomIndex - Room index for naming
   * @returns {Promise<string>} - Material name
   */
  async getRoomCeilingMaterialWithTexture(room, roomIndex) {
    // 1. Check for textures FIRST
    const ceilingTexture = room.getCeilingTexture ? room.getCeilingTexture() : null;

    if (ceilingTexture) {
      try {
        const textureImage = ceilingTexture.getImage ? ceilingTexture.getImage() : null;
        if (textureImage) {
          const textureURL = textureImage.getURL ? textureImage.getURL() : null;
          if (textureURL) {
            const textureData = await this.fetchTextureData(textureURL);
            const textureName = await this.addTexture(`room_${roomIndex}_ceiling`, textureURL, textureData);
            const transform = this.parseTextureTransform(ceilingTexture);

            const materialName = `room_${roomIndex}_ceiling_textured`;
            this.materials.set(materialName, {
              name: materialName,
              ambient: [0.2, 0.2, 0.2],
              diffuse: [0.8, 0.8, 0.8],
              specular: [0.1, 0.1, 0.1],
              shininess: 10,
              transparency: 1.0,
              texture: textureName,
              textureTransform: transform
            });

            return materialName;
          }
        }
      } catch (error) {
        console.warn(`⚠️ Failed to load ceiling texture for room ${roomIndex}:`, error.message);
        // Fall through to color-based material
      }
    }

    // 2. Fall back to color-based material
    return this.getRoomCeilingMaterial(room);
  }

  /**
   * Build OBJ file content
   */
  buildOBJContent() {
    const p = this.precision;
    // Pre-allocate array: comments + vertices + normals + texCoords + faces + material switches
    const estimatedLines = 4 + this.vertices.length + this.normals.length + this.texCoords.length + this.faces.length * 2;
    const parts = new Array(estimatedLines);
    let idx = 0;

    // Write vertices
    parts[idx++] = `# Vertices: ${this.vertices.length}\n`;
    for (let i = 0, len = this.vertices.length; i < len; i++) {
      const v = this.vertices[i];
      parts[idx++] = `v ${v[0].toFixed(p)} ${v[1].toFixed(p)} ${v[2].toFixed(p)}\n`;
    }
    parts[idx++] = '\n';

    // Write normals
    parts[idx++] = `# Normals: ${this.normals.length}\n`;
    for (let i = 0, len = this.normals.length; i < len; i++) {
      const n = this.normals[i];
      parts[idx++] = `vn ${n[0].toFixed(p)} ${n[1].toFixed(p)} ${n[2].toFixed(p)}\n`;
    }
    parts[idx++] = '\n';

    // Write texture coordinates if any
    if (this.texCoords.length > 0) {
      parts[idx++] = `# Texture coordinates: ${this.texCoords.length}\n`;
      for (let i = 0, len = this.texCoords.length; i < len; i++) {
        const tc = this.texCoords[i];
        parts[idx++] = `vt ${tc[0].toFixed(p)} ${tc[1].toFixed(p)}\n`;
      }
      parts[idx++] = '\n';
    }

    // Write faces grouped by material
    parts[idx++] = `# Faces: ${this.faces.length}\n`;
    let currentMat = null;

    for (let i = 0, len = this.faces.length; i < len; i++) {
      const face = this.faces[i];
      if (face.material !== currentMat) {
        currentMat = face.material;
        parts[idx++] = `\nusemtl ${currentMat}\n`;
      }

      const hasTexCoords = face.texCoords[0] !== null && face.texCoords[0] !== undefined;
      const hasNormals = face.normals[0] !== null && face.normals[0] !== undefined;

      if (hasTexCoords && hasNormals) {
        parts[idx++] = `f ${face.vertices[0]}/${face.texCoords[0]}/${face.normals[0]} ${face.vertices[1]}/${face.texCoords[1]}/${face.normals[1]} ${face.vertices[2]}/${face.texCoords[2]}/${face.normals[2]}\n`;
      } else if (hasNormals) {
        parts[idx++] = `f ${face.vertices[0]}//${face.normals[0]} ${face.vertices[1]}//${face.normals[1]} ${face.vertices[2]}//${face.normals[2]}\n`;
      } else if (hasTexCoords) {
        parts[idx++] = `f ${face.vertices[0]}/${face.texCoords[0]} ${face.vertices[1]}/${face.texCoords[1]} ${face.vertices[2]}/${face.texCoords[2]}\n`;
      } else {
        parts[idx++] = `f ${face.vertices[0]} ${face.vertices[1]} ${face.vertices[2]}\n`;
      }
    }

    // Trim unused pre-allocated slots and join
    parts.length = idx;
    return parts.join('');
  }

  /**
   * Build MTL file content
   */
  buildMTLContent() {
    const p = this.precision;
    const date = new Date().toISOString();
    const parts = [`# MTL file generated by OBJExporter.js\n# Date: ${date}\n\n`];

    for (const [name, mat] of this.materials) {
      parts.push(`newmtl ${name}\n`);

      // Unity Compatibility: no Ka export, Ks forced to black
      if (mat.texture) {
        parts.push(`Kd 1.000 1.000 1.000\n`);
      } else {
        parts.push(`Kd ${mat.diffuse[0].toFixed(p)} ${mat.diffuse[1].toFixed(p)} ${mat.diffuse[2].toFixed(p)}\n`);
      }

      parts.push(`Ks 0.000 0.000 0.000\n`);
      parts.push(`Ns ${mat.shininess.toFixed(p)}\n`);
      parts.push(`d ${mat.transparency.toFixed(p)}\n`);
      parts.push(`illum 2\n`);

      if (mat.texture) {
        parts.push(`map_Kd ${mat.texture}\n`);
      }

      parts.push('\n');
    }

    return parts.join('');
  }

  /**
   * Create ZIP file with OBJ, MTL, and textures
   */
  async createZipFile(baseName, objContent, mtlContent) {
    const zip = new JSZip();
    
    // Add OBJ file
    zip.file(`${baseName}.obj`, objContent);
    
    // Add MTL file
    zip.file(`materials.mtl`, mtlContent);
    
    // Add texture files (FLATTENED - ROOT LEVEL)
    for (const [name, imageData] of this.textures) {
      // Unity Compatibility: Store textures at root level to match map_Kd "filename.jpg"
      // Was: zip.file(`textures/${name}`, imageData);
      zip.file(name, imageData);
    }
    
    // Generate ZIP
    return await zip.generate({type: 'blob', compression: 'DEFLATE', compressionOptions: {level: 6}});
  }

  /**
   * Trigger file download
   */
  downloadBlob(blob, filename) {
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
   * Format number with precision
   */
  formatNumber(num) {
    return num.toFixed(this.precision);
  }

  /**
   * Add comment to OBJ
   */
  addComment(text) {
    // Comments are handled in buildOBJContent
    // This is a placeholder for future implementation
  }

  /**
   * Reset exporter state
   */
  reset() {
    this.vertices = [];
    this.normals = [];
    this.texCoords = [];
    this.faces = [];
    this.materials = new Map();
    this.textures = new Map();
    this.currentMaterial = null;
    this.vertexIndex = 1;
    this.normalIndex = 1;
    this.texCoordIndex = 1;
  }

  // ========================================================================
  // Texture Management Methods
  // ========================================================================

  /**
   * Fetch texture image data from URL as binary ArrayBuffer
   * @param {string} url - Texture URL from TextureImage.getURL()
   * @returns {Promise<ArrayBuffer>} - Binary image data (JPEG/PNG bytes)
   */
  async fetchTextureData(url) {
    try {
      // Handle SweetHome3D texture URLs
      let fetchURL = url;

      // Handle JAR URLs (jar:file:...!/path/to/texture.jpg)
      if (url.startsWith('jar:')) {
        const jarMatch = url.match(/jar:[^!]+!\/(.+)/);
        if (jarMatch) {
          const innerPath = jarMatch[1];
          // Extract just the filename if it's a texture
          const fileName = innerPath.split('/').pop();
          fetchURL = `lib/resources/textures/${fileName}`;
        }
      }
      // Handle blob URLs - these are already usable as-is
      else if (url.startsWith('blob:')) {
        fetchURL = url;
      }
      // Handle data URLs - these are already usable as-is
      else if (url.startsWith('data:')) {
        // For data URLs, we need to convert to ArrayBuffer differently
        const response = await fetch(url);
        return await response.arrayBuffer();
      }
      // Handle absolute URLs
      else if (url.startsWith('http://') || url.startsWith('https://')) {
        fetchURL = url;
      }
      // Handle relative paths
      else {
        // Check various possible locations for textures
        if (url.startsWith('lib/')) {
          // Already has lib/ prefix
          fetchURL = url;
        } else if (url.includes('/')) {
          // Has a path, might be a full relative path
          fetchURL = url;
        } else {
          // Just a filename, assume it's in the textures folder
          fetchURL = `lib/resources/textures/${url}`;
        }
      }

      // Fetch image as binary data
      const response = await fetch(fetchURL);
      if (!response.ok) {
        // Try alternative path if first attempt fails
        if (!url.startsWith('lib/') && !url.startsWith('http')) {
          const altURL = `lib/resources/textures/${url.split('/').pop()}`;
          const altResponse = await fetch(altURL);
          if (altResponse.ok) {
            const arrayBuffer = await altResponse.arrayBuffer();
            console.log(`✓ Fetched texture (alt path): ${altURL} (${(arrayBuffer.byteLength / 1024).toFixed(1)} KB)`);
            return arrayBuffer;
          }
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Return as ArrayBuffer (raw binary image data - JPEG/PNG bytes)
      const arrayBuffer = await response.arrayBuffer();
      console.log(`✓ Fetched texture: ${fetchURL} (${(arrayBuffer.byteLength / 1024).toFixed(1)} KB)`);
      return arrayBuffer;

    } catch (error) {
      console.warn(`⚠️ Failed to fetch texture from ${url}:`, error.message);
      throw error;
    }
  }

  /**
   * Add texture image to export with deduplication
   * @param {string} baseName - Base name (e.g., 'wall_0_left', 'furniture_chair_0')
   * @param {string} textureURL - Original texture URL/filename
   * @param {ArrayBuffer} textureData - Binary image data (JPEG/PNG bytes)
   * @returns {string} - Unique texture filename for use in MTL file
   */
  async addTexture(baseName, textureURL, textureData) {
    // 1. Check for duplicate binary data via hash (O(1) lookup)
    const duplicate = await this.findDuplicateTexture(textureData);
    if (duplicate) {
      console.log(`✓ Texture ${baseName} is duplicate of ${duplicate}, reusing`);
      return duplicate;
    }

    // 2. Extract file extension from URL
    const extension = this.getTextureExtension(textureURL);

    // 3. Generate unique filename
    const textureName = this.generateUniqueTextureName(baseName, extension);

    // 4. Store binary image data and its hash for future dedup
    this.textures.set(textureName, textureData);
    const hashHex = await this._hashTextureData(textureData);
    this.textureHashes.set(hashHex, textureName);

    console.log(`✓ Added texture: ${textureName} (${(textureData.byteLength / 1024).toFixed(1)} KB)`);

    return textureName;
  }

  /**
   * Extract file extension from URL or default to .jpg
   * @param {string} url - Texture URL or filename
   * @returns {string} - File extension with dot (e.g., '.jpg')
   */
  getTextureExtension(url) {
    const match = url.match(/\.(jpg|jpeg|png|bmp|gif)$/i);
    return match ? `.${match[1].toLowerCase()}` : '.jpg';
  }

  /**
   * Generate unique texture name with conflict resolution
   * @param {string} baseName - Base name without extension
   * @param {string} extension - File extension with dot
   * @returns {string} - Unique texture filename
   */
  generateUniqueTextureName(baseName, extension) {
    let name = `${baseName}${extension}`;
    let counter = 1;

    while (this.textures.has(name)) {
      name = `${baseName}_${counter}${extension}`;
      counter++;
    }

    return name;
  }

  /**
   * Check if texture data is duplicate using hash-based O(1) lookup
   * @param {ArrayBuffer} textureData - Binary texture data to check
   * @returns {Promise<string|null>} - Existing texture name if duplicate, null if unique
   */
  async findDuplicateTexture(textureData) {
    const hashHex = await this._hashTextureData(textureData);
    return this.textureHashes.get(hashHex) || null;
  }

  /**
   * Compute a fast hash for texture deduplication.
   * Uses SHA-256 via Web Crypto when available, falls back to FNV-1a.
   * @param {ArrayBuffer} data
   * @returns {Promise<string>}
   */
  async _hashTextureData(data) {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = new Uint8Array(hashBuffer);
      let hex = '';
      for (let i = 0; i < hashArray.length; i++) {
        hex += hashArray[i].toString(16).padStart(2, '0');
      }
      return hex;
    }
    // Fallback: FNV-1a 32-bit (fast, good distribution for dedup)
    const bytes = new Uint8Array(data);
    let hash = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) {
      hash ^= bytes[i];
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16);
  }

  /**
   * Parse texture transform from HomeTexture object
   * @param {HomeTexture} homeTexture - SweetHome3D texture object
   * @returns {Object} - Transform object with xOffset, yOffset, angle, scale
   */
  parseTextureTransform(homeTexture) {
    if (!homeTexture) {
      return { xOffset: 0, yOffset: 0, angle: 0, scale: 1.0 };
    }

    return {
      xOffset: homeTexture.getXOffset ? homeTexture.getXOffset() : 0,
      yOffset: homeTexture.getYOffset ? homeTexture.getYOffset() : 0,
      angle: homeTexture.getAngle ? homeTexture.getAngle() : 0,
      scale: homeTexture.getScale ? homeTexture.getScale() : 1.0
    };
  }

  /**
   * Generate UV coordinates for triangle vertices
   * Uses planar projection with texture transforms
   * @param {Array} vertices - 3 vertices [[x,y,z], [x,y,z], [x,y,z]]
   * @param {Object} textureTransform - {xOffset, yOffset, angle, scale}
   * @returns {Array} - UV coordinates [[u,v], [u,v], [u,v]]
   */
  generateTriangleUVs(vertices, textureTransform) {
    const { xOffset, yOffset, angle, scale } = textureTransform || { xOffset: 0, yOffset: 0, angle: 0, scale: 1.0 };
    const uvs = [];

    // Determine projection plane based on normal
    // For now, use simple XZ plane for floors, XY for walls
    // This is a simplified approach - production code would calculate based on face normal

    for (const v of vertices) {
      // Use X and Z coordinates for floor/ceiling (horizontal surfaces)
      // Use X and Y for walls (vertical surfaces)
      // Determine based on Y variance
      let u = v[0]; // X coordinate
      let vCoord = v[2]; // Z coordinate (for floors) or Y (for walls)

      // If vertices have significant Y variation, it's likely a wall
      const yVariance = Math.abs(vertices[0][1] - vertices[1][1]) + Math.abs(vertices[1][1] - vertices[2][1]);
      if (yVariance > 0.1) {
        // Wall - use X and Y
        vCoord = v[1];
      }

      // Apply texture transform
      // 1. Scale
      u = u / scale;
      vCoord = vCoord / scale;

      // 2. Rotate (if needed)
      if (angle !== 0) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const rotU = u * cos - vCoord * sin;
        const rotV = u * sin + vCoord * cos;
        u = rotU;
        vCoord = rotV;
      }

      // 3. Offset
      u += xOffset;
      vCoord += yOffset;

      // 4. Wrap to 0-1 range (texture coordinates)
      // Allow tiling by using modulo
      u = u % 1.0;
      vCoord = vCoord % 1.0;

      // Ensure positive values
      if (u < 0) u += 1.0;
      if (vCoord < 0) vCoord += 1.0;

      uvs.push([u, vCoord]);
    }

    return uvs;
  }
}

// Export for use in browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OBJExporter;
}


