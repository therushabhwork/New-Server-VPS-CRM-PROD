const { connectDatabase } = require('../config/db');
const mongoose = require('mongoose');
const { executeTemplateReport } = require('../services/customReportEngine');

async function inspectExactTemplate() {
  await connectDatabase();
  const tpl = await mongoose.connection.db.collection('reporttemplates').findOne({ _id: new mongoose.Types.ObjectId('6afd691cfb7fd2bfc4608c30') });
  console.log('Template 6afd691cfb7fd2bfc4608c30:');
  console.log(JSON.stringify(tpl, null, 2));

  const res = await executeTemplateReport({ template: tpl, templateId: tpl._id });
  console.log(`\nReturned rows count: ${res.rows.length}`);
  console.log('fieldLabels:', res.fieldLabels);
  console.log('selectedFields:', res.selectedFields);
  res.rows.forEach((r, idx) => {
    console.log(`\nRow ${idx + 1}:`);
    res.fieldLabels.forEach(lbl => {
      console.log(`  "${lbl}": "${r[lbl]}"`);
    });
    console.log(`  _id: ${r._id}, raw keys:`, Object.keys(r));
  });

  // Also check the underlying raw documents in leads collection for these 4 accounts!
  const accNos = res.rows.map(r => r['Account No.']).filter(Boolean);
  const rawLeads = await mongoose.connection.db.collection('leads').find({ accountNumber: { $in: accNos } }).toArray();
  console.log(`\nRaw leads in database for these accounts:`);
  rawLeads.forEach(l => {
    console.log({
      accNo: l.accountNumber,
      name: l.formData?.accountName || l.name,
      owner: l.formData?.accountOwner || l.accountOwner,
      accountDate: l.accountDate,
      formAccountDate: l.formData?.accountDate,
      date: l.date,
      formDate: l.formData?.date,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt
    });
  });

  process.exit(0);
}

inspectExactTemplate().catch(e => { console.error(e); process.exit(1); });
