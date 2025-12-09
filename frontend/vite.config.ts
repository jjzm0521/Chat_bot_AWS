import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        open: true,
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
    define: {
        // Placeholder for WebSocket URL - will be replaced during deployment
        'import.meta.env.VITE_WEBSOCKET_URL': JSON.stringify(
            process.env.VITE_WEBSOCKET_URL || 'wss://your-api-id.execute-api.us-east-1.amazonaws.com/production'
        ),
    },
})
