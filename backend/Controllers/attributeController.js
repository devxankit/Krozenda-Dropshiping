const Attribute = require('../Models/Attribute');

function serializeAttribute(a) {
  return {
    id: a._id.toString(),
    name: a.name,
    type: a.type,
    values: a.values || [],
    usedBy: a.usedBy || 0,
  };
}

async function listAttributes(req, res) {
  const attributes = await Attribute.find().sort({ createdAt: -1 }).lean();
  const items = attributes.map((a) => serializeAttribute({ ...a, _id: a._id }));

  res.json({ success: true, data: { items } });
}

async function createAttribute(req, res) {
  const { name, type, values } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Attribute name is required' });
  }

  if (!Array.isArray(values) || values.length === 0) {
    return res.status(400).json({ success: false, message: 'Add at least one value' });
  }

  const attribute = await Attribute.create({
    name: name.trim(),
    type: type || 'select',
    values,
  });

  res.status(201).json({
    success: true,
    message: 'Attribute created successfully',
    data: serializeAttribute(attribute),
  });
}

async function updateAttribute(req, res) {
  const { id } = req.params;
  const { name, type, values } = req.body;

  const attribute = await Attribute.findById(id);
  if (!attribute) {
    return res.status(404).json({ success: false, message: 'Attribute not found' });
  }

  if (name && name.trim()) {
    attribute.name = name.trim();
  }
  if (type) {
    attribute.type = type;
  }
  if (Array.isArray(values)) {
    attribute.values = values;
  }

  await attribute.save();

  res.json({
    success: true,
    message: 'Attribute updated successfully',
    data: serializeAttribute(attribute),
  });
}

async function deleteAttribute(req, res) {
  const { id } = req.params;

  const attribute = await Attribute.findById(id);
  if (!attribute) {
    return res.status(404).json({ success: false, message: 'Attribute not found' });
  }

  await attribute.deleteOne();

  res.json({ success: true, message: 'Attribute deleted successfully', data: { id } });
}

module.exports = {
  listAttributes,
  createAttribute,
  updateAttribute,
  deleteAttribute,
};
