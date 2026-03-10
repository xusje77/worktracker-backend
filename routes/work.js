const express = require('express');
const router = express.Router();
const workController = require('../controllers/workController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/checkin',       workController.checkIn);
router.post('/checkout',      workController.checkOut);
router.get('/active',         workController.getActiveSession);
router.get('/history',        workController.getHistory);
router.get('/stats',          workController.getStats);
router.patch('/:sessionId',   workController.updateSession);

module.exports = router;