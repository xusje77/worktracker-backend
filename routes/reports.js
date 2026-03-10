const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/pdf', reportsController.generatePDF);
router.get('/csv', reportsController.generateCSV);

module.exports = router;