const express = require('express');
const {
  listAdminTickets,
  getTicketDetails,
  addTicketMessage,
  updateTicketStatus,
  assignTicket,
} = require('../Controllers/ticketController');
const { protectAdmin, requirePermission } = require('../Middlewares/authMiddleware');

const router = express.Router();

router.use(protectAdmin);
router.use(requirePermission('admin.people.support'));

router.get('/', listAdminTickets);
router.get('/:id', getTicketDetails);
router.post('/:id/messages', addTicketMessage);
router.patch('/:id/status', updateTicketStatus);
router.patch('/:id/assign', assignTicket);

module.exports = router;
