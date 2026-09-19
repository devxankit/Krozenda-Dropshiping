const Vendor = require('../Models/Vendor');
const VendorDocument = require('../Models/VendorDocument');
const Category = require('../Models/Category');
const { getImageUrl } = require('../utils/imageHelper');

// The KYC queue is every vendor whose verification is still in the admin's
// hands — PENDING (just submitted) or UNDER_REVIEW (a reviewer picked it up).
// APPROVED/REJECTED are terminal and drop out of the queue; a rejected vendor
// who resubmits goes back to PENDING (see vendor-side submitForVerification),
// which is what brings them back in.
const QUEUE_STATUSES = ['PENDING', 'UNDER_REVIEW'];

const BUSINESS_TYPE_LABELS = {
  proprietorship: 'Proprietorship',
  partnership: 'Partnership',
  llp: 'LLP',
  private_limited: 'Private limited',
  public_limited: 'Public limited',
  huf: 'HUF',
  society_trust: 'Society / Trust',
  other: 'Other',
};

function vendorRole(vendor) {
  return vendor.vendorType === 'B2B'
    ? BUSINESS_TYPE_LABELS[vendor.business?.businessType] || 'Business seller'
    : 'Individual seller';
}

// PENDING/UNDER_REVIEW map onto the two "still open" review states the KYC
// screens understand; APPROVED/REJECTED pass straight through.
function toReviewStatus(verificationStatus) {
  if (verificationStatus === 'PENDING') return 'submitted';
  if (verificationStatus === 'UNDER_REVIEW') return 'reviewing';
  if (verificationStatus === 'APPROVED') return 'approved';
  if (verificationStatus === 'REJECTED') return 'rejected';
  return 'submitted';
}

function toDocReviewStatus(status) {
  if (status === 'APPROVED') return 'approved';
  if (status === 'REJECTED') return 'rejected';
  return 'reviewing';
}

function daysSince(date) {
  return Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)));
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fileNameFromUrl(url) {
  if (!url) return null;
  const clean = url.split('?')[0];
  return clean.substring(clean.lastIndexOf('/') + 1) || null;
}

// GET /admin/kyc — the review queue. Tab filtering (new/reviewing/changes/
// overdue) happens client-side against this one list, same as every other
// ListScreen in the panel.
async function listKycQueue(req, res) {
  const vendors = await Vendor.find({ verificationStatus: { $in: QUEUE_STATUSES } })
    .sort({ createdAt: 1 })
    .lean();

  const vendorIds = vendors.map((v) => v._id);
  const documents = await VendorDocument.find({ vendorId: { $in: vendorIds } }).lean();
  const docsByVendor = new Map();
  for (const doc of documents) {
    const key = doc.vendorId.toString();
    if (!docsByVendor.has(key)) docsByVendor.set(key, []);
    docsByVendor.get(key).push(doc);
  }

  const items = vendors.map((vendor) => {
    const docs = docsByVendor.get(vendor._id.toString()) || [];
    return {
      id: vendor._id.toString(),
      vendorName: vendor.business?.businessName || vendor.name,
      role: vendorRole(vendor),
      submittedAt: formatDate(vendor.createdAt),
      waitingDays: daysSince(vendor.createdAt),
      documentsApproved: docs.filter((d) => d.status === 'APPROVED').length,
      documentsRequired: docs.length,
      status: toReviewStatus(vendor.verificationStatus),
    };
  });

  const tabCounts = {
    all: items.length,
    new: items.filter((i) => i.status === 'submitted').length,
    reviewing: items.filter((i) => i.status === 'reviewing').length,
    changes: 0,
    overdue: items.filter((i) => i.waitingDays > 3).length,
  };

  res.json({
    success: true,
    data: { items, page: 1, rowsPerPage: items.length || 25, totalItems: items.length, totalPages: 1, tabCounts },
  });
}

// GET /admin/kyc/:vendorId — full application: declared business/bank
// details plus every document a reviewer needs to open and check by eye (no
// third-party API validates PAN/GST/Aadhaar/FSSAI on this platform).
async function getKycApplication(req, res) {
  const { vendorId } = req.params;

  const vendor = await Vendor.findById(vendorId).populate('category', 'name').lean();
  if (!vendor) {
    return res.status(404).json({ success: false, message: 'Vendor not found' });
  }

  const documents = await VendorDocument.find({ vendorId }).sort({ createdAt: 1 }).lean();

  res.json({
    success: true,
    data: {
      id: vendor._id.toString(),
      vendorId: vendor._id.toString(),
      vendorName: vendor.business?.businessName || vendor.name,
      role: vendorRole(vendor),
      model: vendor.vendorType === 'B2B' ? 'Business seller' : 'Individual seller',
      submittedAt: formatDate(vendor.createdAt),
      waitingDays: daysSince(vendor.createdAt),
      status: toReviewStatus(vendor.verificationStatus),
      business: {
        constitution: BUSINESS_TYPE_LABELS[vendor.business?.businessType] || '—',
        pan: vendor.business?.pan || '—',
        gstin: vendor.business?.gstin || '—',
        categories: vendor.category ? [vendor.category.name] : [],
        pickupPincode: vendor.address?.pincode || '—',
        contactName: vendor.contactPerson?.name || vendor.name,
        contactPhone: vendor.contactPerson?.mobile || vendor.mobile,
      },
      payout: {
        bank: vendor.bank?.bankName || 'Not provided',
        accountMasked: vendor.bank?.accountNumber
          ? `XXXX XXXX ${vendor.bank.accountNumber.slice(-4)}`
          : '—',
        ifsc: vendor.bank?.ifsc || '—',
        routeLinked: vendor.verificationStatus === 'APPROVED',
      },
      documents: documents.map((doc) => ({
        id: doc._id.toString(),
        type: doc.documentLabel || doc.documentType,
        fileName: fileNameFromUrl(doc.documentUrl),
        fileSize: null,
        uploadedAt: formatDate(doc.createdAt),
        status: toDocReviewStatus(doc.status),
        required: true,
        rejectionReason: doc.rejectionReason || null,
        url: getImageUrl(doc.documentUrl),
      })),
      // No policy-acceptance ledger exists on the Vendor model yet — the
      // agreement checkbox at sign-up isn't stored per-version anywhere. An
      // empty list renders the section honestly empty rather than inventing
      // acceptances that never happened.
      policyAcceptances: [],
    },
  });
}

module.exports = { listKycQueue, getKycApplication };
