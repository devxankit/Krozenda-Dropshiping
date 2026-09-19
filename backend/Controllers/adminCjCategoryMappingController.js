const CjCategoryMapping = require('../Models/CjCategoryMapping');
const Category = require('../Models/Category');

// GET /admin/cj/category-mappings
async function listMappings(req, res) {
  const mappings = await CjCategoryMapping.find().sort({ createdAt: -1 }).populate('krozendaCategory', 'name');
  res.json({ success: true, data: mappings });
}

// POST /admin/cj/category-mappings
// body: { cjCategoryId, cjCategoryName, krozendaCategoryId }
async function upsertMapping(req, res) {
  const { cjCategoryId, cjCategoryName, krozendaCategoryId } = req.body || {};

  if (!cjCategoryId || !krozendaCategoryId) {
    return res.status(400).json({ success: false, message: 'cjCategoryId and krozendaCategoryId are required' });
  }

  const category = await Category.findById(krozendaCategoryId);
  if (!category) {
    return res.status(400).json({ success: false, message: 'krozendaCategoryId does not match an existing category' });
  }

  const mapping = await CjCategoryMapping.findOneAndUpdate(
    { cjCategoryId },
    {
      cjCategoryId,
      cjCategoryName: cjCategoryName || '',
      krozendaCategory: category._id,
      active: true,
      createdBy: req.admin?._id || null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.json({ success: true, message: 'Category mapping saved', data: mapping });
}

// DELETE /admin/cj/category-mappings/:id
async function deactivateMapping(req, res) {
  const mapping = await CjCategoryMapping.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
  if (!mapping) {
    return res.status(404).json({ success: false, message: 'Mapping not found' });
  }
  res.json({ success: true, message: 'Category mapping deactivated', data: mapping });
}

module.exports = { listMappings, upsertMapping, deactivateMapping };
