const express = require('express');
const { getReturnableItems, createReturnRequest, listMyReturnRequests } = require('../Controllers/returnController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');
const { writeRateLimiter } = require('../Middlewares/rateLimiter');
const { upload, processImages, handleUploadError } = require('../Middlewares/uploadMiddleware');

const router = express.Router();

router.use(protectUser);

const uploadReturnPhotos = [
  upload.array('photos', 4),
  processImages('returns', { width: 1200, height: 1200, fit: 'inside' }),
  handleUploadError,
];

router.get('/returnable', getReturnableItems);
router.get('/', listMyReturnRequests);
// Limited ahead of the upload middleware so a flood is rejected before any
// image bytes are read into memory and handed to sharp.
router.post('/', writeRateLimiter, ...uploadReturnPhotos, createReturnRequest);

module.exports = router;
