import js from '@eslint/js'
import globals from 'globals'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * ESLint configuration for the PayLab backend.
 *
 * The backend is a Node.js ES module project, so it uses the Node globals
 * instead of the browser globals the frontend uses.
 */
export default defineConfig([
  globalIgnores(['node_modules', 'coverage']),
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'prefer-const': 'error',
      eqeqeq: ['error', 'smart'],
    },
  },
])
