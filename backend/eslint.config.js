import js from '@eslint/js'
import globals from 'globals'
import importPlugin from 'eslint-plugin-import'
import prettierConfig from 'eslint-config-prettier'

export default [
  { ignores: ['node_modules', 'dist'] },

  js.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2022 },
    },
    plugins: { import: importPlugin },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // ---------------------------------------------------------------------
  // Layer boundary: controllers/ may only call into services/. Importing
  // mongoose or a models/ module from inside a module's controllers/
  // folder skips the service layer and is a lint error, not just a
  // documented convention.
  // ---------------------------------------------------------------------
  {
    files: ['src/modules/*/controllers/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'mongoose',
              message:
                'controllers/ must not import mongoose directly. Call a service function from services/ instead — see README "Layer rules".',
            },
          ],
          patterns: [
            {
              group: ['**/models/*', '**/models/index.js'],
              message:
                'controllers/ must not import models/ directly. Call a service function from services/ instead — services call models, controllers call services.',
            },
          ],
        },
      ],
    },
  },

  prettierConfig,
]
