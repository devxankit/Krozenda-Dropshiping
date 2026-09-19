const express = require('express');
const { onboardProduct, listProducts } = require('../Controllers/adminCjProductController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);
router.use(requirePermission('admin.cj.products'));

router.get('/', listProducts);
router.post('/onboard', onboardProduct);

module.exports = router;
