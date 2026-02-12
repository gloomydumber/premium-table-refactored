import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import dts from 'vite-plugin-dts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === 'lib' ? [dts({ rollupTypes: true, tsconfigPath: './tsconfig.app.json' })] : []),
  ],
  build: mode === 'lib' ? {
    lib: {
      entry: 'src/lib.ts',
      formats: ['es'] as const,
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        'react', 'react-dom', 'react/jsx-runtime',
        '@mui/material', '@mui/icons-material',
        '@emotion/react', '@emotion/styled',
        'jotai', 'jotai/utils',
        'react-virtuoso',
        'react-use-websocket',
      ],
    },
  } : {},
}))
