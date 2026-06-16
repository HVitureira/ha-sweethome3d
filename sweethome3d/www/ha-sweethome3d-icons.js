// Custom icon set for ha-sweethome3d addon.
// Registered as prefix "ha-sweethome3d" → used via panel_icon: custom:ha-sweethome3d:logo
// Loaded by HA frontend as a Lovelace module resource (deployed automatically on addon start).

const ICONS = {
  logo:
    // House silhouette with floor-plan room dividers (viewBox 0 0 24 24, monochrome)
    "M12 2L2 8V22H22V8L12 2Z " +                    // outer walls + roof peak
    "M12 4.4L20.2 9.3V20.5H13V14H11V20.5H3.8V9.3Z " + // hollow interior (evenodd cutout)
    "M3.8 14H11M13 9.3V20.5",                        // room dividers
};

window.customIcons = window.customIcons || {};
window.customIcons["ha-sweethome3d"] = {
  getIcon: async (name) => ({ path: ICONS[name] ?? ICONS.logo }),
};
