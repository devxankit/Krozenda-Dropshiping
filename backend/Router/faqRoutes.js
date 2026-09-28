const express = require('express');
const {
  listFaqs,
  createFaq,
  updateFaq,
  updateFaqStatus,
  deleteFaq,
} = require('../Controllers/faqController');
const { protectAdmin, requirePermission, requireAnyPermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

// Same keys as the CMS pages the FAQs are edited alongside.
const VIEW = requireAnyPermission('admin.marketing.banners', 'admin.marketing.manage');
const MANAGE = requirePermission('admin.marketing.manage');

router.use(protectAdmin);

router.get('/', VIEW, listFaqs);
router.post('/', MANAGE, createFaq);
router.put('/:id', MANAGE, updateFaq);
router.patch('/:id/status', MANAGE, updateFaqStatus);
router.delete('/:id', MANAGE, deleteFaq);

module.exports = router;
