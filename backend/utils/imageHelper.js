function getImageUrl(relativePath) {
  if (!relativePath) return null;
  if (typeof relativePath !== 'string') return null;
  const trimmed = relativePath.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const base = (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}

module.exports = { getImageUrl };
