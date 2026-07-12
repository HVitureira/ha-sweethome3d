import { ref, onMounted } from 'vue'

/**
 * useHaAddonTokenStatus — shared composable for both SettingsView and UnityView.
 *
 * Reports whether the add-on's `ha-config.json` (written at container start by
 * `00-sweethome3d.sh` from the add-on's `homeassistant_token`/
 * `homeassistant_address` options) provides a long-lived access token.
 *
 * Why this matters: Unity's `index.html` reads `localStorage` first and falls
 * back to `../ha-config.json` (same chain as `haApiProxy.php` Strategy 2 and
 * `settingsStore.initFromAddonConfig`). Each long-lived access token is
 * per-user. Without the add-on fallback, every admin user browsing the
 * visualizer would have to generate their own token + Save it in the in-app
 * Settings tab (per-browser). The add-on config fallback lets one shared
 * token satisfy all users.
 *
 * The endpoint is privacy-safe: only returns booleans, never the token value.
 */
export function useHaAddonTokenStatus() {
  const hasAddonToken = ref(false)
  const hasAddonAddress = ref(false)
  const loaded = ref(false)

  async function refresh() {
    try {
      const resp = await fetch('haConfigStatus.php')
      if (resp.ok) {
        const data = await resp.json()
        hasAddonToken.value = !!data.hasToken
        hasAddonAddress.value = !!data.hasAddress
      }
    } catch {
      // Endpoint not available (standalone / dev without test-data/ha-config.json)
    } finally {
      loaded.value = true
    }
  }

  onMounted(refresh)

  return { hasAddonToken, hasAddonAddress, loaded, refresh }
}