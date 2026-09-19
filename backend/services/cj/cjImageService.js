const https = require('https');
const dns = require('dns');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');
const { writeImageSet, sniffImageType } = require('../../Middlewares/uploadMiddleware');

// Downloads a CJ-hosted product image and runs it through the SAME
// sharp/WebP pipeline every other upload in this codebase uses
// (uploadMiddleware.writeImageSet) — never reimplemented, per the standing
// "reuse existing utilities" rule. Only called at IMPORT time (see
// cjOnboardingService), never while just browsing the catalogue — see that
// file's comment for why: CJ's own CDN is already fast, and re-encoding
// every browsed-but-never-imported image would add load for no benefit.

// Exact-suffix allowlist. CJ has used at least these two CDN hosts in
// observed responses; adding a new one is a one-line change here, not a
// blanket "allow any *.cjdropshipping.com" that a compromised subdomain
// could exploit.
const ALLOWED_HOSTNAMES = new Set([
  'cf.cjdropshipping.com',
  'oss-cf.cjdropshipping.com',
  'cjdropshipping.com',
]);

const MAX_BYTES = 8 * 1024 * 1024; // a product photo has no business being bigger than this
const TIMEOUT_MS = 15000;

const PRIVATE_IPV4_RANGES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
];

function isPrivateIp(address, family) {
  if (family === 6) {
    return address === '::1' || address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe80');
  }
  return PRIVATE_IPV4_RANGES.some((re) => re.test(address));
}

// Custom DNS resolution so a CJ hostname that (now or via DNS rebinding)
// resolves to a private/internal address is refused BEFORE a socket ever
// opens — a hostname allowlist alone doesn't defend against that.
//
// Node's own HTTP/TLS client sometimes calls a custom `lookup` with
// `options.all: true` (Happy Eyeballs / autoSelectFamily), expecting an
// array of {address, family} back, and other times wants the classic single
// (address, family) pair — forcing one shape regardless of what was asked
// produced "Invalid IP address: undefined" deep inside Node's socket code.
// This respects whichever shape the caller actually requested.
function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err);

    if (options.all) {
      const addresses = Array.isArray(address) ? address : [{ address, family }];
      const safe = addresses.filter((a) => !isPrivateIp(a.address, a.family));
      if (safe.length === 0) {
        return callback(new Error('Refusing to fetch from a private/internal address'));
      }
      return callback(null, safe);
    }

    if (isPrivateIp(address, family)) {
      return callback(new Error(`Refusing to fetch from private address ${address}`));
    }
    callback(null, address, family);
  });
}

class CjImageError extends Error {
  constructor(message, code = 'CJ_IMAGE_ERROR') {
    super(message);
    this.code = code;
  }
}

function assertSafeUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new CjImageError('Invalid image URL', 'INVALID_URL');
  }

  if (url.protocol !== 'https:') {
    throw new CjImageError('Only https image URLs are accepted', 'INVALID_PROTOCOL');
  }
  if (!ALLOWED_HOSTNAMES.has(url.hostname)) {
    throw new CjImageError(`Image host "${url.hostname}" is not on the allowed CJ CDN list`, 'HOST_NOT_ALLOWED');
  }
  return url;
}

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      { hostname: url.hostname, path: `${url.pathname}${url.search}`, port: 443, lookup: safeLookup },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(new CjImageError(`Image fetch failed with HTTP ${response.statusCode}`, 'FETCH_FAILED'));
          return;
        }

        const contentType = response.headers['content-type'] || '';
        if (!contentType.startsWith('image/')) {
          response.resume();
          reject(new CjImageError(`Unexpected content-type "${contentType}"`, 'BAD_CONTENT_TYPE'));
          return;
        }

        const chunks = [];
        let bytes = 0;

        response.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes > MAX_BYTES) {
            request.destroy();
            reject(new CjImageError('Image exceeds the maximum allowed size', 'TOO_LARGE'));
            return;
          }
          chunks.push(chunk);
        });

        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }
    );

    request.setTimeout(TIMEOUT_MS, () => {
      request.destroy();
      reject(new CjImageError('Image download timed out', 'TIMEOUT'));
    });
    request.on('error', reject);
  });
}

const CJ_SUBFOLDER = 'cj';
const DEST_DIR = path.join(__dirname, '..', '..', 'uploads', CJ_SUBFOLDER);

// Content-hash filename: the same CJ image URL always maps to the same
// local filename, so re-onboarding a product (or two products sharing a
// stock photo) never re-downloads or re-encodes it — the write is simply
// skipped when the canonical file already exists.
function hashFilename(rawUrl) {
  const hash = crypto.createHash('sha256').update(rawUrl).digest('hex').slice(0, 32);
  return `cj-${hash}.webp`;
}

// Downloads + optimizes one CJ image, returning the same relative
// `/uploads/...` path shape every other Product.images entry already uses —
// getImageUrl/getImageVariants (utils/imageHelper) handle it exactly like a
// normal upload, no CJ-specific serving logic needed anywhere else.
async function importCjImage(rawUrl) {
  const url = assertSafeUrl(rawUrl);
  const filename = hashFilename(rawUrl);
  const canonicalPath = path.join(DEST_DIR, filename);

  if (fs.existsSync(canonicalPath)) {
    return `/uploads/${CJ_SUBFOLDER}/${filename}`;
  }

  const buffer = await downloadBuffer(url);

  const detected = sniffImageType(buffer);
  if (!detected) {
    throw new CjImageError('Downloaded file is not a recognizable image', 'NOT_AN_IMAGE');
  }

  const { url: relativeUrl } = await writeImageSet(buffer, {
    destDir: DEST_DIR,
    subfolder: CJ_SUBFOLDER,
    filename,
    width: 1000,
    height: 1000,
    fit: 'contain',
  });

  return relativeUrl;
}

// Imports a batch of CJ images, skipping (and logging, not throwing on) any
// individual failure — one broken image URL must never fail an entire
// onboarding. Callers get back only the ones that succeeded, in order.
async function importCjImages(rawUrls, { limit = 8 } = {}) {
  const chosen = (rawUrls || []).slice(0, limit);
  const results = [];

  for (const rawUrl of chosen) {
    try {
      results.push(await importCjImage(rawUrl));
    } catch (err) {
      console.error(`[cjImageService] failed to import ${rawUrl}:`, err.message);
    }
  }

  return results;
}

module.exports = { importCjImage, importCjImages, CjImageError, ALLOWED_HOSTNAMES };
