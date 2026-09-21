const express = require('express');
const {
  listPublicProducts,
  getPublicProduct,
  listRelatedProducts,
} = require('../Controllers/productController');
const { checkProductDelivery } = require('../Controllers/deliveryCheckController');

const router = express.Router();

router.get('/', listPublicProducts);
router.get('/:id', getPublicProduct);
router.get('/:id/related', listRelatedProducts);

// "Do you deliver to my PIN code?" — the only buyer-facing endpoint that can
// reach the carrier, so it carries a tighter limit of its own on top of the
// catalog one, and answers from a 5-minute lane cache wherever it can.
//
// NOTE ON THE PRICE IT RETURNS: these are the CARRIER's rates. Checkout
// currently charges a fixed ladder instead (see checkoutStore.SHIPPING_OPTIONS
// and orderController.ALLOWED_SHIPPING_FEES), so the two will not agree until
// one of them moves.
router.get('/:id/delivery', checkProductDelivery);

module.exports = router;
