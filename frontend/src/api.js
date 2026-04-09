// API base path — proxied through Vite in dev
export const API_BASE = import.meta.env.VITE_API_BASE || "/api";

/**
 * Centralized fetch helper for API requests.
 * Automatically attaches headers needed (e.g., bypassing ngrok warnings)
 * and uses the configured API_BASE.
 */
export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
  
  const headers = {
    // Bypass ngrok's browser warning page which interferes with missing CORS headers / JSON fetch
    "ngrok-skip-browser-warning": "true",
    ...options.headers,
  };

  return fetch(url, { ...options, headers });
}
