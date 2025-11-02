/**
 * obj-exporter-integration.js
 * Integration script to add OBJ export functionality to SweetHome3D JS
 * 
 * Add this script after sweethome3d.min.js in index.html:
 * <script type="text/javascript" src="OBJExporter.js"></script>
 * <script type="text/javascript" src="obj-exporter-integration.js"></script>
 */

(function() {
  'use strict';
  
  // Wait for DOM and SweetHome3D to be ready
  if (typeof HomePane === 'undefined') {
    console.warn('SweetHome3D not loaded yet, retrying...');
    setTimeout(arguments.callee, 100);
    return;
  }
  
  console.log('Initializing OBJ Exporter integration...');
  
  /**
   * Add OBJ export to the menu system
   */
  function addOBJExportToMenu() {
    // Find the File menu or 3D View menu
    const menuBar = document.querySelector('#application-menu-toolbar, #home-pane-toolbar');
    
    if (!menuBar) {
      console.warn('Menu bar not found');
      return;
    }
    
    // Create export button
    const exportButton = document.createElement('button');
    exportButton.id = 'obj-export-button';
    exportButton.innerHTML = '📦 Export OBJ';
    exportButton.title = 'Export 3D model to OBJ format for Unity';
    exportButton.style.cssText = `
      margin: 2px;
      padding: 4px 8px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    `;
    
    exportButton.addEventListener('click', handleOBJExport);
    
    // Add to toolbar
    menuBar.appendChild(exportButton);
    
    console.log('OBJ Export button added to UI');
  }
  
  /**
   * Handle OBJ export button click
   */
  async function handleOBJExport() {
    try {
      // Get home object (global or from window)
      const home = window.home || window.application?.home;
      
      if (!home) {
        showError('No home loaded. Please create or open a home first.');
        return;
      }
      
      // Get 3D component
      const component3D = window.homeComponent3D || window.component3D;
      
      // Show progress
      showProgress('Exporting to OBJ format...');
      
      // Create exporter
      const exporter = new OBJExporter();
      
      // Export
      const homeName = home.getName ? home.getName() : 'home';
      const filename = sanitizeFilename(homeName) + '.zip';
      
      const result = await exporter.exportToOBJ(home, component3D, filename);
      
      hideProgress();
      
      // Show success message
      showSuccess(`Successfully exported to ${filename}!<br>
        Vertices: ${result.vertices}<br>
        Faces: ${result.faces}<br>
        Materials: ${result.materials}<br>
        Textures: ${result.textures}`);
        
      console.log('Export completed:', result);
      
    } catch (error) {
      hideProgress();
      showError('Export failed: ' + error.message);
      console.error('OBJ Export error:', error);
    }
  }
  
  /**
   * Alternative: Add export via context menu or keyboard shortcut
   */
  function addKeyboardShortcut() {
    document.addEventListener('keydown', function(e) {
      // Ctrl+Shift+E for export
      if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        handleOBJExport();
      }
    });
    
    console.log('Keyboard shortcut added: Ctrl+Shift+E for OBJ export');
  }
  
  /**
   * Add export option to existing 3D view menu
   */
  function integrateWith3DViewMenu() {
    // This is more complex and requires hooking into SweetHome3D's menu system
    // Look for existing export options and add OBJ export nearby
    
    // Try to find View3D menu
    const view3DMenu = document.querySelector('[data-action*="view3d"], [id*="view3d"]');
    
    if (view3DMenu) {
      console.log('Found 3D view menu, adding OBJ export option');
      // Add to menu (implementation depends on SweetHome3D's menu structure)
    }
  }
  
  /**
   * Utility: Show progress dialog
   */
  function showProgress(message) {
    let progress = document.getElementById('obj-export-progress');
    
    if (!progress) {
      progress = document.createElement('div');
      progress.id = 'obj-export-progress';
      progress.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 20px 40px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 16px;
      `;
      document.body.appendChild(progress);
    }
    
    progress.textContent = message;
    progress.style.display = 'block';
  }
  
  /**
   * Utility: Hide progress dialog
   */
  function hideProgress() {
    const progress = document.getElementById('obj-export-progress');
    if (progress) {
      progress.style.display = 'none';
    }
  }
  
  /**
   * Utility: Show success message
   */
  function showSuccess(message) {
    showMessage(message, '#4CAF50');
  }
  
  /**
   * Utility: Show error message
   */
  function showError(message) {
    showMessage(message, '#f44336');
  }
  
  /**
   * Utility: Show message dialog
   */
  function showMessage(message, color) {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: ${color};
      color: white;
      padding: 20px 40px;
      border-radius: 8px;
      z-index: 10001;
      max-width: 400px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    `;
    dialog.innerHTML = message;
    
    document.body.appendChild(dialog);
    
    // Auto-close after 3 seconds
    setTimeout(() => {
      dialog.remove();
    }, 3000);
    
    // Click to close
    dialog.addEventListener('click', () => dialog.remove());
  }
  
  /**
   * Utility: Sanitize filename
   */
  function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  }
  
  /**
   * Initialize the integration
   */
  function initialize() {
    try {
      addOBJExportToMenu();
      addKeyboardShortcut();
      integrateWith3DViewMenu();
      
      console.log('OBJ Exporter integration complete');
      
      // Make exporter globally available for debugging
      window.OBJExporter = OBJExporter;
      window.exportHomeToOBJ = handleOBJExport;
      
    } catch (error) {
      console.error('Failed to initialize OBJ exporter:', error);
    }
  }
  
  // Run initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
})();
