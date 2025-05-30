import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import federation  from '@originjs/vite-plugin-federation'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'copilot',
      filename: 'remoteEntry.js',
      exposes: {
        './Copilot': './src/components/children/Copilot.tsx',
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19.1.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.1.0' },
        '@ant-design/x': { singleton: true, requiredVersion: '^1.3.0' }
      },
    }),
  ],
  build: {
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
  },
})
