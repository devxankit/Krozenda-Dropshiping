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

module.exports = { upload, processImage, handleUploadError };
