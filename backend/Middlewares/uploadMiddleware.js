const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { VARIANTS } = require('../Config/imageSizes');

const storage = multer.memoryStorage();

// Decompression-bomb guard. sharp's own default (~268 megapixels) is far more
// than any product photo needs and is enough to exhaust memory on a small
// instance: a 30KB PNG can decode to gigabytes. 40MP comfortably covers a
// 50-megapixel-class camera crop while refusing the pathological cases.
const MAX_INPUT_PIXELS = 40 * 1000 * 1000;

// The client's Content-Type is a claim, not evidence. Every accepted format is
// identified by its magic bytes before sharp is allowed near the buffer.
// SVG is deliberately absent: it is a script-bearing document format, and an
// SVG served from our own origin is a stored-XSS vector.
const IMAGE_SIGNATURES = [
  { ext: 'jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'gif', test: (b) => b.subarray(0, 3).toString('latin1') === 'GIF' },
  {
    ext: 'webp',
    test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
  // ISO-BMFF container: covers AVIF and HEIC/HEIF.
  {
    ext: 'avif',
    test: (b) => b.subarray(4, 8).toString('latin1') === 'ftyp',
  },
  { ext: 'tiff', test: (b) => b.subarray(0, 2).toString('latin1') === 'II' || b.subarray(0, 2).toString('latin1') === 'MM' },
];

function sniffImageType(buffer) {
  if (!buffer || buffer.length < 16) return null;
  const match = IMAGE_SIGNATURES.find((sig) => {
    try {
      return sig.test(buffer);
    } catch {
      return false;
    }
  });
  return match ? match.ext : null;
}

function fileFilter(req, file, cb) {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  }
  // Rejected here as well as by the byte sniff below, so an obviously-wrong
  // declared type never even gets buffered.
  if (file.mimetype === 'image/svg+xml') {
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
});

// KYC-style documents (PAN card, GST certificate, cancelled cheque, ...) are
// often scanned as PDFs, which sharp can't touch — so this filter/pipeline
// pair accepts PDFs too and stores them as-is instead of transcoding.
function documentFileFilter(req, file, cb) {
  const allowed =
    (file.mimetype.startsWith('image/') && file.mimetype !== 'image/svg+xml') ||
    file.mimetype === 'application/pdf';
  if (!allowed) {
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  }
  cb(null, true);
}

const uploadDocument = multer({
  storage,
  fileFilter: documentFileFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

// ---------------------------------------------------------------------------
// Responsive derivatives
// ---------------------------------------------------------------------------
// Every upload now produces a small ladder of sizes alongside the canonical
// file, because a product card was being handed the same image as the detail
// page — a 1000x1000 webp rendered into a 160px tile on a phone. The card only
// ever needed a few KB of it.
//
// The canonical file keeps its original path and `file.url` is unchanged, so
// nothing that stores or reads these URLs today has to change. Derivatives sit
// beside it at a deterministic suffix, and utils/imageHelper.getImageVariants
// reconstructs their URLs from the canonical path when the API serializes an
// image — no schema change, no migration, and an old upload with no
// derivatives still resolves to a working canonical URL.

function variantPath(filePath, suffix) {
  const ext = path.extname(filePath);
  return `${filePath.slice(0, -ext.length)}-${suffix}${ext}`;
}

async function ensureDir(dir) {
  // The upload folders are in .gitignore, so a fresh checkout (or a new
  // subfolder) has none of them — sharp's toFile then fails with ENOENT on the
  // very first upload. Cheap to make this unconditional.
  await fs.promises.mkdir(dir, { recursive: true });
}

// Writes the canonical image plus its derivatives. Returns the canonical
// public URL.
async function writeImageSet(buffer, { destDir, subfolder, filename, width, height, fit }) {
  await ensureDir(destDir);

  const detected = sniffImageType(buffer);
  if (!detected) {
    const err = new Error('That file is not a supported image (JPEG, PNG, WebP, AVIF or GIF).');
    err.status = 400;
    throw err;
  }

  const base = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' });
  const meta = await base.metadata();

  const canonicalPath = path.join(destDir, filename);

  // withoutEnlargement matters: a 120x120 supplier thumbnail was previously
  // upscaled to 1000x1000 and re-encoded, producing a file several times
  // larger than the original with no extra detail in it.
  await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate() // honour EXIF orientation before resizing, or portrait photos land sideways
    .resize(width, height, {
      fit,
      withoutEnlargement: true,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .sharpen({ sigma: 0.5 })
    .webp({ quality: 85, effort: 4 })
    .toFile(canonicalPath);

  // Derivatives are generated from the source buffer rather than from the
  // canonical output, so each one is a single resample instead of a resample
  // of a resample.
  await Promise.all(
    VARIANTS.filter((variant) => variant.width < (width || Infinity)).map((variant) =>
      sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize(variant.width, null, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78, effort: 4 })
        .toFile(variantPath(canonicalPath, variant.suffix))
        .catch((err) => {
          // A derivative that fails to write must never fail the upload: the
          // canonical image is already on disk and getImageVariants falls back
          // to it when a size is missing.
          console.error(`[upload] derivative ${variant.suffix} failed for ${filename}:`, err.message);
        })
    )
  );

  return {
    url: `/uploads/${subfolder}/${filename}`,
    width: meta.width || null,
    height: meta.height || null,
  };
}

// Filenames are generated, never derived from req.file.originalname — a
// client-supplied name is a path-traversal and content-type-confusion vector
// and there is nothing in it we need.
function generateFilename(prefix = 'img') {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
}

function processImage(subfolder, { width = 1000, height = 1000, fit = 'contain' } = {}) {
  return async function processImageMiddleware(req, res, next) {
    if (!req.file) return next();

    try {
      const result = await writeImageSet(req.file.buffer, {
        destDir: path.join(__dirname, '..', 'uploads', subfolder),
        subfolder,
        filename: generateFilename(),
        width,
        height,
        fit,
      });
      req.file.url = result.url;
      req.file.dimensions = { width: result.width, height: result.height };
      next();
    } catch (err) {
      next(err);
    }
  };
}

function processImages(subfolder, { width = 1000, height = 1000, fit = 'contain' } = {}) {
  return async function processImagesMiddleware(req, res, next) {
    if (!req.files || req.files.length === 0) return next();

    try {
      const destDir = path.join(__dirname, '..', 'uploads', subfolder);
      await ensureDir(destDir);

      // Sequential rather than Promise.all: each sharp pipeline holds a
      // decoded bitmap, and four 40MP inputs decoded at once is hundreds of
      // megabytes of resident memory on a request a user can fire at will.
      for (const file of req.files) {
        const result = await writeImageSet(file.buffer, {
          destDir,
          subfolder,
          filename: generateFilename(),
          width,
          height,
          fit,
        });
        file.url = result.url;
        file.dimensions = { width: result.width, height: result.height };
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

function processDocument(subfolder) {
  return async function processDocumentMiddleware(req, res, next) {
    if (!req.file) return next();

    try {
      const destDir = path.join(__dirname, '..', 'uploads', subfolder);
      await ensureDir(destDir);

      if (req.file.mimetype === 'application/pdf') {
        // The client-supplied Content-Type is just a claim — confirm the
        // bytes actually start with the PDF magic number before writing
        // them to disk under a .pdf extension and serving them statically.
        if (req.file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
          return res.status(400).json({ success: false, message: 'File is not a valid PDF' });
        }
        const filename = `doc-${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`;
        await fs.promises.writeFile(path.join(destDir, filename), req.file.buffer);
        req.file.url = `/uploads/${subfolder}/${filename}`;
        return next();
      }

      if (!sniffImageType(req.file.buffer)) {
        return res.status(400).json({ success: false, message: 'That file is not a supported image or PDF.' });
      }

      const filename = `doc-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
      await sharp(req.file.buffer, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 90 })
        .toFile(path.join(destDir, filename));

      req.file.url = `/uploads/${subfolder}/${filename}`;
      next();
    } catch (err) {
      next(err);
    }
  };
}

function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Image must be smaller than 10MB'
        : err.code === 'LIMIT_FILE_COUNT'
          ? 'Too many files in one upload'
          : err.code === 'LIMIT_UNEXPECTED_FILE'
            ? 'Only JPEG, PNG, WebP, AVIF or GIF images are allowed'
            : err.message;
    return res.status(400).json({ success: false, message });
  }

  if (err) {
    // sharp reports a decode failure (corrupt file, or a pixel budget blown by
    // a decompression bomb) as a plain Error — surfaced as a 400 with a real
    // explanation rather than a 500 with a stack trace.
    return res.status(err.status || 400).json({
      success: false,
      message: err.status ? err.message : 'That image could not be processed. Please try a different file.',
    });
  }

  next();
}

function handleDocumentUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File must be smaller than 10MB'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Only image or PDF files are allowed'
          : err.message;
    return res.status(400).json({ success: false, message });
  }

  if (err) {
    return res.status(err.status || 400).json({ success: false, message: err.message || 'Upload failed' });
  }

  next();
}

module.exports = {
  upload,
  processImage,
  processImages,
  handleUploadError,
  uploadDocument,
  processDocument,
  handleDocumentUploadError,
  variantPath,
  sniffImageType,
  // Exported for cjImageService, which downloads a remote CJ image into a
  // buffer (rather than receiving a multipart upload) and needs the same
  // resize/WebP/derivative pipeline every other upload path already uses —
  // reused rather than reimplemented.
  writeImageSet,
  generateFilename,
  MAX_INPUT_PIXELS,
};
