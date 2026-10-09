const express = require('express');
const { listPublicCategories } = require('../Controllers/categoryController');


const { responseCache } = require('../Middlewares/responseCache');

const router = express.Router();


// Same for every visitor and changes only when an admin edits the catalog, so a minute of sharing
// (and coalescing a burst of identical requests) costs nothing and spares the database.
router.get('/', responseCache({ ttlMs: 60000 }), listPublicCategories);

module.exports = router;
