const express = require('express');
const {
  createTicket,
  listUserTickets,
  getTicketDetails,
  addTicketMessage,
  updateTicketStatus,
} = require('../Controllers/ticketController');
const { optionalUserAuth } = require('../Middlewares/optionalUserAuth');

const router = express.Router();

router.use(optionalUserAuth);

router.get('/', listUserTickets);
router.post('/', createTicket);
router.get('/:id', getTicketDetails);
router.post('/:id/messages', addTicketMessage);
router.patch('/:id/status', updateTicketStatus);

module.exports = router;
