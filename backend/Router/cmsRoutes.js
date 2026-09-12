const express = require('express');
const {
  listCmsPages,
  getCmsPage,
  createCmsPage,
  updateCmsPage,
  updateCmsPageStatus,
  deleteCmsPage,
  getPublicCmsPage,
} = require('../Controllers/cmsController');
const { protectAdmin } = require('../Middlewares/authMiddleware');

const router = express.Router();

// Admin routes with admin protection
router.get('/', protectAdmin, listCmsPages);
router.post('/', protectAdmin, createCmsPage);
router.get('/:id', protectAdmin, getCmsPage);
router.put('/:id', protectAdmin, updateCmsPage);
router.patch('/:id/status', protectAdmin, updateCmsPageStatus);
router.delete('/:id', protectAdmin, deleteCmsPage);

module.exports = router;
