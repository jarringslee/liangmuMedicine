const mode = import.meta.env.VITE_AUTH_MODE ?? 'demo'
if (mode !== 'api' && mode !== 'demo') throw new Error('VITE_AUTH_MODE 必须为 api 或 demo')

export const authMode: 'api' | 'demo' = mode
export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/+$/, '')
