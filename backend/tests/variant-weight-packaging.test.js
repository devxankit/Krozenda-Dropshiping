// A chosen variant's own weight drives the parcel weight; a variant without
// one falls back to the parent product's. Pure unit test — settings are passed
// in, so no database is touched.
const mongoose = require('mongoose');
const packaging = require('../utils/packaging');

const settings = {
  defaultPackage: { lengthCm: 10, breadthCm: 10, heightCm: 10, weightKg: 0.5 },
  volumetricDivisor: 5000,
};

const heavyId = new mongoose.Types.ObjectId();
const plainId = new mongoose.Types.ObjectId();
const product = {
  weight: 1,
  dimensions: { lengthCm: 5, breadthCm: 5, heightCm: 5 },
  variants: [
    { _id: heavyId, weight: 2.5 },
    { _id: plainId, weight: null },
  ],
};

describe('suggestPackage with variants', () => {
  it('uses the chosen variant weight', async () => {
    const pkg = await packaging.suggestPackage([{ quantity: 2, product, variantId: heavyId }], { settings });
    expect(pkg.actualWeightKg).toBe(5);
  });

  it('falls back to the product weight when the variant has none', async () => {
    const pkg = await packaging.suggestPackage([{ quantity: 2, product, variantId: String(plainId) }], { settings });
    expect(pkg.actualWeightKg).toBe(2);
  });

  it('uses the product weight when no variant is chosen', async () => {
    const pkg = await packaging.suggestPackage([{ quantity: 1, product }], { settings });
    expect(pkg.actualWeightKg).toBe(1);
  });
});
