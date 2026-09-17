const express = require('express');
const {
  listPublicProducts,
  getPublicProduct,
  listRelatedProducts,
} = require('../Controllers/productController');
const { catalogRateLimiter } = require('../Middlewares/rateLimiter');

const router = express.Router();

// Browse/search is unauthenticated and therefore the easiest surface to
// scrape or flood; the limit is loose enough that a filter-heavy shopping
// session never touches it.
router.use(catalogRateLimiter);

router.get('/', listPublicProducts);
router.get('/:id', getPublicProduct);
router.get('/:id/related', listRelatedProducts);

module.exports = router;
