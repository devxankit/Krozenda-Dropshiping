const https = require('https');
const dns = require('dns').promises;
const net = require('net');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const { writeImageSet } = require('../../Middlewares/uploadMiddleware');
const { log } = require('./shopifyClient');

// Pulling product images off Shopify's CDN into Krozenda's own uploads.
//
// WHY COPY THEM AT ALL, rather than storing the CDN URL? Because the URL is
// the provider's to revoke. Delete the product in Shopify, change apps, or
// let the store lapse, and every product page on Krozenda loses its images
// with no warning and no way to recover them. Copying costs disk once.
//
// Everything here treats the URL as untrusted input, because it arrives from
// an external API: the host is checked against an allowlist, the resolved IP
// is checked so a hostname cannot point at the private network, the download
// is size- and time-capped, and the bytes go through the SAME sharp pipeline
// as an admin upload rather than being written to disk as received.

const ALLOWED_HOSTS = ['cdn.shopify.com', 'cdn.shopifycdn.net', 'shopify-assets.shopifycdn.com'];
const MAX_BYTES = 12 * 1024 * 1024;
const TIMEOUT_MS = 20000;
const MAX_REDIRECTS = 3;

const UPLOADS_ROOT = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');
const SUBFOLDER = 'shopify';

function hostAllowed(hostname) {
  const host = String(hostname || '').toLowerCase();
  // Exact or sub-domain match, never a substring one: "cdn.shopify.com.evil.tld"
  // contains an allowed host but is not one.
  return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }
  const lower = String(ip).toLowerCase();
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
}

async function assertSafeUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Image URL is not a valid URL');
  }
  if (url.protocol !== 'https:') throw new Error('Image URL is not HTTPS');
  if (!hostAllowed(url.hostname)) throw new Error(`Image host not allowed: ${url.hostname}`);

  // Resolve and check: an allowed hostname that resolves into the private
  // network would otherwise turn this downloader into a way to probe it.
  const records = await dns.lookup(url.hostname, { all: true });
  if (records.some((r) => isPrivateAddress(r.address))) {
    throw new Error(`Image host resolves to a private address: ${url.hostname}`);
  }
  return url;
}

function download(url, redirectsLeft = MAX_REDIRECTS) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      { hostname: url.hostname, path: `${url.pathname}${url.search}`, headers: { Accept: 'image/*' } },
      (response) => {
        const { statusCode, headers } = response;

        if ([301, 302, 303, 307, 308].includes(statusCode) && headers.location) {
          response.resume();
          if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));
          // A redirect is a fresh URL and gets the full check again — this is
          // the usual way an allowlist is escaped.
          return assertSafeUrl(new URL(headers.location, url).toString())
            .then((next) => download(next, redirectsLeft - 1))
            .then(resolve)
            .catch(reject);
        }

        if (statusCode !== 200) {
          response.resume();
          return reject(new Error(`Image download returned ${statusCode}`));
        }

        const declared = Number(headers['content-length']);
        if (Number.isFinite(declared) && declared > MAX_BYTES) {
          request.destroy();
          return reject(new Error('Image too large'));
        }

        const chunks = [];
        let bytes = 0;
        response.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes > MAX_BYTES) {
            request.destroy();
            reject(new Error('Image too large'));
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
      reject(new Error('Image download timed out'));
    });
    request.on('error', reject);
  });
}

function filenameFor(sourceUrl) {
  const hash = crypto.createHash('sha1').update(sourceUrl).digest('hex').slice(0, 24);
  return `shopify-${hash}.webp`;
}

/**
 * Import one image. Returns its local URL, or null if it could not be taken.
 *
 * Never throws: a product with four of its five images is worth having, and a
 * failed download must not abandon an otherwise complete import.
 */
async function importImage(sourceUrl) {
  try {
    const url = await assertSafeUrl(sourceUrl);
    const buffer = await download(url);
    const result = await writeImageSet(buffer, {
      destDir: path.join(UPLOADS_ROOT, SUBFOLDER),
      subfolder: SUBFOLDER,
      filename: filenameFor(sourceUrl),
      width: 1000,
      height: 1000,
      fit: 'contain',
    });
    return result.url;
  } catch (err) {
    log({ event: 'SHOPIFY_IMAGE_IMPORT_FAILED', url: String(sourceUrl).slice(0, 200), error: err.message });
    return null;
  }
}

/**
 * Import a list of images, in order, skipping the ones that fail.
 *
 * Sequential on purpose: each sharp pipeline holds a decoded bitmap, and a
 * product with twenty images decoded at once is hundreds of megabytes.
 */
async function importImages(sourceUrls = []) {
  const seen = new Set();
  const out = [];
  for (const sourceUrl of sourceUrls) {
    if (!sourceUrl || seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    const local = await importImage(sourceUrl);
    if (local) out.push(local);
  }
  return out;
}

module.exports = { importImage, importImages, assertSafeUrl, hostAllowed, isPrivateAddress, ALLOWED_HOSTS };
