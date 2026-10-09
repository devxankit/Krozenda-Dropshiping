const Tutorial = require('../Models/Tutorial');

const AUDIENCES = ['seller', 'customer'];

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function serializeTutorial(t) {
  return {
    id: t._id.toString(),
    _id: t._id.toString(),
    title: t.title,
    description: t.description || '',
    audience: t.audience,
    videoUrl: t.videoUrl || '',
    category: t.category || 'General',
    status: t.status || 'published',
    order: t.order ?? 0,
    updatedBy: t.updatedBy || 'Admin',
    updatedAt: formatDate(t.updatedAt),
    createdAt: formatDate(t.createdAt),
  };
}

// Only http(s) links are stored — the apps render this as an iframe/link, so
// a javascript: or data: URL must never get in.
function cleanVideoUrl(value) {
  const url = String(value || '').trim();
  if (!url) return { url: '' };
  if (!/^https?:\/\/\S+$/i.test(url)) return { error: 'Video link must start with http:// or https://' };
  return { url };
}

// GET /admin/marketing/tutorials
async function listTutorials(req, res) {
  const { search, tab, audience } = req.query;
  const filter = { isDeleted: false };

  if (tab === 'published' || tab === 'draft') filter.status = tab;
  if (AUDIENCES.includes(audience)) filter.audience = audience;

  if (search) {
    const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [{ title: regex }, { description: regex }, { category: regex }];
  }

  const items = (await Tutorial.find(filter).sort({ order: 1, createdAt: -1 }).lean()).map(serializeTutorial);

  const all = await Tutorial.find({ isDeleted: false }).select('status').lean();
  const stats = {
    total: all.length,
    published: all.filter((t) => t.status === 'published').length,
    draft: all.filter((t) => t.status === 'draft').length,
  };

  res.json({ success: true, data: { items, stats } });
}

// POST /admin/marketing/tutorials
async function createTutorial(req, res) {
  const { title, description, audience, videoUrl, category, status, order } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ success: false, message: 'Title is required' });
  }
  if (!AUDIENCES.includes(audience)) {
    return res.status(400).json({ success: false, message: 'Choose who this tutorial is for: seller or customer' });
  }
  const video = cleanVideoUrl(videoUrl);
  if (video.error) return res.status(400).json({ success: false, message: video.error });
  if (!video.url && !(description && description.trim())) {
    return res.status(400).json({ success: false, message: 'Add a video link or some text steps' });
  }

  const tutorial = await Tutorial.create({
    title: title.trim(),
    description: (description || '').trim(),
    audience,
    videoUrl: video.url,
    category: category?.trim() || 'General',
    status: status === 'draft' ? 'draft' : 'published',
    order: Number.isFinite(Number(order)) ? Number(order) : 0,
    updatedBy: req.admin?.name || 'Admin',
    createdBy: req.admin?._id || null,
  });

  res.status(201).json({ success: true, message: 'Tutorial added successfully', data: serializeTutorial(tutorial) });
}

// PUT /admin/marketing/tutorials/:id
async function updateTutorial(req, res) {
  const { title, description, audience, videoUrl, category, status, order } = req.body;

  const tutorial = await Tutorial.findOne({ _id: req.params.id, isDeleted: false });
  if (!tutorial) return res.status(404).json({ success: false, message: 'Tutorial not found' });

  if (title !== undefined) {
    if (!title.trim()) return res.status(400).json({ success: false, message: 'Title is required' });
    tutorial.title = title.trim();
  }
  if (description !== undefined) tutorial.description = String(description).trim();
  if (audience !== undefined) {
    if (!AUDIENCES.includes(audience)) {
      return res.status(400).json({ success: false, message: 'Audience must be seller or customer' });
    }
    tutorial.audience = audience;
  }
  if (videoUrl !== undefined) {
    const video = cleanVideoUrl(videoUrl);
    if (video.error) return res.status(400).json({ success: false, message: video.error });
    tutorial.videoUrl = video.url;
  }
  if (!tutorial.videoUrl && !tutorial.description) {
    return res.status(400).json({ success: false, message: 'Add a video link or some text steps' });
  }
  if (category !== undefined) tutorial.category = String(category).trim() || 'General';
  if (status !== undefined) {
    if (!['draft', 'published'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Choose draft or published' });
    }
    tutorial.status = status;
  }
  if (order !== undefined && Number.isFinite(Number(order))) tutorial.order = Number(order);

  tutorial.updatedBy = req.admin?.name || 'Admin';
  await tutorial.save();

  res.json({ success: true, message: 'Tutorial updated successfully', data: serializeTutorial(tutorial) });
}

// PATCH /admin/marketing/tutorials/:id/status
async function updateTutorialStatus(req, res) {
  const { status } = req.body;
  if (!['draft', 'published'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status. Choose draft or published' });
  }

  const tutorial = await Tutorial.findOne({ _id: req.params.id, isDeleted: false });
  if (!tutorial) return res.status(404).json({ success: false, message: 'Tutorial not found' });

  tutorial.status = status;
  tutorial.updatedBy = req.admin?.name || 'Admin';
  await tutorial.save();

  res.json({ success: true, message: `Tutorial is now ${status}`, data: serializeTutorial(tutorial) });
}

// DELETE /admin/marketing/tutorials/:id
async function deleteTutorial(req, res) {
  const tutorial = await Tutorial.findOne({ _id: req.params.id, isDeleted: false });
  if (!tutorial) return res.status(404).json({ success: false, message: 'Tutorial not found' });

  tutorial.isDeleted = true;
  await tutorial.save();

  res.json({ success: true, message: 'Tutorial deleted successfully', data: { id: tutorial._id.toString() } });
}

// Public endpoint: GET /tutorials?audience=seller|customer
async function listPublicTutorials(req, res) {
  const { audience } = req.query;
  if (!AUDIENCES.includes(audience)) {
    return res.status(400).json({ success: false, message: 'audience must be seller or customer' });
  }

  const tutorials = await Tutorial.find({ audience, status: 'published', isDeleted: false })
    .sort({ order: 1, createdAt: -1 })
    .lean();

  res.json({ success: true, data: { items: tutorials.map(serializeTutorial) } });
}

module.exports = {
  listTutorials,
  createTutorial,
  updateTutorial,
  updateTutorialStatus,
  deleteTutorial,
  listPublicTutorials,
};
