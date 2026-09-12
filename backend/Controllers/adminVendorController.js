const Vendor = require('../Models/Vendor');
const VendorDocument = require('../Models/VendorDocument');
const { serializeVendor } = require('./vendorAuthController');
const { serializeDocument } = require('./vendorDocumentController');

async function listVendors(req, res) {
  const { vendorType, verificationStatus } = req.query;
  const filter = {};
  if (vendorType && ['B2C', 'B2B'].includes(vendorType)) filter.vendorType = vendorType;
  if (verificationStatus) filter.verificationStatus = verificationStatus;

  const vendors = await Vendor.find(filter).sort({ createdAt: -1 }).lean();
  const items = vendors.map((v) => serializeVendor(v));

  const stats = {
    total: items.length,
    pending: items.filter((v) => v.verificationStatus === 'PENDING').length,
    underReview: items.filter((v) => v.verificationStatus === 'UNDER_REVIEW').length,
    approved: items.filter((v) => v.verificationStatus === 'APPROVED').length,
    rejected: items.filter((v) => v.verificationStatus === 'REJECTED').length,
    active: items.filter((v) => v.isActive).length,
  };

  res.json({ success: true, data: { items, stats } });
}

async function getVendor(req, res) {
  const { id } = req.params;

  const vendor = await Vendor.findById(id);
  if (!vendor) {
    return res.status(404).json({ success: false, message: 'Vendor not found' });
  }

  const documents = await VendorDocument.find({ vendorId: id }).sort({ createdAt: -1 }).lean();

  res.json({
    success: true,
    data: {
      vendor: serializeVendor(vendor),
      documents: documents.map(serializeDocument),
    },
  });
}

// PENDING/REJECTED -> UNDER_REVIEW happens on the vendor's own side
// (submitForVerification). From here admins move UNDER_REVIEW -> APPROVED
// (which also flips isActive on, so the vendor goes live immediately) or
// UNDER_REVIEW -> REJECTED (with a reason so the vendor knows what to fix).
async function updateVendorStatus(req, res) {
  const { id } = req.params;
  const { verificationStatus, rejectionReason } = req.body;

  const allowed = ['UNDER_REVIEW', 'APPROVED', 'REJECTED'];
  if (!verificationStatus || !allowed.includes(verificationStatus)) {
    return res.status(400).json({ success: false, message: `verificationStatus must be one of ${allowed.join(', ')}` });
  }

  if (verificationStatus === 'REJECTED' && !rejectionReason?.trim()) {
    return res.status(400).json({ success: false, message: 'rejectionReason is required when rejecting a vendor' });
  }

  const vendor = await Vendor.findById(id);
  if (!vendor) {
    return res.status(404).json({ success: false, message: 'Vendor not found' });
  }

  vendor.verificationStatus = verificationStatus;
  vendor.rejectionReason = verificationStatus === 'REJECTED' ? rejectionReason.trim() : '';
  if (verificationStatus === 'APPROVED') {
    vendor.isActive = true;
  }
  if (verificationStatus === 'REJECTED') {
    vendor.isActive = false;
  }

  await vendor.save();

  res.json({
    success: true,
    message: `Vendor marked ${verificationStatus.toLowerCase().replace('_', ' ')}`,
    data: { vendor: serializeVendor(vendor) },
  });
}

// Independent of the verification pipeline — suspends/reactivates a vendor
// that has already been approved, without touching verificationStatus.
async function toggleVendorActive(req, res) {
  const { id } = req.params;
  const { isActive } = req.body;

  if (isActive === undefined) {
    return res.status(400).json({ success: false, message: 'isActive is required' });
  }

  const vendor = await Vendor.findById(id);
  if (!vendor) {
    return res.status(404).json({ success: false, message: 'Vendor not found' });
  }

  if (vendor.verificationStatus !== 'APPROVED' && (isActive === true || isActive === 'true')) {
    return res.status(400).json({ success: false, message: 'Only approved vendors can be activated' });
  }

  vendor.isActive = isActive === true || isActive === 'true';
  await vendor.save();

  res.json({
    success: true,
    message: `Vendor ${vendor.isActive ? 'activated' : 'deactivated'}`,
    data: { vendor: serializeVendor(vendor) },
  });
}

async function reviewVendorDocument(req, res) {
  const { vendorId, documentId } = req.params;
  const { status, rejectionReason } = req.body;

  const allowed = ['APPROVED', 'REJECTED'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ success: false, message: `status must be one of ${allowed.join(', ')}` });
  }

  if (status === 'REJECTED' && !rejectionReason?.trim()) {
    return res.status(400).json({ success: false, message: 'rejectionReason is required when rejecting a document' });
  }

  const doc = await VendorDocument.findOne({ _id: documentId, vendorId });
  if (!doc) {
    return res.status(404).json({ success: false, message: 'Document not found' });
  }

  doc.status = status;
  doc.rejectionReason = status === 'REJECTED' ? rejectionReason.trim() : '';
  doc.verifiedBy = req.admin._id;
  doc.verifiedAt = new Date();
  await doc.save();

  res.json({
    success: true,
    message: `Document ${status.toLowerCase()}`,
    data: serializeDocument(doc),
  });
}

module.exports = { listVendors, getVendor, updateVendorStatus, toggleVendorActive, reviewVendorDocument };
