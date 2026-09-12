const express = require('express');
const {
  listFaqs,
  createFaq,
  updateFaq,
  updateFaqStatus,
  deleteFaq,
} = require('../Controllers/faqController');
const { protectAdmin } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);

router.get('/', listFaqs);
router.post('/', createFaq);
router.put('/:id', updateFaq);
router.patch('/:id/status', updateFaqStatus);
router.delete('/:id', deleteFaq);

module.exports = router;
