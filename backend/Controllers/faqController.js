const Faq = require('../Models/Faq');

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function serializeFaq(f) {
  return {
    id: f._id.toString(),
    _id: f._id.toString(),
    question: f.question,
    answer: f.answer,
    category: f.category || 'General',
    status: f.status || 'published',
    order: f.order ?? 0,
    updatedBy: f.updatedBy || 'Admin',
    updatedAt: formatDate(f.updatedAt),
    createdAt: formatDate(f.createdAt),
  };
}

// GET /admin/marketing/faqs
async function listFaqs(req, res) {
  const { search, tab, status } = req.query;
  const filter = { isDeleted: false };

  const activeTab = tab || status;
  if (activeTab === 'published') {
    filter.status = 'published';
  } else if (activeTab === 'draft') {
    filter.status = 'draft';
  }

  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [{ question: regex }, { answer: regex }, { category: regex }];
  }

  const faqs = await Faq.find(filter).sort({ order: 1, createdAt: -1 }).lean();
  const items = faqs.map(serializeFaq);

  const allFaqs = await Faq.find({ isDeleted: false }).lean();
  const stats = {
    total: allFaqs.length,
    published: allFaqs.filter((f) => f.status === 'published').length,
    draft: allFaqs.filter((f) => f.status === 'draft').length,
  };

  res.json({ success: true, data: { items, stats } });
}

// POST /admin/marketing/faqs
async function createFaq(req, res) {
  const { question, answer, category, status, order } = req.body;

  if (!question || !question.trim()) {
    return res.status(400).json({ success: false, message: 'Question is required' });
  }

  if (!answer || !answer.trim()) {
    return res.status(400).json({ success: false, message: 'Answer is required' });
  }

  const faq = await Faq.create({
    question: question.trim(),
    answer: answer.trim(),
    category: category?.trim() || 'General',
    status: status || 'published',
    order: Number.isFinite(Number(order)) ? Number(order) : 0,
    updatedBy: req.admin?.name || 'Admin',
    createdBy: req.admin?._id || null,
  });

  res.status(201).json({
    success: true,
    message: 'FAQ added successfully',
    data: serializeFaq(faq),
  });
}

// PUT /admin/marketing/faqs/:id
async function updateFaq(req, res) {
  const { id } = req.params;
  const { question, answer, category, status, order } = req.body;

  const faq = await Faq.findOne({ _id: id, isDeleted: false });
  if (!faq) {
    return res.status(404).json({ success: false, message: 'FAQ not found' });
  }

  if (question !== undefined) {
    if (!question.trim()) {
      return res.status(400).json({ success: false, message: 'Question is required' });
    }
    faq.question = question.trim();
  }

  if (answer !== undefined) {
    if (!answer.trim()) {
      return res.status(400).json({ success: false, message: 'Answer is required' });
    }
    faq.answer = answer.trim();
  }

  if (category !== undefined) {
    faq.category = category.trim() || 'General';
  }

  if (status) {
    faq.status = status;
  }

  if (order !== undefined && Number.isFinite(Number(order))) {
    faq.order = Number(order);
  }

  faq.updatedBy = req.admin?.name || 'Admin';
  await faq.save();

  res.json({
    success: true,
    message: 'FAQ updated successfully',
    data: serializeFaq(faq),
  });
}

// PATCH /admin/marketing/faqs/:id/status
async function updateFaqStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!['draft', 'published'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status. Choose draft or published' });
  }

  const faq = await Faq.findOne({ _id: id, isDeleted: false });
  if (!faq) {
    return res.status(404).json({ success: false, message: 'FAQ not found' });
  }

  faq.status = status;
  faq.updatedBy = req.admin?.name || 'Admin';
  await faq.save();

  res.json({
    success: true,
    message: `FAQ is now ${status}`,
    data: serializeFaq(faq),
  });
}

// DELETE /admin/marketing/faqs/:id
async function deleteFaq(req, res) {
  const { id } = req.params;

  const faq = await Faq.findOne({ _id: id, isDeleted: false });
  if (!faq) {
    return res.status(404).json({ success: false, message: 'FAQ not found' });
  }

  faq.isDeleted = true;
  await faq.save();

  res.json({
    success: true,
    message: 'FAQ deleted successfully',
    data: { id: faq._id.toString() },
  });
}

// Public endpoint: GET /faq
async function listPublicFaqs(req, res) {
  const faqs = await Faq.find({ status: 'published', isDeleted: false })
    .sort({ order: 1, createdAt: -1 })
    .lean();

  res.json({ success: true, data: { items: faqs.map(serializeFaq) } });
}

module.exports = {
  listFaqs,
  createFaq,
  updateFaq,
  updateFaqStatus,
  deleteFaq,
  listPublicFaqs,
};
