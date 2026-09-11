const Role = require('../Models/Role');
const User = require('../Models/User');
const { ADMIN_PERMISSIONS } = require('../Config/permissions');

function serializeRole(role) {
  return {
    id: role._id,
    name: role.name,
    permissions: role.permissions,
    isActive: role.isActive,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

// Every role implicitly includes admin.access — without it a staff account
// assigned this role couldn't get past the panel's own entry gate
// (RoleGuard on the frontend checks admin.access before anything else).
function sanitizePermissions(permissions) {
  if (!Array.isArray(permissions)) return ['admin.access'];
  const unknown = permissions.filter((key) => !ADMIN_PERMISSIONS.includes(key));
  if (unknown.length > 0) {
    const err = new Error(`Unknown permission key(s): ${unknown.join(', ')}`);
    err.status = 400;
    throw err;
  }
  return [...new Set([...permissions, 'admin.access'])];
}

async function createRole(req, res) {
  const { name, permissions, isActive } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Role name is required' });
  }

  let safePermissions;
  try {
    safePermissions = sanitizePermissions(permissions);
  } catch (err) {
    return res.status(err.status || 400).json({ success: false, message: err.message });
  }

  try {
    const role = await Role.create({
      name: name.trim(),
      permissions: safePermissions,
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json({ success: true, message: 'Role created successfully', data: serializeRole(role) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A role with this name already exists' });
    }
    throw err;
  }
}

async function listRoles(req, res) {
  const roles = await Role.find().sort({ createdAt: -1 });
  res.json({ success: true, data: roles.map(serializeRole) });
}

async function getRole(req, res) {
  const role = await Role.findById(req.params.id);
  if (!role) {
    return res.status(404).json({ success: false, message: 'Role not found' });
  }
  res.json({ success: true, data: serializeRole(role) });
}

async function updateRole(req, res) {
  const role = await Role.findById(req.params.id);
  if (!role) {
    return res.status(404).json({ success: false, message: 'Role not found' });
  }

  const { name, permissions, isActive } = req.body;

  if (name !== undefined) role.name = name.trim();
  if (permissions !== undefined) {
    try {
      role.permissions = sanitizePermissions(permissions);
    } catch (err) {
      return res.status(err.status || 400).json({ success: false, message: err.message });
    }
  }
  if (isActive !== undefined) role.isActive = isActive;

  try {
    await role.save();
    res.json({ success: true, message: 'Role updated successfully', data: serializeRole(role) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A role with this name already exists' });
    }
    throw err;
  }
}

async function deleteRole(req, res) {
  const inUseCount = await User.countDocuments({ roleId: req.params.id, isDeleted: false });
  if (inUseCount > 0) {
    return res.status(409).json({
      success: false,
      message: `This role is assigned to ${inUseCount} staff account(s) — reassign them before deleting it`,
    });
  }

  const role = await Role.findByIdAndDelete(req.params.id);
  if (!role) {
    return res.status(404).json({ success: false, message: 'Role not found' });
  }

  res.json({ success: true, message: 'Role deleted successfully' });
}

module.exports = { createRole, listRoles, getRole, updateRole, deleteRole };
