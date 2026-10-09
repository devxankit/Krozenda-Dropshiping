// Re-applies local release signing to the generated android/app/build.gradle (expo prebuild resets it).
// Reads the keystore path + password from ~/krozenda-local-release.txt (kept OUTSIDE the repo).
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'

const cfg = Object.fromEntries(
  readFileSync(`${homedir()}/krozenda-local-release.txt`, 'utf8')
    .trim()
    .split('\n')
    .map((l) => l.split(/=(.*)/s).slice(0, 2)),
)
const file = 'android/app/build.gradle'
let g = readFileSync(file, 'utf8')
if (!g.includes("keyAlias 'krozenda'")) {
  g = g.replace(
    'signingConfigs {\n',
    `signingConfigs {\n        release {\n            storeFile file('${cfg.KROZ_STORE}')\n            storePassword '${cfg.KROZ_PW}'\n            keyAlias 'krozenda'\n            keyPassword '${cfg.KROZ_PW}'\n        }\n`,
  )
}
g = g.replace(/(release \{\n\s*\/\/ Caution[^\n]*\n[^\n]*\n\s*)signingConfig signingConfigs\.debug/, '$1signingConfig signingConfigs.release')
writeFileSync(file, g)
console.log('release signing applied')
