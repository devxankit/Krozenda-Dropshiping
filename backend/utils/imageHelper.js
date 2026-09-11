function getImageUrl(relativePath) {
  if (!relativePath) return null;
  const base = (process.env.BACKEND_URL || '').replace(/\/$/, '');
  return `${base}${relativePath}`;
}

module.exports = { getImageUrl };
