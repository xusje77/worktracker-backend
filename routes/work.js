const express = require('express');
const router = express.Router();
const workController = require('../controllers/workController');
const timeOffController = require('../controllers/timeOffController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/checkin',             workController.checkIn);
router.post('/checkout',            workController.checkOut);
router.get('/active',               workController.getActiveSession);
router.get('/history',              workController.getHistory);
router.get('/stats',                workController.getStats);
router.patch('/:sessionId',         workController.updateSession);

router.post('/timeoff',             timeOffController.create);
router.get('/timeoff',              timeOffController.getAll);
router.patch('/timeoff/:id/status', timeOffController.updateStatus);
router.delete('/timeoff/:id',       timeOffController.deleteRecord);

module.exports = router;