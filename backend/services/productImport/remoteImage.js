const http = require('http');
const https = require('https');
const dns = require('dns');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { writeImageSet, generateFilename } = require('../../Middlewares/uploadMiddleware');
const { VARIANTS } = require('../../Config/imageSizes');

// Fetches an image a seller or admin named by URL in a CSV import and runs it
// through the same sharp/WebP pipeline as a form upload (writeImageSet).
//
// Unlike cjImageService this cannot use a hostname allowlist — the whole point
// is "any public image URL" — so the server-side request forgery defence is
// entirely in where the socket is allowed to connect: public addresses only,
// checked after DNS resolution (so a hostname that resolves to 10.x or to the
// cloud metadata address is refused) and again on every redirect hop.

const MAX_BYTES = 10 * 1024 * 1024; // same ceiling as a form upload
const TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 3;
const ALLOWED_PORTS = new Set(['', '80', '443']);

const SUBFOLDER = 'products';
const DEST_DIR = path.join(__dirname, '..', '..', 'uploads', SUBFOLDER);
// Every file this module writes carries this prefix, and cleanup refuses to
// touch anything without it — so discarding a rejected import can never
// delete an image a live product is using.
const FILE_PREFIX = 'import';
const STAGED_PATH = /^\/uploads\/products\/import-[\w-]+\.webp$/;

class RemoteImageError extends Error {}

function isPrivateIpv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, incl. cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast and reserved
  );
}

function isPrivateIp(address) {
  if (net.isIPv4(address)) return isPrivateIpv4(address);
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    // IPv4-mapped (::ffff:10.0.0.1) is an IPv4 address wearing a disguise.
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIpv4(mapped[1]);
    return (
      lower === '::' ||
      lower === '::1' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe8') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb') ||
      lower.startsWith('ff')
    );
  }
  return true;
}

// Respects both shapes Node asks a custom lookup for (single address, or
// `all: true` for Happy Eyeballs) — see cjImageService.safeLookup for the bug
// forcing one shape caused.
function safeLookup(hostname, options, callback) {
  dns.lookup(hostname, options, (err, address, family) => {
    if (err) return callback(err);
    if (options.all) {
      const list = Array.isArray(address) ? address : [{ address, family }];
      const safe = list.filter((a) => !isPrivateIp(a.address));
      if (safe.length === 0) return callback(new RemoteImageError('the host resolves to a private address'));
      return callback(null, safe);
    }
    if (isPrivateIp(address)) return callback(new RemoteImageError('the host resolves to a private address'));
    callback(null, address, family);
  });
}

function assertFetchable(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new RemoteImageError('not a valid URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new RemoteImageError('only http and https URLs are accepted');
  }
  if (url.username || url.password) throw new RemoteImageError('URLs with credentials are not accepted');
  if (!ALLOWED_PORTS.has(url.port)) throw new RemoteImageError('only the standard web ports are allowed');
  // Node skips `lookup` entirely for an IP literal, so those are checked here.
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isPrivateIp(host)) throw new RemoteImageError('private addresses are not allowed');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new RemoteImageError('private addresses are not allowed');
  }
  return url;
}

function requestOnce(url) {
  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(
      url,
      { lookup: safeLookup, headers: { 'User-Agent': 'KrozendaImageImport/1.0', Accept: 'image/*' } },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          resolve({ redirect: new URL(res.headers.location, url).toString() });
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new RemoteImageError(`the server answered HTTP ${res.statusCode}`));
          return;
        }
        const declared = Number(res.headers['content-length']);
        if (declared && declared > MAX_BYTES) {
          res.resume();
          reject(new RemoteImageError('the image is larger than 10MB'));
          return;
        }

        const chunks = [];
        let bytes = 0;
        res.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes > MAX_BYTES) {
            req.destroy(new RemoteImageError('the image is larger than 10MB'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve({ buffer: Buffer.concat(chunks) }));
        res.on('error', reject);
      }
    );
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new RemoteImageError('the download timed out')));
    req.on('error', reject);
  });
}

async function downloadImage(rawUrl) {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = assertFetchable(current);
    const result = await requestOnce(url);
    if (result.buffer) return result.buffer;
    current = result.redirect;
  }
  throw new RemoteImageError('too many redirects');
}

// Returns the stored relative URL ("/uploads/products/import-....webp").
// Throws with a message written for the person reading the preview.
async function fetchAndStoreImage(rawUrl) {
  let buffer;
  try {
    buffer = await downloadImage(rawUrl);
  } catch (err) {
    const reason = err instanceof RemoteImageError ? err.message : 'the server could not be reached';
    throw new RemoteImageError(reason);
  }

  try {
    const result = await writeImageSet(buffer, {
      destDir: DEST_DIR,
      subfolder: SUBFOLDER,
      filename: generateFilename(FILE_PREFIX),
      width: 1000,
      height: 1000,
      fit: 'cover',
    });
    return result.url;
  } catch (err) {
    throw new RemoteImageError(err.status ? 'it is not a JPEG, PNG, WebP, AVIF or GIF image' : 'the image could not be processed');
  }
}

// Deletes a staged image and its size derivatives. Anything that is not a
// file this module wrote is ignored.
async function deleteStagedImage(relativeUrl) {
  if (typeof relativeUrl !== 'string' || !STAGED_PATH.test(relativeUrl)) return;
  const canonical = path.join(DEST_DIR, path.basename(relativeUrl));
  const ext = path.extname(canonical);
  const files = [canonical, ...VARIANTS.map((v) => `${canonical.slice(0, -ext.length)}-${v.suffix}${ext}`)];
  await Promise.all(files.map((file) => fs.promises.unlink(file).catch(() => {})));
}

module.exports = { fetchAndStoreImage, deleteStagedImage, isPrivateIp, assertFetchable, RemoteImageError };
