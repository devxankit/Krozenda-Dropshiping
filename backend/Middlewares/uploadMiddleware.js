const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// KYC-style documents (PAN card, GST certificate, cancelled cheque, ...) are
// often scanned as PDFs, which sharp can't touch — so this filter/pipeline
// pair accepts PDFs too and stores them as-is instead of transcoding.
function documentFileFilter(req, file, cb) {
  const allowed = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
  if (!allowed) {
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  }
  cb(null, true);
}

const uploadDocument = multer({
  storage,
  fileFilter: documentFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

function processImage(subfolder, { width = 1000, height = 1000, fit = 'contain' } = {}) {
  return async function processImageMiddleware(req, res, next) {
    if (!req.file) return next();

    try {
      const filename = `img-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
      const destDir = path.join(__dirname, '..', 'uploads', subfolder);
      const destPath = path.join(destDir, filename);

      await sharp(req.file.buffer)
        .resize(width, height, {
          fit,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .sharpen({ sigma: 0.5 })
        .webp({ quality: 85, effort: 4 })
        .toFile(destPath);

      req.file.url = `/uploads/${subfolder}/${filename}`;
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

      await Promise.all(
        req.files.map(async (file) => {
          const filename = `img-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
          const destPath = path.join(destDir, filename);

          await sharp(file.buffer)
            .resize(width, height, {
              fit,
              background: { r: 255, g: 255, b: 255, alpha: 1 },
            })
            .sharpen({ sigma: 0.5 })
            .webp({ quality: 85, effort: 4 })
            .toFile(destPath);

          file.url = `/uploads/${subfolder}/${filename}`;
        })
      );

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

      if (req.file.mimetype === 'application/pdf') {
        const filename = `doc-${Date.now()}-${Math.round(Math.random() * 1e9)}.pdf`;
        await fs.promises.writeFile(path.join(destDir, filename), req.file.buffer);
        req.file.url = `/uploads/${subfolder}/${filename}`;
        return next();
      }

      const filename = `doc-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
      await sharp(req.file.buffer)
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
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Only image files are allowed'
          : err.message;
    return res.status(400).json({ success: false, message });
  }

  if (err) {
    return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
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
    return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
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
};
