const express = require('express');
const { listPublicFaqs } = require('../Controllers/faqController');

const router = express.Router();

router.get('/', listPublicFaqs);

module.exports = router;
