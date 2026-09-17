const express = require('express');
const {
  getCart,
  mergeCart,
  addCartItem,
  setCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
} = require('../Controllers/cartController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');

const router = express.Router();

router.use(protectUser);

router.get('/', getCart);
router.post('/merge', mergeCart);
router.post('/items', addCartItem);
router.put('/items/:productId', setCartItem);
router.patch('/items/:productId', updateCartItem);
router.delete('/items/:productId', removeCartItem);
router.delete('/', clearCart);

module.exports = router;
