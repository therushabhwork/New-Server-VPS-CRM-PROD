const express = require('express');
const { requireDataExportAuth } = require('../middleware/dataExportAuth');
const dataExportController = require('../controllers/dataExportController');

const router = express.Router();

// Apply strict 4-user authorization to all endpoints
router.use(requireDataExportAuth);

router.get('/owners', dataExportController.getOwners);
router.post('/preview', dataExportController.getPreview);
router.post('/download', dataExportController.downloadExport);

module.exports = router;
