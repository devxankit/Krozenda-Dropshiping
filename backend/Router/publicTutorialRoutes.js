const express = require('express');
const { listPublicTutorials } = require('../Controllers/tutorialController');

const router = express.Router();

router.get('/', listPublicTutorials);

module.exports = router;
