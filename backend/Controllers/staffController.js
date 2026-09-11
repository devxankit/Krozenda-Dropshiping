const User = require('../Models/User');
const Role = require('../Models/Role');
const { getImageUrl } = require('../utils/imageHelper');

function serializeStaff(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    image: getImageUrl(user.image),
    mobileNumber: user.mobileNumber,
    gender: user.gender,
    dob: user.dob,
    role: user.role,
    roleId: user.roleId?._id || user.roleId || null,
    roleName: user.roleId?.name || null,
    permissions: user.roleId?.permissions || [],
    isActive: user.isActive,
    createdBy: user.createdBy,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function resolveRoleId(roleId) {
  if (!roleId) return null;
  const role = await Role.findById(roleId);
  if (!role) {
    const err = new Error('Selected role does not exist');
    err.status = 400;
    throw err;
  }
  return role._id;
}

async function createStaff(req, res) {
  const { name, email, password, mobileNumber, gender, dob, roleId, isActive } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password are required' });
  }

  let resolvedRoleId;
  try {
    resolvedRoleId = await resolveRoleId(roleId);
  } catch (err) {
    return res.status(err.status || 400).json({ success: false, message: err.message });
  }

  try {
    const staff = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password,
      mobileNumber,
      gender,
      dob,
      image: req.file?.url || null,
      role: 'staff',
      roleId: resolvedRoleId,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.admin._id,
    });

    await staff.populate('roleId');
    res.status(201).json({ success: true, message: 'Staff created successfully', data: serializeStaff(staff) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email is already in use' });
    }
    throw err;
  }
}

async function listStaff(req, res) {
  const staff = await User.find({ role: 'staff', isDeleted: false }).populate('roleId').sort({ createdAt: -1 });
  res.json({ success: true, data: staff.map(serializeStaff) });
}

async function getStaff(req, res) {
  const staff = await User.findOne({ _id: req.params.id, role: 'staff', isDeleted: false }).populate('roleId');
  if (!staff) {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }
  res.json({ success: true, data: serializeStaff(staff) });
}

async function updateStaff(req, res) {
  const staff = await User.findOne({ _id: req.params.id, role: 'staff', isDeleted: false });
  if (!staff) {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }

  const { name, email, mobileNumber, gender, dob, isActive } = req.body;

  if (name !== undefined) staff.name = name;
  if (email !== undefined) staff.email = email.toLowerCase().trim();
  if (mobileNumber !== undefined) staff.mobileNumber = mobileNumber;
  if (gender !== undefined) staff.gender = gender;
  if (dob !== undefined) staff.dob = dob;
  if (isActive !== undefined) staff.isActive = isActive;
  if (req.file?.url) staff.image = req.file.url;

  try {
    await staff.save();
    await staff.populate('roleId');
    res.json({ success: true, message: 'Staff updated successfully', data: serializeStaff(staff) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email is already in use' });
    }
    throw err;
  }
}

async function updateStaffStatus(req, res) {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, message: 'isActive (boolean) is required' });
  }

  const staff = await User.findOneAndUpdate(
    { _id: req.params.id, role: 'staff', isDeleted: false },
    { isActive },
    { new: true }
  ).populate('roleId');

  if (!staff) {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }

  res.json({ success: true, message: 'Staff status updated', data: serializeStaff(staff) });
}

async function updateStaffRole(req, res) {
  let resolvedRoleId;
  try {
    resolvedRoleId = await resolveRoleId(req.body.roleId);
  } catch (err) {
    return res.status(err.status || 400).json({ success: false, message: err.message });
  }

  const staff = await User.findOneAndUpdate(
    { _id: req.params.id, role: 'staff', isDeleted: false },
    { roleId: resolvedRoleId },
    { new: true }
  ).populate('roleId');

  if (!staff) {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }

  res.json({ success: true, message: 'Role updated', data: serializeStaff(staff) });
}

async function updateStaffPassword(req, res) {
  const { password } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  }

  const staff = await User.findOne({ _id: req.params.id, role: 'staff', isDeleted: false });
  if (!staff) {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }

  staff.password = password;
  await staff.save();

  res.json({ success: true, message: 'Password updated successfully' });
}

async function deleteStaff(req, res) {
  const staff = await User.findOneAndUpdate(
    { _id: req.params.id, role: 'staff', isDeleted: false },
    { isDeleted: true, isActive: false },
    { new: true }
  );

  if (!staff) {
    return res.status(404).json({ success: false, message: 'Staff not found' });
  }

  res.json({ success: true, message: 'Staff deleted successfully' });
}

module.exports = {
  createStaff,
  listStaff,
  getStaff,
  updateStaff,
  updateStaffStatus,
  updateStaffRole,
  updateStaffPassword,
  deleteStaff,
};
