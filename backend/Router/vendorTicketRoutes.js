const express = require('express');
const {
  createVendorTicket,
  listVendorTickets,
  getTicketDetails,
  addTicketMessage,
  updateTicketStatus,
  escalateTicket,
} = require('../Controllers/ticketController');
const { protectVendor } = require('../Middlewares/vendorAuthMiddleware');

const router = express.Router();

router.use(protectVendor);

router.get('/', listVendorTickets);
router.post('/', createVendorTicket);
router.get('/:id', getTicketDetails);
router.post('/:id/messages', addTicketMessage);
router.patch('/:id/status', updateTicketStatus);
router.patch('/:id/escalate', escalateTicket);

module.exports = router;
