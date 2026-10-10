import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolveApiConfig } from './src/config/apiConfig'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // 只加载前端公开配置；不能将后端 process.env 整体注入浏览器。
  const frontendEnv = loadEnv(mode, process.cwd(), 'VITE_')
  for (const key of ['VITE_DEEPSEEK_API_KEY', 'VITE_DATABASE_URL', 'VITE_JWT_SECRET']) {
    if (key in frontendEnv) throw new Error(`${key} 属于服务端私密配置，禁止使用 VITE_ 前缀`)
  }
  resolveApiConfig({
    mode: frontendEnv.VITE_AUTH_MODE,
    baseUrl: frontendEnv.VITE_API_BASE_URL,
    production: command === 'build' || process.env.NODE_ENV === 'production',
  })

  return {
    plugins: [react()],
    build: { manifest: true },
    server: {
      proxy: {
        '/api': 'http://localhost:4000',
        '/socket.io': { target: 'http://localhost:4000', ws: true },
      },
    },
  }
})
