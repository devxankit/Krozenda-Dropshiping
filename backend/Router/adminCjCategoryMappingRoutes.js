const express = require('express');
const {
  listMappings,
  upsertMapping,
  deactivateMapping,
} = require('../Controllers/adminCjCategoryMappingController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);
router.use(requirePermission('admin.cj.products'));

router.get('/', listMappings);
router.post('/', upsertMapping);
router.delete('/:id', deactivateMapping);

module.exports = router;
