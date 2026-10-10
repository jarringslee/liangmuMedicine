import { resolveApiConfig } from './apiConfig'

const config = resolveApiConfig({
    mode: import.meta.env.VITE_AUTH_MODE,
    baseUrl: import.meta.env.VITE_API_BASE_URL,
    production: import.meta.env.PROD,
})

export const authMode = config.authMode
export const apiBaseUrl = config.apiBaseUrl