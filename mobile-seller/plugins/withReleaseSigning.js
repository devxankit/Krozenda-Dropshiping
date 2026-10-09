// Signs the release build with the permanent seller keystore. The keystore and its passwords live
// OUTSIDE the repo: ~/.krozenda-keys/krozenda-seller.jks, referenced through user-level gradle
// properties (~/.gradle/gradle.properties: KROZENDA_SELLER_STORE_FILE / _STORE_PASSWORD / _KEY_ALIAS / _KEY_PASSWORD).
const { withAppBuildGradle } = require('@expo/config-plugins')

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents
    if (src.includes('KROZENDA_SELLER_STORE_FILE')) return cfg
    src = src.replace(
      /signingConfigs\s*\{/,
      `signingConfigs {
        release {
            if (project.hasProperty('KROZENDA_SELLER_STORE_FILE')) {
                storeFile file(KROZENDA_SELLER_STORE_FILE)
                storePassword KROZENDA_SELLER_STORE_PASSWORD
                keyAlias KROZENDA_SELLER_KEY_ALIAS
                keyPassword KROZENDA_SELLER_KEY_PASSWORD
            }
        }`,
    )
    // release buildType must use the release signing config, not debug.
    src = src.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/, '$1signingConfig signingConfigs.release')
    cfg.modResults.contents = src
    return cfg
  })
}
