const path = require('path');
const { connectDatabase } = require(path.resolve(__dirname, '../server/config/db'));
const mongoose = require(path.resolve(__dirname, '../server/node_modules/mongoose'));

async function run() {
  await connectDatabase();
  const db = mongoose.connection.db;

  console.log('=== Searching in leads (accounts) ===');
  const leads = await db.collection('leads').find({
    $or: [
      { name: /S R ELECTRICAL/i },
      { accountName: /S R ELECTRICAL/i },
      { customerName: /S R ELECTRICAL/i },
      { projectName: /Almebic|Alembic/i },
      { 'projects.projectName': /Almebic|Alembic/i },
    ]
  }).toArray();
  console.log('Leads found:', leads.length);
  leads.forEach(l => {
    console.log({
      _id: l._id,
      name: l.name || l.accountName,
      projectName: l.projectName || l.projects?.[0]?.projectName,
      accountOwner: l.accountOwner,
      accountDate: l.accountDate,
      date: l.date,
      createdAt: l.createdAt,
      status: l.status,
      accountState: l.accountState,
      category: l.accountCategory,
    });
  });

  const cols = await db.listCollections().toArray();
  for (const c of cols) {
    try {
      const count = await db.collection(c.name).countDocuments({
        $or: [
          { name: /S R ELECTRICAL/i },
          { accountName: /S R ELECTRICAL/i },
          { customerName: /S R ELECTRICAL/i },
          { 'data.accountName': /S R ELECTRICAL/i }
        ]
      });
      if (count > 0) console.log('Collection:', c.name, 'Count:', count);
    } catch (_) {}
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
