const express = require('express');
const router = express.Router();
const timeOffController = require('../controllers/timeOffController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/',            timeOffController.create);
router.get('/',             timeOffController.getAll);
router.patch('/:id/status', timeOffController.updateStatus);
router.delete('/:id',       timeOffController.deleteRecord);

module.exports = router;