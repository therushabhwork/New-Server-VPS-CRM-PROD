const dataExportService = require('../services/dataExportService');

const getOwners = async (req, res, next) => {
  try {
    const owners = await dataExportService.getAvailableOwners();
    res.json({
      success: true,
      data: owners,
    });
  } catch (err) {
    next(err);
  }
};

const getPreview = async (req, res, next) => {
  try {
    const { owners, modules, dateRange } = req.body;
    const exportData = await dataExportService.getExportData({
      owners: owners || 'all',
      modules: modules || ['accounts', 'deals', 'customers', 'quotations'],
      dateRange: dateRange || {},
    });

    let totalDealValue = 0;
    (exportData?.deals || []).forEach((d) => {
      const val = parseFloat(String(d['Deal Value'] || '').replace(/[^0-9.-]/g, ''));
      if (!isNaN(val)) totalDealValue += val;
    });

    let totalQuoteValue = 0;
    (exportData?.quotations || []).forEach((q) => {
      const val = parseFloat(String(q['Quotation Total'] || '').replace(/[^0-9.-]/g, ''));
      if (!isNaN(val)) totalQuoteValue += val;
    });

    const accCount = (exportData?.accounts || []).length;
    const dealCount = (exportData?.deals || []).length;
    const custCount = (exportData?.customers || []).length;
    const quotCount = (exportData?.quotations || []).length;

    res.json({
      success: true,
      counts: {
        accounts: accCount,
        deals: dealCount,
        customers: custCount,
        quotations: quotCount,
        total: accCount + dealCount + custCount + quotCount,
      },
      values: {
        dealValue: totalDealValue,
        quotationValue: totalQuoteValue,
      },
      ownerSummary: exportData?.ownerSummary || [],
    });
  } catch (err) {
    next(err);
  }
};

const downloadExport = async (req, res, next) => {
  try {
    const {
      owners = 'all',
      modules = ['accounts', 'deals', 'customers', 'quotations'],
      dateRange = {},
      format = 'xlsx',
    } = req.body;

    const exportData = await dataExportService.getExportData({
      owners,
      modules,
      dateRange,
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    const ownerLabel = (Array.isArray(owners) ? (owners.length === 1 ? owners[0] : 'Selected_Owners') : (owners === 'all' ? 'All_Owners' : String(owners))).replace(/[^a-zA-Z0-9_-]/g, '_');

    if (String(format).toLowerCase() === 'pdf') {
      const pdfBuffer = dataExportService.generatePdfBuffer(exportData, modules, {
        owners,
        dateRange,
      });
      const filename = `CRM_Data_Export_${ownerLabel}_${timestamp}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.end(pdfBuffer);
    }

    if (String(format).toLowerCase() === 'csv') {
      // Pick active module or first module
      const targetModule = modules[0] || 'accounts';
      const csvData = dataExportService.generateCsv(exportData, targetModule);
      const filename = `CRM_${ownerLabel}_${targetModule}_${timestamp}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csvData);
    }

    // Default: Multi-sheet XLSX Workbook with header banner and exact columns
    const buffer = dataExportService.generateWorkbookBuffer(exportData, modules, {
      owners,
      dateRange,
    });
    const filename = `CRM_Data_Export_${ownerLabel}_${timestamp}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getOwners,
  getPreview,
  downloadExport,
};
