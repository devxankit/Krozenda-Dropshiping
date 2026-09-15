const express = require('express');
const { listInventory, adjustInventory } = require('../Controllers/inventoryController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin, requirePermission('admin.catalog.inventory'));

router.get('/', listInventory);
router.patch('/:id/adjust', adjustInventory);

module.exports = router;
