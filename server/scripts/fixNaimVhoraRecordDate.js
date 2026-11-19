const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.join(__dirname, '../.env') });
const { connectDatabase } = require('../config/db');

async function fixNaimVhoraRecordDate() {
  console.log('--- Starting Migration for Record ACC00017 ---');
  try {
    await connectDatabase();
    const db = mongoose.connection.db;
    const leadsCol = db.collection('leads');

    // 1. Find record ACC00017
    let record = await leadsCol.findOne({
      $or: [
        { _id: new mongoose.Types.ObjectId("6a86a1c31acc3ffa7a6ec042") },
        { _id: "6a86a1c31acc3ffa7a6ec042" },
        { legacyId: 17 },
        { id: 17 },
        { accountNumber: /17$/ },
        { accountNo: /17$/ },
        { accountNumber: 'ACC00017' },
        { accountNo: 'ACC00017' },
        { 'formData.accountNumber': 'ACC00017' },
        { 'formData.accountNo': 'ACC00017' }
      ]
    });

    if (!record) {
      // Find all records that have '0026' in accountDate or formData.accountDate
      record = await leadsCol.findOne({
        $or: [
          { accountDate: /0026/ },
          { 'formData.accountDate': /0026/ }
        ]
      });
    }

    if (!record) {
      console.error('[Error] Could not find record ACC00017 in leads collection!');
      process.exit(1);
    }

    console.log(`Found record ACC00017 (_id: ${record._id})`);
    console.log(`Current accountDate:`, record.accountDate);
    console.log(`Current formData.accountDate:`, record.formData?.accountDate);

    // 2. Save automated backup before modifying
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupFile = path.join(backupDir, `ACC00017_pre_fix_backup_${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(record, null, 2), 'utf8');
    console.log(`[Backup Saved] Backup written to: ${backupFile}`);

    // 3. Migrate date to "2026-02-16" matching Jay Pandya's exact format (YYYY-MM-DD)
    const targetDate = '2026-02-16';
    const updateResult = await leadsCol.updateOne(
      { _id: record._id },
      {
        $set: {
          accountDate: targetDate,
          'formData.accountDate': targetDate,
          updatedAt: new Date()
        }
      }
    );

    console.log(`[Update Result] Modified Count: ${updateResult.modifiedCount}`);

    // 4. Verify the updated document
    const updatedRecord = await leadsCol.findOne({ _id: record._id });
    console.log(`[Verification] New accountDate:`, updatedRecord.accountDate);
    console.log(`[Verification] New formData.accountDate:`, updatedRecord.formData?.accountDate);

    console.log('--- Migration Completed Successfully ---');
    process.exit(0);
  } catch (err) {
    console.error('[Error during migration]:', err);
    process.exit(1);
  }
}

fixNaimVhoraRecordDate();
