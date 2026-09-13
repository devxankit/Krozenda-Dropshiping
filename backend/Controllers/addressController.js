const mongoose = require('mongoose');
const Address = require('../Models/Address');

function serializeAddress(a) {
  return {
    id: a._id.toString(),
    type: a.type,
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2 || '',
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    country: a.country,
    isDefault: a.isDefault,
  };
}

async function listAddresses(req, res) {
  const addresses = await Address.find({ user: req.user._id }).sort({ isDefault: -1, createdAt: -1 });
  res.json({ success: true, data: { items: addresses.map(serializeAddress) } });
}

function validateFields(body) {
  const required = ['fullName', 'phone', 'line1', 'city', 'state', 'pincode'];
  for (const field of required) {
    if (!body[field] || !String(body[field]).trim()) {
      return `${field} is required`;
    }
  }
  if (body.type && !Address.TYPES.includes(body.type)) {
    return 'Invalid address type';
  }
  return null;
}

async function createAddress(req, res) {
  const error = validateFields(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: error });
  }

  const { type, fullName, phone, line1, line2, city, state, pincode, country, isDefault } = req.body;

  const existingCount = await Address.countDocuments({ user: req.user._id });
  const shouldBeDefault = Boolean(isDefault) || existingCount === 0;

  if (shouldBeDefault) {
    await Address.updateMany({ user: req.user._id }, { $set: { isDefault: false } });
  }

  const address = await Address.create({
    user: req.user._id,
    type: type || 'home',
    fullName: fullName.trim(),
    phone: phone.trim(),
    line1: line1.trim(),
    line2: line2 ? line2.trim() : '',
    city: city.trim(),
    state: state.trim(),
    pincode: pincode.trim(),
    country: country ? country.trim() : 'India',
    isDefault: shouldBeDefault,
  });

  res.status(201).json({ success: true, message: 'Address added', data: serializeAddress(address) });
}

async function updateAddress(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid address id' });
  }

  const address = await Address.findOne({ _id: id, user: req.user._id });
  if (!address) {
    return res.status(404).json({ success: false, message: 'Address not found' });
  }

  const error = validateFields({ ...address.toObject(), ...req.body });
  if (error) {
    return res.status(400).json({ success: false, message: error });
  }

  const { type, fullName, phone, line1, line2, city, state, pincode, country, isDefault } = req.body;

  if (type !== undefined) address.type = type;
  if (fullName !== undefined) address.fullName = fullName.trim();
  if (phone !== undefined) address.phone = phone.trim();
  if (line1 !== undefined) address.line1 = line1.trim();
  if (line2 !== undefined) address.line2 = line2.trim();
  if (city !== undefined) address.city = city.trim();
  if (state !== undefined) address.state = state.trim();
  if (pincode !== undefined) address.pincode = pincode.trim();
  if (country !== undefined) address.country = country.trim();

  if (isDefault === true && !address.isDefault) {
    await Address.updateMany({ user: req.user._id }, { $set: { isDefault: false } });
    address.isDefault = true;
  }

  await address.save();
  res.json({ success: true, message: 'Address updated', data: serializeAddress(address) });
}

async function setDefaultAddress(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid address id' });
  }

  const address = await Address.findOne({ _id: id, user: req.user._id });
  if (!address) {
    return res.status(404).json({ success: false, message: 'Address not found' });
  }

  await Address.updateMany({ user: req.user._id }, { $set: { isDefault: false } });
  address.isDefault = true;
  await address.save();

  res.json({ success: true, message: 'Default address updated', data: serializeAddress(address) });
}

async function removeAddress(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid address id' });
  }

  const address = await Address.findOneAndDelete({ _id: id, user: req.user._id });
  if (!address) {
    return res.status(404).json({ success: false, message: 'Address not found' });
  }

  // Promote the most recently added remaining address so there's always a
  // default to fall back to at checkout once one exists.
  if (address.isDefault) {
    const next = await Address.findOne({ user: req.user._id }).sort({ createdAt: -1 });
    if (next) {
      next.isDefault = true;
      await next.save();
    }
  }

  res.json({ success: true, message: 'Address removed', data: { id } });
}

module.exports = { listAddresses, createAddress, updateAddress, setDefaultAddress, removeAddress };
