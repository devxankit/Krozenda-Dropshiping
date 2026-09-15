// Seeds two ready-to-use demo vendor accounts (one B2B, one B2C) so the
// seller login screen has real credentials to sign in with instead of a
// fabricated client-side session. Never runs in production — these are
// fixed, publicly-known demo credentials, not a security boundary.
const DEMO_VENDORS = [
  {
    vendorType: 'B2C',
    name: 'Ramesh Sharma',
    email: 'b2c.demo@krozenda.com',
    mobile: '9876500001',
    password: 'Demo@1234',
    gstRegistered: false,
    business: {},
    contactPerson: {},
    address: { addressLine: '12 MG Road', city: 'Pune', state: 'Maharashtra', pincode: '411001', country: 'India' },
  },
  {
    vendorType: 'B2B',
    name: 'Arya Manufacturing',
    email: 'b2b.demo@krozenda.com',
    mobile: '9876500002',
    password: 'Demo@1234',
    gstRegistered: true,
    business: {
      businessName: 'Arya Manufacturing Pvt Ltd',
      businessType: 'private_limited',
      pan: 'AAFCA1234B',
      gstin: '27AAFCA1234B1Z5',
    },
    contactPerson: { name: 'Arya Verma', designation: 'Director', mobile: '9876500003', email: 'arya.verma@krozenda.com' },
    address: { addressLine: '45 Industrial Estate', city: 'Surat', state: 'Gujarat', pincode: '395006', country: 'India' },
  },
];

async function ensureDemoVendors() {
  if (process.env.ENV === 'production') return;

  let Vendor;
  try {
    Vendor = require('../Models/Vendor');
  } catch (err) {
    console.warn('Skipping demo vendor bootstrap: Models/Vendor.js not implemented yet');
    return;
  }

  for (const demo of DEMO_VENDORS) {
    const exists = await Vendor.findOne({ email: demo.email });
    if (exists) continue;

    await Vendor.create({
      ...demo,
      verificationStatus: 'APPROVED',
      isActive: true,
    });
    console.log(`Demo ${demo.vendorType} vendor seeded: ${demo.email}`);
  }
}

module.exports = ensureDemoVendors;
