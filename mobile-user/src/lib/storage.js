// Token persistence. Tokens live in SecureStore (Android Keystore); everything else uses
// AsyncStorage. SecureStore is async, so the values are mirrored in memory and `bootstrapStorage()`
// must finish before the first render (see app/_layout.js) — after that every read is synchronous,
// which keeps the axios interceptor and the zustand stores identical to the web app's.
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

const KEYS = Object.freeze({
  ACCESS_TOKEN: 'krozenda.accessToken',
  REFRESH_TOKEN: 'krozenda.refreshToken',
  USER_DATA: 'krozenda.userData',
  GRANTS: 'krozenda.grants',
})

const mem = { access: null, refresh: null, user: null, grants: null }

export async function bootstrapStorage() {
  try {
    mem.access = await SecureStore.getItemAsync(KEYS.ACCESS_TOKEN)
    mem.refresh = await SecureStore.getItemAsync(KEYS.REFRESH_TOKEN)
  } catch {
    // Keystore unavailable — behave as signed out.
  }
  try {
    const [[, user], [, grants]] = await AsyncStorage.multiGet([KEYS.USER_DATA, KEYS.GRANTS])
    mem.user = user ? JSON.parse(user) : null
    mem.grants = grants ? JSON.parse(grants) : null
  } catch {
    // Corrupt cache — ignore.
  }
}

const secureSet = (key, value) => {
  if (value) SecureStore.setItemAsync(key, value).catch(() => {})
  else SecureStore.deleteItemAsync(key).catch(() => {})
}

export const storage = Object.freeze({
  getAccessToken: () => mem.access,
  setAccessToken: (token) => {
    mem.access = token || null
    secureSet(KEYS.ACCESS_TOKEN, token)
  },
  getRefreshToken: () => mem.refresh,
  setRefreshToken: (token) => {
    mem.refresh = token || null
    secureSet(KEYS.REFRESH_TOKEN, token)
  },
  getUserData: () => mem.user,
  setUserData: (user) => {
    mem.user = user
    AsyncStorage.setItem(KEYS.USER_DATA, JSON.stringify(user)).catch(() => {})
  },
  getGrants: () => mem.grants,
  setGrants: (grants) => {
    mem.grants = grants
    AsyncStorage.setItem(KEYS.GRANTS, JSON.stringify(grants)).catch(() => {})
  },
  // Sign-out wipes everything this app persisted (cart, wishlist, language cache, checkout…): the
  // next person on the device must not inherit it.
  clearAll: () => {
    mem.access = mem.refresh = mem.user = mem.grants = null
    secureSet(KEYS.ACCESS_TOKEN, null)
    secureSet(KEYS.REFRESH_TOKEN, null)
    AsyncStorage.clear().catch(() => {})
  },
})
