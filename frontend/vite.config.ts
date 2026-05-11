import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "")
  const backendPort = env.BACKEND_PORT || "8010"
  const backendTarget = env.VITE_BACKEND_TARGET || `http://localhost:${backendPort}`

  return {
    plugins: [react()],
    envDir: "..",
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: [
        "localhost",
        "127.0.0.1",
        "frontend",
        "nginx",
      ],
      // Docker volume mount 在 Windows 上不触发原生文件事件，
      // 必须用 polling 才能让 HMR 热更新生效
      watch: {
        usePolling: true,
        interval: 500,
      },
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
        },
        "/uploads": {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
