const VendorDocument = require('../Models/VendorDocument');
const { getImageUrl } = require('../utils/imageHelper');

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

  const doc = await VendorDocument.create({
    vendorId: req.vendor._id,
    documentType: documentType.trim(),
    documentLabel: documentLabel ? documentLabel.trim() : '',
    documentNumber: documentNumber ? documentNumber.trim() : '',
    documentUrl: req.file.url,
  });

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

module.exports = { uploadDocument, listMyDocuments, deleteMyDocument, serializeDocument };
