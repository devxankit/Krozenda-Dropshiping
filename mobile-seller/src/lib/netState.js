// Connectivity flag fed by NetInfo (see useNetworkStatus). `null` until the first reading.
let online = null
export const setOnline = (value) => {
  online = value
}
export const isOnlineNow = () => online
