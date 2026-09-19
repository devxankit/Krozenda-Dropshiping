// Seeds one B2B vendor sitting in the KYC queue (UNDER_REVIEW) with a full
// business/bank profile and a real set of documents (SVG scans under
// uploads/kyc/) so the admin panel's KYC review screen has something real to
// open, read and approve/reject instead of an empty queue. Never runs in
// production — same guard as seedVendors.js.
const DEMO_EMAIL = 'kyc.demo@krozenda.com';

const DEMO_DOCUMENTS = [
  {
    documentType: 'PAN_CARD',
    documentLabel: 'PAN card',
    documentNumber: 'AABCN1234F',
    documentUrl: '/uploads/kyc/pan-card.svg',
    status: 'PENDING',
  },
  {
    documentType: 'GST_CERTIFICATE',
    documentLabel: 'GST registration certificate',
    documentNumber: '29AABCN1234F1Z8',
    documentUrl: '/uploads/kyc/gst-certificate.svg',
    status: 'PENDING',
  },
  {
    documentType: 'AADHAAR',
    documentLabel: 'Aadhaar (authorised signatory)',
    documentNumber: '4821 7734 9012',
    documentUrl: '/uploads/kyc/aadhaar.svg',
    status: 'APPROVED',
  },
  {
    documentType: 'CANCELLED_CHEQUE',
    documentLabel: 'Cancelled cheque',
    documentNumber: '000501234567',
    documentUrl: '/uploads/kyc/cancelled-cheque.svg',
    status: 'PENDING',
  },
  {
    documentType: 'ADDRESS_PROOF',
    documentLabel: 'Address proof — electricity bill',
    documentNumber: '0142 5580 9911',
    documentUrl: '/uploads/kyc/address-proof.svg',
    status: 'PENDING',
  },
];

async function ensureKycDemoVendor() {
  if (process.env.ENV === 'production') return;

  let Vendor, VendorDocument;
  try {
    Vendor = require('../Models/Vendor');
    VendorDocument = require('../Models/VendorDocument');
  } catch (err) {
    console.warn('Skipping KYC demo vendor bootstrap: models not implemented yet');
    return;
  }

  let vendor = await Vendor.findOne({ email: DEMO_EMAIL });
  if (!vendor) {
    vendor = await Vendor.create({
      vendorType: 'B2B',
      name: 'Suresh Nair',
      email: DEMO_EMAIL,
      mobile: '9876500009',
      password: 'Demo@1234',
      gstRegistered: true,
      business: {
        businessName: 'Nairs Home Essentials Pvt Ltd',
        tradeName: 'Nairs Home Essentials',
        businessType: 'private_limited',
        pan: 'AABCN1234F',
        gstin: '29AABCN1234F1Z8',
      },
      contactPerson: {
        name: 'Suresh Nair',
        designation: 'Director',
        mobile: '9876500009',
        email: 'suresh.nair@krozenda.com',
      },
      address: {
        addressLine: '221 Brigade Road, Ashok Nagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
        country: 'India',
      },
      bank: {
        accountHolderName: 'Nairs Home Essentials Pvt Ltd',
        bankName: 'ICICI Bank, Brigade Road',
        accountNumber: '000501234567',
        ifsc: 'ICIC0000123',
      },
      verificationStatus: 'UNDER_REVIEW',
      isActive: false,
    });
    console.log(`KYC demo vendor seeded: ${DEMO_EMAIL}`);
  }

  const existingCount = await VendorDocument.countDocuments({ vendorId: vendor._id });
  if (existingCount === 0) {
    await VendorDocument.insertMany(
      DEMO_DOCUMENTS.map((doc) => ({ ...doc, vendorId: vendor._id })),
    );
    console.log(`KYC demo documents seeded for ${DEMO_EMAIL}: ${DEMO_DOCUMENTS.length} files`);
  }
}

module.exports = ensureKycDemoVendor;
