const express = require('express');
const { listLanguages, translateTexts } = require('../Controllers/translateController');

const router = express.Router();

// Public on purpose: the language switcher has to work for a signed-out
// visitor browsing the catalogue, exactly like /catalog/* does. The rate
// limiter is what keeps it from being used as a free translation proxy.
router.get('/languages', listLanguages);
router.post('/', translateTexts);

module.exports = router;
