import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import importPlugin from 'eslint-plugin-import'
import prettierConfig from 'eslint-config-prettier'

export default [
  { ignores: ['dist', 'node_modules'] },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2022 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: '18.3' },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      import: importPlugin,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'react/prop-types': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // ---------------------------------------------------------------------
  // Layer boundary: pages/ may only call into controllers/. Importing
  // axios (directly, or via lib/axios) or a services/ module from inside a
  // module's pages/ folder skips the controller layer and is a lint error,
  // not just a documented convention.
  // ---------------------------------------------------------------------
  {
    files: ['src/modules/*/pages/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message:
                'pages/ must not import axios directly. Call a controller hook from controllers/ instead — see README "Layer rules".',
            },
          ],
          patterns: [
            {
              group: ['**/lib/axios', '**/lib/axios.js', '*/lib/axios'],
              message:
                'pages/ must not import the shared axios instance directly. Call a controller hook from controllers/ instead.',
            },
            {
              group: ['**/services/*', '../services/*', './services/*'],
              message:
                'pages/ must not import services/ directly. Call a controller hook from controllers/ instead — controllers call services, pages call controllers.',
            },
          ],
        },
      ],
    },
  },

  prettierConfig,
]
