const express = require('express');
const { createRole, listRoles, getRole, updateRole, deleteRole } = require('../Controllers/roleController');
const { protectAdmin, requireRole } = require('../Middlewares/authMiddleware');

const router = express.Router();

// Role management is admin-only, same as staff management.
router.use(protectAdmin, requireRole('admin'));

router.post('/', createRole);
router.get('/', listRoles);
router.get('/:id', getRole);
router.put('/:id', updateRole);
router.delete('/:id', deleteRole);

module.exports = router;
