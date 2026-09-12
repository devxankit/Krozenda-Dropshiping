const express = require('express');
const { listPublicProducts } = require('../Controllers/productController');

const router = express.Router();

router.get('/', listPublicProducts);

module.exports = router;
