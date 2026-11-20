const path = require('path');
const { connectDatabase } = require(path.resolve(__dirname, '../server/config/db'));

async function run() {
  const conn = await connectDatabase();
  const db = conn.db;
  const doc = await db.collection('leads').findOne({
    $or: [
      { 'formData.legacyId': 3033 },
      { 'formData.formData.accountNumber': 'ACC03033' },
      { 'formData.accountNumber': 'ACC03033' },
      { leadId: 3033 },
      { id: 3033 }
    ]
  });
  console.log('3033 document:', doc ? {
    _id: doc._id,
    accountOwner: doc.accountOwner,
    createdBy: doc.createdBy,
    createdByUserName: doc.createdByUserName,
    addedBy: doc.addedBy,
    reassignDate: doc.reassignDate
  } : 'NOT FOUND');
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
