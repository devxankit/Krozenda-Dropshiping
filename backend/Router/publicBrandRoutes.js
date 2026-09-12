const express = require('express');
const { listPublicBrands } = require('../Controllers/brandController');

const router = express.Router();

router.get('/', listPublicBrands);

module.exports = router;
