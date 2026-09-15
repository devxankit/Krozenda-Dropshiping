const crypto = require('crypto');
const razorpay = require('../Config/razorpay');
const User = require('../Models/User');
const WalletTransaction = require('../Models/WalletTransaction');
const { createNotification } = require('./notificationController');

function serializeTransaction(t) {
  return {
    id: t._id.toString(),
    type: t.type,
    amount: t.amount,
    balanceAfter: t.balanceAfter,
    source: t.source,
    status: t.status,
    createdAt: t.createdAt,
  };
}

async function getWallet(req, res) {
  const transactions = await WalletTransaction.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50);

  res.json({
    success: true,
    data: {
      balance: req.user.walletBalance || 0,
      transactions: transactions.map(serializeTransaction),
    },
  });
}

// POST /user/wallet/topup/order — creates a Razorpay order for the amount
// the buyer wants to add; the wallet is only credited once the signature is
// verified in verifyTopup below, never at this step.
async function createTopupOrder(req, res) {
  const amount = Number(req.body.amount);

  if (!Number.isFinite(amount) || amount < 10 || amount > 100000) {
    return res.status(400).json({ success: false, message: 'Enter an amount between ₹10 and ₹1,00,000' });
  }

  const order = await razorpay.orders.create({
    amount: Math.round(amount * 100),
    currency: 'INR',
    receipt: `wallet_${req.user._id}_${Date.now()}`,
    notes: { purpose: 'WALLET_TOPUP', userId: req.user._id.toString() },
  });

  res.json({
    success: true,
    data: {
      razorpayOrderId: order.id,
      amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    },
  });
}

// POST /user/wallet/topup/verify — verifies the Razorpay signature the
// checkout widget hands back before trusting the payment actually happened,
// then atomically credits the wallet. Idempotent via the unique
// razorpayPaymentId index on WalletTransaction, so a retried verify call
// (e.g. the client resubmitting after a dropped response) can't double-credit.
async function verifyTopup(req, res) {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ success: false, message: 'Missing payment verification fields' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  if (expectedSignature !== signature) {
    return res.status(400).json({ success: false, message: 'Payment verification failed' });
  }

  // The signature only proves the (orderId, paymentId) pair is genuine — the
  // amount to credit must come from what Razorpay actually captured, never
  // from the client (a client-supplied `amount` here would let someone pay
  // ₹1 and ask to be credited ₹99,999).
  let payment;
  try {
    payment = await razorpay.payments.fetch(paymentId);
  } catch (err) {
    return res.status(400).json({ success: false, message: 'Unable to verify payment with Razorpay' });
  }
  if (!payment || payment.order_id !== orderId || payment.status !== 'captured') {
    return res.status(400).json({ success: false, message: 'Payment not captured' });
  }

  const creditAmount = payment.amount / 100;

  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { walletBalance: creditAmount } },
      { new: true }
    );

    const transaction = await WalletTransaction.create({
      user: req.user._id,
      type: 'CREDIT',
      amount: creditAmount,
      balanceAfter: user.walletBalance,
      source: 'TOPUP',
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      status: 'SUCCESS',
    });

    await createNotification({
      userId: req.user._id,
      type: 'WALLET',
      title: 'Wallet Topped Up',
      message: `₹${creditAmount.toLocaleString('en-IN')} has been added to your Krozenda Wallet.`,
      actionType: 'WALLET',
    });

    res.json({
      success: true,
      message: 'Wallet topped up successfully',
      data: { balance: user.walletBalance, transaction: serializeTransaction(transaction) },
    });
  } catch (err) {
    if (err.code === 11000) {
      // Already credited by an earlier call for this exact payment.
      const user = await User.findById(req.user._id);
      return res.json({ success: true, message: 'Wallet already topped up', data: { balance: user.walletBalance } });
    }
    throw err;
  }
}

module.exports = { getWallet, createTopupOrder, verifyTopup };
