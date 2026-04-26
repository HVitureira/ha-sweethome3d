export interface HAEntity {
  entity_id: string
  state: string
  friendly_name: string
}

interface HAStateResponse {
  entity_id: string
  state: string
  attributes: { friendly_name?: string; [key: string]: unknown }
}

let cachedEntities: HAEntity[] | null = null
let fetchPromise: Promise<HAEntity[]> | null = null

const STORAGE_KEY = 'ha-smart-home-settings'

function loadSettingsFromStorage(): { address: string; token: string; useSSL: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { address: '', token: '', useSSL: true }
    const p = JSON.parse(raw)
    return {
      address: p.homeAssistantAddress ?? '',
      token: p.homeAssistantAccessToken ?? '',
      useSSL: p.useSSL ?? true,
    }
  } catch {
    return { address: '', token: '', useSSL: true }
  }
}

/**
 * Fetch HA entities via the proxy endpoint.
 * In dev mode, the Vite middleware reads HA credentials from the request headers
 * (sourced from settingsStore/localStorage) and proxies to the real HA instance.
 * In production (addon), the PHP proxy uses SUPERVISOR_TOKEN directly.
 */
async function doFetch(): Promise<HAEntity[]> {
  const settings = loadSettingsFromStorage()

  // Build headers — in dev mode the Vite proxy uses these to reach HA
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (settings.address) headers['X-HA-Address'] = settings.address
  if (settings.token) headers['X-HA-Token'] = settings.token
  headers['X-HA-SSL'] = String(settings.useSSL)

  const resp = await fetch('/haApiProxy.php', { headers })

  // Check for error responses (JSON with .error field)
  if (!resp.ok) {
    let msg = `HA API returned ${resp.status}`
    try {
      const body = await resp.json()
      if (body?.error) msg = body.error
    } catch { /* not JSON */ }
    throw new Error(msg)
  }

  const data = await resp.json()

  // Could be an error object instead of array
  if (!Array.isArray(data)) {
    if (data?.error) throw new Error(data.error)
    throw new Error('Unexpected response from HA API')
  }

  return parseStates(data)
}

function parseStates(data: HAStateResponse[]): HAEntity[] {
  return data
    .map((s) => ({
      entity_id: s.entity_id,
      state: s.state,
      friendly_name: s.attributes?.friendly_name ?? '',
    }))
    .sort((a, b) => a.entity_id.localeCompare(b.entity_id))
}

/**
 * Fetch and cache HA entities. Throws on failure so callers can show error state.
 */
export async function fetchEntities(forceRefresh = false): Promise<HAEntity[]> {
  if (cachedEntities && !forceRefresh) return cachedEntities
  if (fetchPromise && !forceRefresh) return fetchPromise

  fetchPromise = doFetch()
    .then((entities) => {
      cachedEntities = entities
      return entities
    })
    .catch((err) => {
      cachedEntities = null
      throw err
    })
    .finally(() => {
      fetchPromise = null
    })

  return fetchPromise
}

export function clearEntityCache(): void {
  cachedEntities = null
  fetchPromise = null
}

// Fire-and-forget prefetch — call at app startup
export function prefetchEntities(): void {
  fetchEntities().catch(() => {})
}
