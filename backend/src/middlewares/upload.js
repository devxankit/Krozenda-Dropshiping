// Shared multipart/file-upload middleware. Every upload in the app (review
// photos, seller KYC documents, future avatar/product-image uploads) goes
// through this one factory so storage layout, filename generation, and MIME
// validation stay consistent — do not construct a second multer instance
// elsewhere.
//
// Files land on shared server disk under backend/uploads/<category>/ and are
// served back to EVERY client (any user, any session, any device) via
// express.static mounted at /uploads in app.js — see publicUrlFor() below.
// That is the fix for "uploads aren't visible to other users": nothing here
// returns a browser-local blob: URL, a relative path resolved against the
// uploader's own origin, or an absolute filesystem path — every caller gets
// back a fully-qualified http(s) URL any client can load directly.
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { ApiError } from '../lib/ApiError.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// backend/uploads — sibling of src/, gitignored (see .gitignore), created on
// demand so a fresh clone doesn't need a manual mkdir step.
export const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads')

const MIME_ALLOWLIST = Object.freeze({
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  document: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
})

function storageFor(category) {
  const dir = path.join(UPLOADS_ROOT, category)
  fs.mkdirSync(dir, { recursive: true })

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    // Random filename — never trust/reuse the client-supplied originalname,
    // both to avoid collisions between different users' uploads and to
    // avoid path-traversal via a crafted filename.
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`)
    },
  })
}

// category: subfolder under uploads/, e.g. 'reviews', 'kyc'.
// kind: which MIME allowlist to enforce ('image' | 'document').
export function createUploader(category, { kind = 'image', maxSizeMb = 5 } = {}) {
  const allowedMimeTypes = MIME_ALLOWLIST[kind]

  return multer({
    storage: storageFor(category),
    limits: { fileSize: maxSizeMb * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        return cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype}`))
      }
      cb(null, true)
    },
  })
}

// Wraps a configured multer middleware (e.g. uploader.array('photos', 4)) so
// MulterError and fileFilter rejections come out as the app's normal
// ApiError shape instead of falling through to errorHandler's generic
// 500 branch.
export function handleUpload(multerMiddleware) {
  return function uploadMiddleware(req, res, next) {
    multerMiddleware(req, res, (error) => {
      if (!error) return next()
      if (error instanceof ApiError) return next(error)
      if (error instanceof multer.MulterError) {
        return next(ApiError.badRequest(error.message))
      }
      return next(error)
    })
  }
}

// Absolute, environment-correct URL for a file saved under UPLOADS_ROOT —
// resolved from the incoming request rather than a hardcoded env var, so it
// is automatically correct in dev/staging/prod without extra config.
export function publicUrlFor(req, category, filename) {
  return `${req.protocol}://${req.get('host')}/uploads/${category}/${filename}`
}
