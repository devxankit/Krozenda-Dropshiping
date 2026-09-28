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
const { protectAdmin, requirePermission, requireAnyPermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

// Keys match the admin panel: the sidebar shows CMS pages under the banners
// key, and every edit action is gated on marketing.manage. These pages are
// the terms and policies buyers and sellers accept.
const VIEW = requireAnyPermission('admin.marketing.banners', 'admin.marketing.manage');
const MANAGE = requirePermission('admin.marketing.manage');

router.use(protectAdmin);

router.get('/', VIEW, listCmsPages);
router.post('/', MANAGE, createCmsPage);
router.get('/:id', VIEW, getCmsPage);
router.put('/:id', MANAGE, updateCmsPage);
router.patch('/:id/status', MANAGE, updateCmsPageStatus);
router.delete('/:id', MANAGE, deleteCmsPage);

module.exports = router;
