const Category = require('../Models/Category');
const { getImageUrl } = require('../utils/imageHelper');

function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

function serializeCategory(cat) {
  const parentId = cat.parent ? (cat.parent._id ? cat.parent._id.toString() : cat.parent.toString()) : null;
  const parentName = cat.parent && cat.parent.name ? cat.parent.name : null;

  return {
    id: cat._id.toString(),
    _id: cat._id.toString(),
    name: cat.name,
    slug: cat.slug || slugify(cat.name),
    image: getImageUrl(cat.image),
    parent: parentId,
    parentId,
    parentName,
    depth: typeof cat.depth === 'number' ? cat.depth : (parentId ? 1 : 0),
    commissionRate: cat.commissionRate == null ? null : Number(cat.commissionRate),
    description: cat.description || '',
    status: cat.status || 'live',
    productCount: cat.productCount || 0,
    order: cat.order || 0,
    createdAt: cat.createdAt,
    updatedAt: cat.updatedAt,
  };
}

async function seedDefaultCategoriesIfEmpty() {
  const count = await Category.countDocuments({ isDeleted: false });
  if (count > 0) return;

  const defaults = [
    {
      name: 'Electronics',
      slug: 'electronics',
      depth: 0,
      commissionRate: 8,
      status: 'live',
      children: [
        { name: 'Audio & Headphones', slug: 'audio-headphones', commissionRate: 10 },
        { name: 'Smartphones & Tablets', slug: 'smartphones-tablets', commissionRate: null },
        { name: 'Wearables & Smartwatches', slug: 'wearables-smartwatches', commissionRate: 12 },
      ],
    },
    {
      name: 'Fashion & Apparel',
      slug: 'fashion-apparel',
      depth: 0,
      commissionRate: 15,
      status: 'live',
      children: [
        { name: "Men's Wear", slug: 'mens-wear', commissionRate: null },
        { name: "Women's Western & Ethnic", slug: 'womens-western-ethnic', commissionRate: null },
        { name: 'Footwear & Sneakers', slug: 'footwear-sneakers', commissionRate: 18 },
      ],
    },
    {
      name: 'Home & Kitchen',
      slug: 'home-kitchen',
      depth: 0,
      commissionRate: 12,
      status: 'live',
      children: [
        { name: 'Kitchen Appliances', slug: 'kitchen-appliances', commissionRate: null },
        { name: 'Home Decor & Lighting', slug: 'home-decor-lighting', commissionRate: 14 },
      ],
    },
    {
      name: 'Health & Personal Care',
      slug: 'health-personal-care',
      depth: 0,
      commissionRate: 10,
      status: 'live',
      children: [
        { name: 'Skincare & Cosmetics', slug: 'skincare-cosmetics', commissionRate: null },
        { name: 'Personal Grooming', slug: 'personal-grooming', commissionRate: null },
      ],
    },
  ];

  for (const rootData of defaults) {
    const root = await Category.create({
      name: rootData.name,
      slug: rootData.slug,
      depth: 0,
      commissionRate: rootData.commissionRate,
      status: rootData.status,
      parent: null,
    });

    for (const childData of rootData.children) {
      await Category.create({
        name: childData.name,
        slug: childData.slug,
        depth: 1,
        commissionRate: childData.commissionRate,
        status: 'live',
        parent: root._id,
      });
    }
  }
}

