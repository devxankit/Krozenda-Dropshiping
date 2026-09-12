const express = require('express');
const { listPublicCategories } = require('../Controllers/categoryController');

const router = express.Router();

router.get('/', listPublicCategories);

module.exports = router;
