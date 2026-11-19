const { connectDatabase } = require('../config/db');
const mongoose = require('mongoose');
const { executeTemplateReport } = require('../services/customReportEngine');

async function simulateExcelExport() {
  await connectDatabase();
  const tpl = await mongoose.connection.db.collection('reporttemplates').findOne({ _id: new mongoose.Types.ObjectId('6afd691cfb7fd2bfc4608c30') });
  const res = await executeTemplateReport({ template: tpl, templateId: tpl._id });

  console.log('Template details:');
  console.log('  name:', tpl.name);
  console.log('  selectedFields:', tpl.selectedFields);
  console.log('  displayFields:', tpl.displayFields);
  console.log('  fieldLabels:', res.fieldLabels);

  console.log('\nReturned rows:');
  res.rows.forEach((r, idx) => {
    console.log(`\nRow ${idx + 1}:`);
    res.fieldLabels.forEach(lbl => {
      console.log(`  ${lbl}: "${r[lbl]}"`);
    });
    console.log(`  Account No: "${r['Account No.']}"`);
    console.log(`  Account Owner: "${r['Account Owner'] || r.accountOwner}"`);
  });

  // What does the frontend `columns` and `resolveExportCell` do?
  const selectedFieldKeys = tpl.displayFields || tpl.selectedFields;
  const fieldLabels = res.fieldLabels;
  const columns = fieldLabels.map((lbl, idx) => ({
    key: lbl,
    label: lbl,
    rawKey: selectedFieldKeys[idx] || lbl,
  }));

  console.log('\nFrontend Columns:');
  console.log(columns);

  process.exit(0);
}

simulateExcelExport().catch(e => { console.error(e); process.exit(1); });
