// couponController.redeemCoupon/releaseCoupon use mongoose sessions +
// multi-document transactions, which only a replica set (even a single-node
// one) supports — a plain standalone mongod rejects every transaction. This
// mirrors how the real deployment target (MongoDB Atlas, or any properly
// configured production replica set) actually behaves.
module.exports = {
  mongodbMemoryServerOptions: {
    binary: { checkMD5: false },
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  },
};
