const express = require('express');
const { listPublicBanners } = require('../Controllers/bannerController');


const router = express.Router();


router.get('/', listPublicBanners);

module.exports = router;