async function getCategoryTree(req, res) {
  await seedDefaultCategoriesIfEmpty();

  const allCategories = await Category.find({ isDeleted: false })
    .populate('parent', 'name _id')
    .sort({ order: 1, createdAt: 1 })
    .lean();

  const roots = allCategories.filter((c) => !c.parent);
  const children = allCategories.filter((c) => Boolean(c.parent));

  // Build tree order: parent followed by its children
  const orderedNodes = [];
  roots.forEach((root) => {
    orderedNodes.push(serializeCategory(root));
    const subs = children.filter((child) => {
      const pId = child.parent?._id ? child.parent._id.toString() : child.parent?.toString();
      return pId === root._id.toString();
    });
    subs.forEach((sub) => {
      orderedNodes.push(serializeCategory(sub));
    });
  });

  // Any orphaned subcategories (whose parent was deleted or not found)
  const orphanSubs = children.filter(
    (child) =>
      !orderedNodes.some((node) => node.id === child._id.toString())
  );
  orphanSubs.forEach((child) => orderedNodes.push(serializeCategory(child)));

  const stats = {
    totalCategories: orderedNodes.length,
    rootCategories: roots.length,
    subCategories: children.length,
    liveCategories: orderedNodes.filter((c) => c.status === 'live').length,
  };

  res.json({
    success: true,
    data: {
      nodes: orderedNodes,
      stats,
    },
  });
}

async function createCategory(req, res) {
  const { name, parent, depth, commissionRate, description, status } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Category name is required' });
  }

  const parsedDepth = parent ? 1 : Number(depth || 0);
  const parsedCommission =
    commissionRate === '' || commissionRate == null ? null : Number(commissionRate);

  const category = await Category.create({
    name: name.trim(),
    slug: slugify(name),
    image: req.file?.url || null,
    parent: parent || null,
    depth: parsedDepth,
    commissionRate: parsedCommission,
    description: description ? description.trim() : '',
    status: status || 'live',
    createdBy: req.admin?._id || null,
  });

  const populated = await Category.findById(category._id).populate('parent', 'name _id');

  res.status(201).json({
    success: true,
    message: 'Category created successfully',
    data: serializeCategory(populated),
  });
}

async function updateCategory(req, res) {
  const { id } = req.params;
  const { name, parent, depth, commissionRate, description, status } = req.body;

  const category = await Category.findOne({ _id: id, isDeleted: false });
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  if (name) {
    category.name = name.trim();
    category.slug = slugify(name);
  }

  if (parent !== undefined) {
    // Cannot set self as parent
    if (parent === id) {
      return res.status(400).json({ success: false, message: 'A category cannot be its own parent' });
    }
    category.parent = parent || null;
    category.depth = parent ? 1 : 0;
  } else if (depth !== undefined) {
    category.depth = Number(depth);
  }

  if (commissionRate !== undefined) {
    category.commissionRate =
      commissionRate === '' || commissionRate == null ? null : Number(commissionRate);
  }

  if (description !== undefined) {
    category.description = description ? description.trim() : '';
  }

  if (status) {
    category.status = status;
  }

  if (req.file?.url) {
    category.image = req.file.url;
  }

  await category.save();
  const populated = await Category.findById(category._id).populate('parent', 'name _id');

  res.json({
    success: true,
    message: 'Category updated successfully',
    data: serializeCategory(populated),
  });
}

async function updateCategoryStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required' });
  }

  const category = await Category.findOne({ _id: id, isDeleted: false });
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  category.status = status;
  await category.save();

  res.json({
    success: true,
    message: `Category status set to ${status}`,
    data: serializeCategory(category),
  });
}

async function deleteCategory(req, res) {
  const { id } = req.params;

  const category = await Category.findOne({ _id: id, isDeleted: false });
  if (!category) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }

  // Check for child subcategories
  const childCount = await Category.countDocuments({ parent: id, isDeleted: false });
  if (childCount > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete "${category.name}" because it contains ${childCount} sub-category(ies). Delete or move them first.`,
    });
  }

  if (category.productCount > 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete "${category.name}" because it has ${category.productCount} active products.`,
    });
  }

  category.isDeleted = true;
  await category.save();

  res.json({
    success: true,
    message: 'Category removed successfully',
    data: { id: category._id.toString() },
  });
}

module.exports = {
  getCategoryTree,
  createCategory,
  updateCategory,
  updateCategoryStatus,
  deleteCategory,
};
