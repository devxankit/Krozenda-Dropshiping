const express = require('express');
const { getWishlist, addWishlistItem, removeWishlistItem } = require('../Controllers/wishlistController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');

const router = express.Router();

router.use(protectUser);

router.get('/', getWishlist);
router.post('/:productId', addWishlistItem);
router.delete('/:productId', removeWishlistItem);

module.exports = router;
