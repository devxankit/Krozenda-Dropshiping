// Layer rule: services/ is the ONLY place that imports a model directly.
export function getSessionStatus(user) {
  return {
    isAuthenticated: true,
    sessionExpiresAt: new Date(user.tokenExpiresAt * 1000).toISOString(),
  }
}
