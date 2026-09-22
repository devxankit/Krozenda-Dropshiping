const express = require('express');
const {
  listAttributes,
  createAttribute,
  updateAttribute,
  deleteAttribute,
} = require('../Controllers/attributeController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin, requirePermission('admin.catalog.manage'));

router.get('/', listAttributes);
router.post('/', createAttribute);
router.put('/:id', updateAttribute);
router.delete('/:id', deleteAttribute);

module.exports = router;
