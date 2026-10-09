const { defineConfig } = require('eslint/config')
const expo = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expo,
  { ignores: ['dist/*', 'tools/*'] },
  { rules: { 'react/no-unescaped-entities': 'off', 'import/no-named-as-default-member': 'off', 'react-hooks/immutability': 'off' } },
])
