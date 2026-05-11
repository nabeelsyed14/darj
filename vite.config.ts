import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'
import { copyFileSync, mkdirSync } from 'fs'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        vite: {
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              external: ['sql.js', 'bcryptjs']
            }
          }
        },
        onstart({ startup }) {
          mkdirSync('dist/main', { recursive: true })
          copyFileSync('src/main/db/schema.sql', 'dist/main/schema.sql')
          copyFileSync('node_modules/sql.js/dist/sql-wasm.wasm', 'dist/main/sql-wasm.wasm')
          copyFileSync('assets/logo.png', 'dist/logo.png')
          startup()
        }
      },
      {
        entry: 'src/preload/index.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist/preload'
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          antd: ['antd'],
          i18n: ['i18next', 'react-i18next']
        }
      }
    }
  }
})
