const { connectDatabase } = require('../config/db');
const mongoose = require('mongoose');
const { executeTemplateReport } = require('../services/customReportEngine');

async function checkExcelExportRows() {
  await connectDatabase();
  const tpl = await mongoose.connection.db.collection('reporttemplates').findOne({ _id: new mongoose.Types.ObjectId('6afd691cfb7fd2bfc4608c30') });
  const res = await executeTemplateReport({ template: tpl, templateId: tpl._id });

  console.log('Template:');
  console.log('  name:', tpl.name);
  console.log('  owner:', tpl.accountOwner || tpl.owner);
  console.log('  fields:', tpl.displayFields || tpl.selectedFields);
  console.log('  dateRange:', tpl.recordDateFrom, 'to', tpl.recordDateTo);

  console.log('\nReturned rows:');
  console.log(res.rows);

  // Let's check Jay Pandya for comparison
  const jayTpls = await mongoose.connection.db.collection('reporttemplates').find({ $or: [{ owner: 'Jay Pandya' }, { accountOwner: 'Jay Pandya' }] }).toArray();
  console.log(`\nFound ${jayTpls.length} templates for Jay Pandya`);
  for (const jt of jayTpls.slice(0, 3)) {
    const jr = await executeTemplateReport({ template: jt, templateId: jt._id });
    console.log(`Jay Template [${jt._id}] "${jt.name}" Date: ${jt.recordDateFrom} to ${jt.recordDateTo} => Rows: ${jr.rows.length}`);
    if (jr.rows.length > 0) {
      console.log('  Sample Jay row:', jr.rows[0]);
    }
  }

  process.exit(0);
}

checkExcelExportRows().catch(e => { console.error(e); process.exit(1); });
