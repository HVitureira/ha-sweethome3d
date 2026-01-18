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
    
    // Export furniture
    if (home.getFurniture) {
      const furniture = home.getFurniture();
      // Uncomment to debug furniture count: console.log('Found furniture:', furniture ? furniture.length : 0);
      if (furniture && furniture.length > 0) {
        for (let i = 0; i < furniture.length; i++) {
          await this.exportFurniture(furniture[i], `furniture_${i}`, component3D);
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
                const texData = await texFile.async('arraybuffer');
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
    const modelVertices = [];
    const modelNormals = [];
    const modelTexCoords = [];
    
    // Track the starting indices for this model
    const vertexOffset = this.vertexIndex - 1;
    const normalOffset = this.normalIndex - 1;
    const texCoordOffset = this.texCoordIndex - 1;
    
    // Get scale factors
    const width = piece.getWidth ? piece.getWidth() : 1;
    const depth = piece.getDepth ? piece.getDepth() : 1;
    const height = piece.getHeight ? piece.getHeight() : 1;
    
    // Parse the OBJ file to get original bounds
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    // First pass: collect vertices to calculate bounds
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('v ')) {
        const parts = trimmed.split(/\s+/);
        const vx = parseFloat(parts[1]);
        const vy = parseFloat(parts[2]);
        const vz = parseFloat(parts[3]);
        
        minX = Math.min(minX, vx);
        maxX = Math.max(maxX, vx);
        minY = Math.min(minY, vy);
        maxY = Math.max(maxY, vy);
        minZ = Math.min(minZ, vz);
        maxZ = Math.max(maxZ, vz);
      }
    }
    
    // Calculate model dimensions and center
    const modelWidth = maxX - minX;
    const modelHeight = maxY - minY;
    const modelDepth = maxZ - minZ;
    
    const centerX = (minX + maxX) / 2;
    const centerY = minY; // Keep bottom at origin
    const centerZ = (minZ + maxZ) / 2;
    
    // Calculate scale factors
    const scaleX = modelWidth > 0 ? width / modelWidth : 1;
    const scaleY = modelHeight > 0 ? height / modelHeight : 1;
    const scaleZ = modelDepth > 0 ? depth / modelDepth : 1;
    
    // Uncomment to debug model scaling: console.log(`    📏 Model bounds: ${modelWidth.toFixed(1)} x ${modelHeight.toFixed(1)} x ${modelDepth.toFixed(1)}`);
    // Uncomment to debug target dimensions: console.log(`    📐 Scaling to: ${width.toFixed(1)} x ${height.toFixed(1)} x ${depth.toFixed(1)}`);
    
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

    // Track current material from OBJ file
    let currentObjMaterial = null;

    // Second pass: process and transform geometry
    for (const line of lines) {
      const trimmed = line.trim();

      // Handle usemtl directive (material assignment)
      if (trimmed.startsWith('usemtl ')) {
        currentObjMaterial = trimmed.substring(7).trim();
        // Try to find the material in the parsed MTL data
        let mtlData = null;
        
        // 1. Try case-insensitive lookup in the ZIP's MTL
        if (typeof materialTextureMap.get === 'function') { // Ensure it's a Map
          // direct lookup first
          mtlData = materialTextureMap.get(currentObjMaterial);
          
          // if not found, try case-insensitive
          if (!mtlData) {
             const lowerMaterial = currentObjMaterial.toLowerCase();
             for (const [key, value] of materialTextureMap.entries()) {
                 if (key.toLowerCase() === lowerMaterial) {
                     mtlData = value;
                     break;
                 }
             }
          }
        }

        // 2. Fallback to default materials if not found in ZIP
        if (!mtlData && this.defaultMaterials) {
            mtlData = this.defaultMaterials.get(currentObjMaterial);
            if (!mtlData) {
                 // Case-insensitive fallback for defaults too
                 const lowerMaterial = currentObjMaterial.toLowerCase();
                 for (const [key, value] of this.defaultMaterials.entries()) {
                     if (key.toLowerCase() === lowerMaterial) {
                         mtlData = value;
                         break;
                     }
                 }
            }
             if (mtlData) {
                // console.log(`Found material '${currentObjMaterial}' in default materials.`);
             }
        }

        if (mtlData) {
          // Create a unique material name to avoid conflicts
          const specificMaterialName = `${materialName}_${currentObjMaterial.replace(/[^a-zA-Z0-9_]/g, '')}`;
          
          // Check if we already created this specific material
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

      if (trimmed.startsWith('v ')) {
        // Vertex
        const parts = trimmed.split(/\s+/);
        let vx = parseFloat(parts[1]);
        let vy = parseFloat(parts[2]);
        let vz = parseFloat(parts[3]);
        
        // Center the model
        vx -= centerX;
        vy -= centerY;
        vz -= centerZ;
        
        // Scale
        vx *= scaleX;
        vy *= scaleY;
        vz *= scaleZ;
        
        // Rotate around Y axis
        const rotX = vx * cos - vz * sin;
        const rotZ = vx * sin + vz * cos;
        
        // Translate to position
        const finalX = x + rotX;
        const finalY = elevation + vy;
        const finalZ = y + rotZ;
        
        this.vertices.push([finalX, finalY, finalZ]);
        this.vertexIndex++;
        
      } else if (trimmed.startsWith('vn ')) {
        // Normal - rotate but don't translate
        const parts = trimmed.split(/\s+/);
        let nx = parseFloat(parts[1]);
        let ny = parseFloat(parts[2]);
        let nz = parseFloat(parts[3]);
        
        // Rotate normal
        const rotNx = nx * cos - nz * sin;
        const rotNz = nx * sin + nz * cos;
        
        this.normals.push([rotNx, ny, rotNz]);
        this.normalIndex++;
        
      } else if (trimmed.startsWith('vt ')) {
        // Texture coordinate
        const parts = trimmed.split(/\s+/);
        const u = parseFloat(parts[1]);
        const v = parseFloat(parts[2]);
        
        this.texCoords.push([u, v]);
        this.texCoordIndex++;
        
      } else if (trimmed.startsWith('f ')) {
        // Face
        const parts = trimmed.split(/\s+/).slice(1);
        
        // Parse face vertices
        const faceVerts = [];
        for (const part of parts) {
          const indices = part.split('/');
          const vIdx = parseInt(indices[0]);
          const vtIdx = indices[1] && indices[1] !== '' ? parseInt(indices[1]) : null;
          const vnIdx = indices[2] && indices[2] !== '' ? parseInt(indices[2]) : null;
          
          // Convert to absolute indices (OBJ uses 1-based indexing)
          let absoluteV, absoluteVt, absoluteVn;
          
          if (vIdx > 0) {
            absoluteV = vIdx + vertexOffset;
          } else {
            // Negative indices count from the end
            absoluteV = this.vertexIndex + vIdx;
          }
          
          if (vtIdx !== null) {
            if (vtIdx > 0) {
              absoluteVt = vtIdx + texCoordOffset;
            } else {
              absoluteVt = this.texCoordIndex + vtIdx;
            }
          } else {
            absoluteVt = null;
          }
          
          if (vnIdx !== null) {
            if (vnIdx > 0) {
              absoluteVn = vnIdx + normalOffset;
            } else {
              absoluteVn = this.normalIndex + vnIdx;
            }
          } else {
            absoluteVn = null;
          }
          
          faceVerts.push({
            v: absoluteV,
            vt: absoluteVt,
            vn: absoluteVn
          });
        }
        
        // Triangulate face if needed (convert quads to triangles)
        if (faceVerts.length === 3) {
          this.faces.push({
            vertices: [faceVerts[0].v, faceVerts[1].v, faceVerts[2].v],
            normals: [faceVerts[0].vn, faceVerts[1].vn, faceVerts[2].vn],
            texCoords: [faceVerts[0].vt, faceVerts[1].vt, faceVerts[2].vt],
            material: this.currentMaterial
          });
        } else if (faceVerts.length === 4) {
          // Split quad into 2 triangles
          this.faces.push({
            vertices: [faceVerts[0].v, faceVerts[1].v, faceVerts[2].v],
            normals: [faceVerts[0].vn, faceVerts[1].vn, faceVerts[2].vn],
            texCoords: [faceVerts[0].vt, faceVerts[1].vt, faceVerts[2].vt],
            material: this.currentMaterial
          });
          this.faces.push({
            vertices: [faceVerts[0].v, faceVerts[2].v, faceVerts[3].v],
            normals: [faceVerts[0].vn, faceVerts[2].vn, faceVerts[3].vn],
            texCoords: [faceVerts[0].vt, faceVerts[2].vt, faceVerts[3].vt],
            material: this.currentMaterial
          });
        } else if (faceVerts.length > 4) {
          // Fan triangulation for polygons with more than 4 vertices
          for (let i = 1; i < faceVerts.length - 1; i++) {
            this.faces.push({
              vertices: [faceVerts[0].v, faceVerts[i].v, faceVerts[i + 1].v],
              normals: [faceVerts[0].vn, faceVerts[i].vn, faceVerts[i + 1].vn],
              texCoords: [faceVerts[0].vt, faceVerts[i].vt, faceVerts[i + 1].vt],
              material: this.currentMaterial
            });
          }
        }
      }
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
    let content = '';
    
    // Write vertices
    content += `# Vertices: ${this.vertices.length}\n`;
    for (const v of this.vertices) {
      content += `v ${this.formatNumber(v[0])} ${this.formatNumber(v[1])} ${this.formatNumber(v[2])}\n`;
    }
    content += '\n';
    
    // Write normals
    content += `# Normals: ${this.normals.length}\n`;
    for (const n of this.normals) {
      content += `vn ${this.formatNumber(n[0])} ${this.formatNumber(n[1])} ${this.formatNumber(n[2])}\n`;
    }
    content += '\n';
    
    // Write texture coordinates if any
    if (this.texCoords.length > 0) {
      content += `# Texture coordinates: ${this.texCoords.length}\n`;
      for (const tc of this.texCoords) {
        content += `vt ${this.formatNumber(tc[0])} ${this.formatNumber(tc[1])}\n`;
      }
      content += '\n';
    }
    
    // Write faces grouped by material
    content += `# Faces: ${this.faces.length}\n`;
    let currentMat = null;
    
    for (const face of this.faces) {
      if (face.material !== currentMat) {
        currentMat = face.material;
        content += `\nusemtl ${currentMat}\n`;
      }
      
      // Face format: f v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3
      // Handle different combinations of texture coords and normals
      const hasTexCoords = face.texCoords[0] !== null && face.texCoords[0] !== undefined;
      const hasNormals = face.normals[0] !== null && face.normals[0] !== undefined;
      
      if (hasTexCoords && hasNormals) {
        // v/vt/vn
        content += `f ${face.vertices[0]}/${face.texCoords[0]}/${face.normals[0]} `;
        content += `${face.vertices[1]}/${face.texCoords[1]}/${face.normals[1]} `;
        content += `${face.vertices[2]}/${face.texCoords[2]}/${face.normals[2]}\n`;
      } else if (hasNormals) {
        // v//vn (no texture coordinates)
        content += `f ${face.vertices[0]}//${face.normals[0]} `;
        content += `${face.vertices[1]}//${face.normals[1]} `;
        content += `${face.vertices[2]}//${face.normals[2]}\n`;
      } else if (hasTexCoords) {
        // v/vt (no normals)
        content += `f ${face.vertices[0]}/${face.texCoords[0]} `;
        content += `${face.vertices[1]}/${face.texCoords[1]} `;
        content += `${face.vertices[2]}/${face.texCoords[2]}\n`;
      } else {
        // v only (no texture coordinates or normals)
        content += `f ${face.vertices[0]} `;
        content += `${face.vertices[1]} `;
        content += `${face.vertices[2]}\n`;
      }
    }
    
    return content;
  }

  /**
   * Build MTL file content
   */
  buildMTLContent() {
    const date = new Date().toISOString();
    let content = `# MTL file generated by OBJExporter.js
# Date: ${date}

`;
    
    for (const [name, mat] of this.materials) {
      content += `newmtl ${name}\n`;
      
      // Unity Compatibility:
      // 1. Do NOT export Ka (Ambient) - Unity ignores it or uses it for emission
      // content += `Ka ${this.formatNumber(mat.ambient[0])} ${this.formatNumber(mat.ambient[1])} ${this.formatNumber(mat.ambient[2])}\n`;
      
      // 2. Adjust Kd (Diffuse) based on texture presence
      if (mat.texture) {
        // If texture exists, Kd must be WHITE (1,1,1) to avoid multiplying texture color
        content += `Kd 1.000 1.000 1.000\n`;
      } else {
        content += `Kd ${this.formatNumber(mat.diffuse[0])} ${this.formatNumber(mat.diffuse[1])} ${this.formatNumber(mat.diffuse[2])}\n`;
      }

      // 3. Adjust Ks (Specular) - Default to Black (0,0,0) for non-metallic look
      // Unity Standard Shader treats non-black Ks as metallic/specular intensity
      content += `Ks 0.000 0.000 0.000\n`; 
      // content += `Ks ${this.formatNumber(mat.specular[0])} ${this.formatNumber(mat.specular[1])} ${this.formatNumber(mat.specular[2])}\n`;
      
      content += `Ns ${this.formatNumber(mat.shininess)}\n`;
      content += `d ${this.formatNumber(mat.transparency)}\n`;
      content += `illum 2\n`;

      // Add texture reference if exists (FLATTENED PATH)
      if (mat.texture) {
        // Unity Compatibility: Use filename only, no folder paths
        // This matches the flat structure in the ZIP root
        content += `map_Kd ${mat.texture}\n`;
      }

      content += '\n';
    }
    
    return content;
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
    return await zip.generate({type: 'blob'});
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
    // 1. Check for duplicate binary data (reuse if identical)
    const duplicate = this.findDuplicateTexture(textureData);
    if (duplicate) {
      console.log(`✓ Texture ${baseName} is duplicate of ${duplicate}, reusing`);
      return duplicate;
    }

    // 2. Extract file extension from URL
    const extension = this.getTextureExtension(textureURL);

    // 3. Generate unique filename
    const textureName = this.generateUniqueTextureName(baseName, extension);

    // 4. Store binary image data in Map
    // ArrayBuffer will be written to ZIP as image file by JSZip
    this.textures.set(textureName, textureData);

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
   * Check if texture data is duplicate (same binary content)
   * @param {ArrayBuffer} textureData - Binary texture data to check
   * @returns {string|null} - Existing texture name if duplicate, null if unique
   */
  findDuplicateTexture(textureData) {
    // Simple implementation: compare size first, then binary content
    const newSize = textureData.byteLength;

    for (const [name, existingData] of this.textures) {
      if (existingData.byteLength !== newSize) {
        continue;
      }

      // Compare binary content
      const newBytes = new Uint8Array(textureData);
      const existingBytes = new Uint8Array(existingData);

      let identical = true;
      for (let i = 0; i < newSize; i++) {
        if (newBytes[i] !== existingBytes[i]) {
          identical = false;
          break;
        }
      }

      if (identical) {
        return name;
      }
    }

    return null;
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


