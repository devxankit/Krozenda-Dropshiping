const express = require('express');
const {
  listAddresses,
  createAddress,
  updateAddress,
  setDefaultAddress,
  removeAddress,
} = require('../Controllers/addressController');
const { protectUser } = require('../Middlewares/userAuthMiddleware');

const router = express.Router();

router.use(protectUser);

router.get('/', listAddresses);
router.post('/', createAddress);
router.put('/:id', updateAddress);
router.patch('/:id/default', setDefaultAddress);
router.delete('/:id', removeAddress);

module.exports = router;
