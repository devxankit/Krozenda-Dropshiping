const VendorDocument = require('../Models/VendorDocument');
const Vendor = require('../Models/Vendor');
const { getImageUrl } = require('../utils/imageHelper');
const { FSSAI_DOC_TYPE, getFssaiStatus } = require('../utils/fssai');

function serializeDocument(doc) {
  return {
    id: doc._id.toString(),
    vendorId: doc.vendorId.toString(),
    documentType: doc.documentType,
    documentLabel: doc.documentLabel || '',
    documentNumber: doc.documentNumber || '',
    documentUrl: getImageUrl(doc.documentUrl),
    status: doc.status,
    rejectionReason: doc.rejectionReason || '',
    verifiedAt: doc.verifiedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function uploadDocument(req, res) {
  const { documentType, documentLabel, documentNumber } = req.body;

  if (!documentType || !documentType.trim()) {
    return res.status(400).json({ success: false, message: 'documentType is required' });
  }

  if (!req.file?.url) {
    return res.status(400).json({ success: false, message: 'A file is required' });
  }

  const isFssai = documentType.trim() === FSSAI_DOC_TYPE;
  if (isFssai) {
    if (!documentNumber?.trim()) {
      return res.status(400).json({ success: false, message: 'FSSAI licence number is required' });
    }
    // One licence in review at a time — otherwise admin could approve a stale
    // copy while the seller thinks the newer one is what's being checked.
    const pending = await VendorDocument.exists({ vendorId: req.vendor._id, documentType: FSSAI_DOC_TYPE, status: 'PENDING' });
    if (pending) {
      return res.status(409).json({ success: false, message: 'Your FSSAI licence is already under admin review' });
    }
  }

  const doc = await VendorDocument.create({
    vendorId: req.vendor._id,
    documentType: documentType.trim(),
    documentLabel: documentLabel ? documentLabel.trim() : '',
    documentNumber: documentNumber ? documentNumber.trim() : '',
    documentUrl: req.file.url,
  });

  // Uploading a licence is the seller changing their "do you sell food?"
  // answer to yes, whatever they picked at sign-up.
  if (isFssai && !req.vendor.sellsFood) {
    await Vendor.updateOne({ _id: req.vendor._id }, { $set: { sellsFood: true } });
  }

  res.status(201).json({
    success: true,
    message: 'Document uploaded successfully',
    data: serializeDocument(doc),
  });
}

async function listMyDocuments(req, res) {
  const documents = await VendorDocument.find({ vendorId: req.vendor._id }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: { items: documents.map(serializeDocument) } });
}

async function deleteMyDocument(req, res) {
  const { id } = req.params;

  const doc = await VendorDocument.findOne({ _id: id, vendorId: req.vendor._id });
  if (!doc) {
    return res.status(404).json({ success: false, message: 'Document not found' });
  }

  await doc.deleteOne();

  res.json({ success: true, message: 'Document removed', data: { id } });
}

// GET /vendor/documents/fssai — drives the FSSAI card on Store Profile and
// the warning in the Add Category drawer.
async function getMyFssaiStatus(req, res) {
  const { status, document } = await getFssaiStatus(req.vendor._id);
  res.json({
    success: true,
    data: {
      status,
      sellsFood: req.vendor.sellsFood === true,
      document: document ? serializeDocument(document) : null,
    },
  });
}

module.exports = { uploadDocument, listMyDocuments, deleteMyDocument, getMyFssaiStatus, serializeDocument };
