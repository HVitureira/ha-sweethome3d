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
    
    // Get or create material for wall
    const materialName = this.getWallMaterial(wall);
    
    this.addComment(`Wall: ${name}`);
    this.setMaterial(materialName);
    
    // Front face
    this.addQuad(v1, v2, v3, v4, [0, 0, -1]);
    
    // Back face
    this.addQuad(v6, v5, v8, v7, [0, 0, 1]);
    
    // Top face
    this.addQuad(v4, v3, v7, v8, [0, 1, 0]);
    
    // Side faces
    this.addQuad(v5, v1, v4, v8, [-nx, 0, -ny]);
    this.addQuad(v2, v6, v7, v3, [nx, 0, ny]);
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
    
    this.addComment(`Room: ${name} - ${room.getName ? room.getName() : 'Unnamed'}`);
    
    // Floor material
    const floorMaterial = this.getRoomFloorMaterial(room);
    this.setMaterial(floorMaterial);
    
    // Triangulate floor polygon
    const floorTriangles = this.triangulatePolygon(points, floorLevel, true);
    for (const tri of floorTriangles) {
      this.addTriangle(tri[0], tri[1], tri[2], [0, -1, 0]);
    }
    
    // Ceiling material
    const ceilingMaterial = this.getRoomCeilingMaterial(room);
    this.setMaterial(ceilingMaterial);
    
    // Triangulate ceiling polygon
    const ceilingTriangles = this.triangulatePolygon(points, ceilingHeight, false);
    for (const tri of ceilingTriangles) {
      this.addTriangle(tri[0], tri[1], tri[2], [0, 1, 0]);
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
            // Find OBJ file in the ZIP (same approach as ModelLoader)
            let objFile = null;
            let objFileName = null;
            
            const files = zip.file(/.*/);
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              if (file.name.toLowerCase().endsWith('.obj')) {
                objFile = file;
                objFileName = file.name;
                break;
              }
            }
            
            if (!objFile) {
              reject(new Error('No OBJ file found in model ZIP'));
              return;
            }
            
            // Uncomment to see which OBJ files are loaded: console.log(`    📄 Found OBJ file: ${objFileName}`);
            
            // Read OBJ content
            const objContent = objFile.asText();
            
            // Parse and integrate the OBJ file
            await this.integrateOBJContent(objContent, x, y, elevation, angle, name, piece);
            
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
   * Parse OBJ content and add to our export with transformations
   */
  async integrateOBJContent(objContent, x, y, elevation, angle, name, piece) {
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
    
    const materialName = `furniture_${name}`;
    this.setMaterial(materialName);
    
    // Second pass: process and transform geometry
    for (const line of lines) {
      const trimmed = line.trim();
      
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
    
    const materialName = `furniture_${name}`;
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
      // Create default material
      this.materials.set(materialName, {
        name: materialName,
        ambient: [0.2, 0.2, 0.2],
        diffuse: [0.8, 0.8, 0.8],
        specular: [0.5, 0.5, 0.5],
        shininess: 30,
        transparency: 1.0,
        texture: null
      });
    }
    this.currentMaterial = materialName;
  }

  /**
   * Get material name for wall
   */
  getWallMaterial(wall) {
    // Extract color or texture from wall
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
      content += `Ka ${this.formatNumber(mat.ambient[0])} ${this.formatNumber(mat.ambient[1])} ${this.formatNumber(mat.ambient[2])}\n`;
      content += `Kd ${this.formatNumber(mat.diffuse[0])} ${this.formatNumber(mat.diffuse[1])} ${this.formatNumber(mat.diffuse[2])}\n`;
      content += `Ks ${this.formatNumber(mat.specular[0])} ${this.formatNumber(mat.specular[1])} ${this.formatNumber(mat.specular[2])}\n`;
      content += `Ns ${this.formatNumber(mat.shininess)}\n`;
      content += `d ${this.formatNumber(mat.transparency)}\n`;
      content += `illum 2\n`;
      
      if (mat.texture) {
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
    
    // Add texture files
    for (const [name, imageData] of this.textures) {
      zip.file(`textures/${name}`, imageData);
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
}

// Export for use in browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OBJExporter;
}
