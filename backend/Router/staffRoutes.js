const express = require('express');
const {
  createStaff,
  listStaff,
  getStaff,
  updateStaff,
  updateStaffStatus,
  updateStaffRole,
  updateStaffPassword,
  deleteStaff,
} = require('../Controllers/staffController');
const { protectAdmin, requireRole } = require('../Middlewares/authMiddleware');
const { upload, processImage, handleUploadError } = require('../Middlewares/uploadMiddleware');

const router = express.Router();

// Staff management is admin-only, regardless of any permission a staff
// account might otherwise hold.
router.use(protectAdmin, requireRole('admin'));

const uploadImage = [upload.single('image'), processImage('staff'), handleUploadError];

router.post('/', ...uploadImage, createStaff);
router.get('/', listStaff);
router.get('/:id', getStaff);
router.put('/:id', ...uploadImage, updateStaff);
router.patch('/:id/status', updateStaffStatus);
router.patch('/:id/role', updateStaffRole);
router.patch('/:id/password', updateStaffPassword);
router.delete('/:id', deleteStaff);

module.exports = router;
