// expo-notifications throws on import inside Expo Go (remote push was removed from Expo Go in SDK 53).
// Load it lazily so the app still runs in Expo Go; in a real build (APK / dev client) it loads normally.
import Constants, { ExecutionEnvironment } from 'expo-constants'

let mod = null
if (Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
  try {
    mod = require('expo-notifications')
  } catch {
    mod = null
  }
}

export const Notifications = mod
