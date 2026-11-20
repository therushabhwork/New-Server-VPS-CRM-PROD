const path = require('path');
const { connectDatabase } = require(path.resolve(__dirname, '../server/config/db'));

async function run() {
  const conn = await connectDatabase();
  const db = conn.db;
  const docs = await db.collection('leads').find({
    $or: [
      { accountOwner: /jay/i },
      { 'formData.accountOwner': /jay/i },
      { 'formData.formData.accountOwner': /jay/i }
    ]
  }).toArray();
  console.log('Total Jay Pandya records in leads:', docs.length);
  docs.forEach(d => {
    console.log(JSON.stringify({
      _id: d._id,
      accNo: d.accountNumber || d.formData?.accountNumber || d.formData?.formData?.accountNumber,
      name: d.name || d.formData?.accountName || d.formData?.customerName,
      projectName: d.projectName || d.formData?.projectName || d.formData?.formData?.projectName,
      accountDate: d.accountDate || d.formData?.accountDate || d.formData?.formData?.accountDate,
      reassignDate: d.reassignDate || d.formData?.reassignDate || d.formData?.formData?.reassignDate,
      createdByUserName: d.createdByUserName || d.formData?.createdByUserName || d.addedBy || d.formData?.addedBy,
      accountOwner: d.accountOwner || d.formData?.accountOwner,
      createdAt: d.createdAt
    }));
  });
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
