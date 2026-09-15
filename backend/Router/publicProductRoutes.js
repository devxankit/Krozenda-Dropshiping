const express = require('express');
const { listPublicProducts, getPublicProduct } = require('../Controllers/productController');

const router = express.Router();

router.get('/', listPublicProducts);
router.get('/:id', getPublicProduct);

module.exports = router;
