const express = require('express');
const {
  listTutorials,
  createTutorial,
  updateTutorial,
  updateTutorialStatus,
  deleteTutorial,
} = require('../Controllers/tutorialController');
const { protectAdmin, requirePermission, requireAnyPermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

// Same keys as the CMS pages and FAQs the tutorials are edited alongside.
const VIEW = requireAnyPermission('admin.marketing.banners', 'admin.marketing.manage');
const MANAGE = requirePermission('admin.marketing.manage');

router.use(protectAdmin);

router.get('/', VIEW, listTutorials);
router.post('/', MANAGE, createTutorial);
router.put('/:id', MANAGE, updateTutorial);
router.patch('/:id/status', MANAGE, updateTutorialStatus);
router.delete('/:id', MANAGE, deleteTutorial);

module.exports = router;
