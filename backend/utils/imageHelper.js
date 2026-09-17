const fs = require('fs');
const path = require('path');

// Shared with the write side, so a size can never be generated under one name
// and requested under another.
const { VARIANTS, CANONICAL_WIDTH } = require('../Config/imageSizes');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

function getImageUrl(relativePath) {
  if (!relativePath) return null;
  if (typeof relativePath !== 'string') return null;
  const trimmed = relativePath.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const base = (process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');
  const path_ = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${path_}`;
}

// Whether a derivative actually exists on disk. Uploads predating the
// responsive pipeline have only the canonical file, and an <img srcset>
// pointing at a 404 is worse than no srcset at all — the browser may pick the
// missing candidate and render nothing.
//
// Cached because this runs once per image per serialized product, and a
// listing page serializes twenty of them. The cache only ever holds booleans
// keyed by path, and a derivative never appears or disappears after upload, so
// it never needs invalidating within a process lifetime.
const existsCache = new Map();

function derivativeExists(relativePath) {
  if (existsCache.has(relativePath)) return existsCache.get(relativePath);

  // Only ever asked about paths this module itself constructed from an
  // /uploads/ path, but resolved-and-checked anyway so a stored value that
  // somehow contains traversal can't be used to probe the filesystem.
  const absolute = path.resolve(UPLOADS_ROOT, '.' + relativePath.replace(/^\/uploads/, ''));
  const inside = absolute.startsWith(UPLOADS_ROOT + path.sep);

  let result = false;
  if (inside) {
    try {
      result = fs.existsSync(absolute);
    } catch {
      result = false;
    }
  }

  existsCache.set(relativePath, result);
  return result;
}

function variantRelativePath(relativePath, suffix) {
  const ext = path.extname(relativePath);
  if (!ext) return null;
  return `${relativePath.slice(0, -ext.length)}-${suffix}${ext}`;
}

// Turns one stored image path into the set of URLs a responsive <img> needs.
// Returns `{ src, srcSet, sizes: null, width }` shaped for direct use, and
// falls back to just `src` when no derivative was ever written (remote URLs,
// pre-existing uploads).
//
// This is what stops a 400px product tile from downloading the 1000px file —
// on a phone on 3G that was the single largest thing the listing page did.
function getImageVariants(relativePath) {
  const src = getImageUrl(relativePath);
  if (!src) return null;

  const isLocalUpload =
    typeof relativePath === 'string' && relativePath.trim().startsWith('/uploads/');
  if (!isLocalUpload) {
    return { src, srcSet: null };
  }

  const trimmed = relativePath.trim();
  const candidates = [];

  for (const variant of VARIANTS) {
    const rel = variantRelativePath(trimmed, variant.suffix);
    if (rel && derivativeExists(rel)) {
      candidates.push(`${getImageUrl(rel)} ${variant.width}w`);
    }
  }

  if (candidates.length === 0) {
    return { src, srcSet: null };
  }

  // The canonical file closes the set as the largest candidate. Its real width
  // isn't stored, so it is declared at the pipeline's ceiling (1200w) — an
  // over-declaration only ever costs a slightly-too-eager pick on a very wide
  // viewport, whereas leaving it out would cap quality on retina displays.
  // (CANONICAL_WIDTH is the pipeline ceiling, see Config/imageSizes.)
  candidates.push(`${src} ${CANONICAL_WIDTH}w`);

  return { src, srcSet: candidates.join(', ') };
}

module.exports = { getImageUrl, getImageVariants };
