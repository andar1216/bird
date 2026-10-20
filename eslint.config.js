import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'dist-electron', 'ferdium-app', 'element-web', 'server/.data']),
  {
    files: ['**/*.{js,jsx}'],
    ignores: ['electron/**', 'server/**'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // API server: Node ESM
    files: ['server/**/*.{js,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node, sourceType: 'module' },
  },
  {
    // Electron main/preload run in Node (CommonJS)
    files: ['electron/**/*.cjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
      sourceType: 'commonjs',
    },
  },
])
