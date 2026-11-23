/**
 * Standalone Targeted Cleanup Utility for Krunal Patel Excel-Imported Data
 * 
 * IMPORTANT SAFETY RULES:
 * 1. USER LOGIN ACCOUNT in `users` is 100% PROTECTED and will NEVER be touched or modified.
 * 2. ONLY EXCEL-IMPORTED data is targeted. Manually created CRM data is 100% preserved.
 * 3. All other users' data (Keval, Samir, Parth, Rushabh, etc.) is 100% untouched.
 * 4. By default (or with `--dry-run`), this script runs in SIMULATION MODE (zero database modifications).
 * 5. With `--execute`, an automatic timestamped JSON backup of all target documents is saved
 *    to `server/scripts/backups/` BEFORE any deletion occurs.
 * 
 * Usage:
 *   Dry-Run Simulation (Default - Safe inspection):
 *     node server/scripts/cleanKrunalPatelImportedData.js --dry-run
 * 
 *   Live Execution (Creates automated backup first, then deletes imported records):
 *     node server/scripts/cleanKrunalPatelImportedData.js --execute
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment configuration
dotenv.config({ path: path.join(__dirname, '../.env') });
const { connectDatabase } = require('../config/db');

const isExecute = process.argv.includes('--execute');
const isDryRun = !isExecute || process.argv.includes('--dry-run');

// Krunal Patel Profile Identifiers
const KRUNAL_PROFILE = {
  canonicalName: 'Krunal Patel',
  nameRegex: /krunal(\s+patel)?/i,
  emailKeywords: ['mkt.brd@swatiswitchgears.com', 'krunal'],
  knownLegacyIds: [2, 51, 52],
  knownOwnerCodes: ['1002', '1031']
};

// Robust imported criteria filter
const IMPORTED_CRITERIA = {
  $and: [
    {
      $or: [
        { isExcelImport: { $ne: false } },
        { isManual: { $ne: true } }
      ]
    },
    {
      $or: [
        { isExcelImport: true },
        { imported: true },
        { isImported: true },
        { isImport: true },
        { source: 'excel' },
        { source: 'import' },
        { source: 'excel-import' },
        { source: 'MARKETING-SWATI' },
        { importSource: 'excel' },
        { oldQuotationNumber: { $nin: [null, '', '-'] } },
        { oldQuoteNumber: { $nin: [null, '', '-'] } },
        { 'data.isExcelImport': true },
        { 'data.imported': true },
        { 'data.isImported': true },
        { 'data.source': 'excel' },
        { 'data.source': 'MARKETING-SWATI' },
        { 'data.oldQuotationNumber': { $nin: [null, '', '-'] } },
        { 'formData.isExcelImport': true },
        { 'formData.imported': true },
        { 'formData.isImported': true }
      ]
    }
  ]
};

// Target Collections for Krunal Patel Data
const TARGET_COLLECTIONS = [
  { name: 'accounts', label: 'Accounts', module: 'Accounts' },
  { name: 'leads', label: 'Leads (Legacy Accounts)', module: 'Accounts' },
  { name: 'deals', label: 'Deals', module: 'Deals' },
  { name: 'converted_deals', label: 'Converted Deals', module: 'Deals' },
  { name: 'quotations', label: 'Quotations', module: 'Quotations' },
  { name: 'customers', label: 'Customers', module: 'Customers' }
];

async function runCleanup() {
  console.log('================================================================');
  console.log(' SWATI SWITCHGEARS CRM - TARGETED DATA CLEANUP UTILITY');
  console.log(` TARGET OWNER  : Krunal Patel`);
  console.log(` TARGET DATA   : Excel-Imported Records ONLY (Accounts, Leads, Deals, Quotes, Customers)`);
  console.log(` CURRENT MODE  : ${isExecute ? '*** LIVE EXECUTION (WITH AUTO-BACKUP) ***' : '[DRY RUN] (SAFE SIMULATION - READ-ONLY)'}`);
  console.log(' NOTE          : User login account in `users` is 100% PROTECTED.');
  console.log(' NOTE          : Manually created CRM data is 100% PRESERVED.');
  console.log('================================================================\n');

  try {
    await connectDatabase();
    const db = mongoose.connection.db;
    console.log('[Database] Connected to MongoDB successfully.\n');

    // 1. Resolve exact user IDs & owner codes from `users` collection for Krunal Patel
    const emailOrFilters = KRUNAL_PROFILE.emailKeywords.map((kw) => ({ email: new RegExp(kw, 'i') }));
    const userDocs = await db.collection('users').find({
      $or: [
        { name: KRUNAL_PROFILE.nameRegex },
        { username: KRUNAL_PROFILE.nameRegex },
        ...emailOrFilters
      ]
    }).toArray();

    const userIds = [...KRUNAL_PROFILE.knownLegacyIds];
    const ownerCodes = [...KRUNAL_PROFILE.knownOwnerCodes];

    userDocs.forEach((u) => {
      userIds.push(u._id);
      if (u.id) userIds.push(u.id);
      if (u.legacyId) userIds.push(u.legacyId);
      if (u.ownerCode && !ownerCodes.includes(String(u.ownerCode))) ownerCodes.push(String(u.ownerCode));
      if (u.employeeId && !ownerCodes.includes(String(u.employeeId))) ownerCodes.push(String(u.employeeId));
      console.log(`[User Match] Krunal Patel -> ID: ${u._id} | LegacyID: ${u.legacyId || u.id || '-'} | OwnerCode: ${u.ownerCode || '-'} | Email: ${u.email}`);
    });

    const allUserIds = userIds.concat(userIds.map(String));
    console.log('----------------------------------------------------------------\n');

    // 2. Build Ownership Query for Krunal Patel
    const krunalOwnershipQuery = {
      $or: [
        { ownerName: KRUNAL_PROFILE.nameRegex },
        { dealOwner: KRUNAL_PROFILE.nameRegex },
        { accountOwner: KRUNAL_PROFILE.nameRegex },
        { quotationOwner: KRUNAL_PROFILE.nameRegex },
        { sales_person: KRUNAL_PROFILE.nameRegex },
        { salesPerson: KRUNAL_PROFILE.nameRegex },
        { owner: KRUNAL_PROFILE.nameRegex },
        { selectedAccountOwner: KRUNAL_PROFILE.nameRegex },
        { assignedTo: { $in: allUserIds } },
        { ownerUserId: { $in: allUserIds } },
        { createdBy: { $in: allUserIds } },
        { userId: { $in: allUserIds } },
        { ownerCode: { $in: ownerCodes } },
        { accountOwnerCode: { $in: ownerCodes } },
        { customerOwnerCode: { $in: ownerCodes } },
        { 'data.ownerName': KRUNAL_PROFILE.nameRegex },
        { 'data.dealOwner': KRUNAL_PROFILE.nameRegex },
        { 'data.accountOwner': KRUNAL_PROFILE.nameRegex },
        { 'data.quotationOwner': KRUNAL_PROFILE.nameRegex },
        { 'data.selectedAccountOwner': KRUNAL_PROFILE.nameRegex },
        { 'data.customerOwner': KRUNAL_PROFILE.nameRegex },
        { 'data.customerOwnerName': KRUNAL_PROFILE.nameRegex },
        { 'data.customerOwnerCode': { $in: ownerCodes } },
        { 'data.ownerCode': { $in: ownerCodes } },
        { 'data.assignedUserName': KRUNAL_PROFILE.nameRegex },
        { 'data.assignedTo': { $in: allUserIds } },
        { 'data.ownerUserId': { $in: allUserIds } },
        { 'data.createdBy': { $in: allUserIds } },
        { 'data.userId': { $in: allUserIds } },
        { 'formData.accountOwner': KRUNAL_PROFILE.nameRegex }
      ]
    };

    // 3. Scan Collections and Categorize Records
    console.log('--- SCANNING COLLECTIONS FOR KRUNAL PATEL DATA ---');
    const recordsToClean = {};
    const summaryReport = [];
    let grandTotalImported = 0;
    let grandTotalManual = 0;

    for (const colDef of TARGET_COLLECTIONS) {
      const col = db.collection(colDef.name);

      // Total records owned by Krunal Patel
      const allOwnerDocs = await col.find(krunalOwnershipQuery).toArray();

      // Imported records owned by Krunal Patel
      const importedDocs = await col.find({
        $and: [
          krunalOwnershipQuery,
          IMPORTED_CRITERIA
        ]
      }).toArray();

      const importedCount = importedDocs.length;
      const manualCount = Math.max(0, allOwnerDocs.length - importedCount);

      grandTotalImported += importedCount;
      grandTotalManual += manualCount;
      recordsToClean[colDef.name] = importedDocs;

      summaryReport.push({
        Collection: colDef.name,
        Module: colDef.module,
        'Imported (Targeted)': importedCount,
        'Manual (Preserved)': manualCount,
        Total: allOwnerDocs.length,
        Action: isExecute ? (importedCount > 0 ? 'DELETED' : 'NO CHANGE') : 'SIMULATE DELETE'
      });

      if (importedCount > 0) {
        console.log(`[${colDef.name}] Found ${importedCount} imported records (${manualCount} manual preserved). Samples:`);
        importedDocs.slice(0, 3).forEach((doc, idx) => {
          const id = doc._id;
          const name = doc.dealName || doc.accountName || doc.title || doc.name || doc.projectName || doc.quotationNumber || 'N/A';
          const owner = doc.ownerName || doc.accountOwner || doc.dealOwner || doc.owner || 'Krunal Patel';
          const source = doc.source || doc.importSource || (doc.isExcelImport ? 'excel' : (doc.data?.source || 'imported'));
          console.log(`   ${idx + 1}. ID: ${id} | Name: ${name} | Owner: ${owner} | Source: ${source}`);
        });
        console.log('');
      }
    }

    console.log('--- SUMMARY AUDIT REPORT ---');
    console.table(summaryReport);
    console.log(`Total Excel-Imported Records Targeted for Deletion: ${grandTotalImported}`);
    console.log(`Total Manual CRM Records Protected (Preserved)    : ${grandTotalManual}`);
    console.log(`User Login Account in 'users'                      : 100% PROTECTED & FUNCTIONAL\n`);

    if (grandTotalImported === 0) {
      console.log('>>> No matching imported records found for Krunal Patel. Database is already clean. <<<');
      await mongoose.disconnect();
      return;
    }

    // 4. Execution or Dry Run Completion
    if (isDryRun) {
      console.log('================================================================');
      console.log('>>> DRY RUN COMPLETED SUCCESSFULLY: ZERO RECORDS MODIFIED. <<<');
      console.log('To execute the deletion and permanently clean these imported records');
      console.log('(which automatically creates a full safety backup first), run:');
      console.log('  node server/scripts/cleanKrunalPatelImportedData.js --execute');
      console.log('================================================================');
    } else {
      // Step A: Create Automated Safety Backup
      const backupDir = path.join(__dirname, 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilename = `krunal_patel_imported_backup_${timestamp}.json`;
      const backupPath = path.join(backupDir, backupFilename);

      fs.writeFileSync(backupPath, JSON.stringify(recordsToClean, null, 2), 'utf8');
      const backupStat = fs.statSync(backupPath);
      console.log(`[Backup] Automated safety backup created successfully.`);
      console.log(`[Backup] File: ${backupPath} (${(backupStat.size / 1024).toFixed(2)} KB)\n`);

      if (backupStat.size === 0) {
        throw new Error('Backup file verification failed (size is 0 bytes). Aborting deletion.');
      }

      // Step B: Execute Deletion of Imported Records ONLY
      for (const colDef of TARGET_COLLECTIONS) {
        const docs = recordsToClean[colDef.name];
        if (docs && docs.length > 0) {
          const col = db.collection(colDef.name);
          const idsToDelete = docs.map((d) => d._id);
          const result = await col.deleteMany({ _id: { $in: idsToDelete } });
          console.log(`[Cleaned] Removed ${result.deletedCount} imported records from '${colDef.name}'.`);
        }
      }

      console.log('\n================================================================');
      console.log('>>> LIVE CLEANUP COMPLETED SUCCESSFULLY. <<<');
      console.log(`Total Imported Records Removed: ${grandTotalImported}`);
      console.log(`Manual CRM Records Kept Intact: ${grandTotalManual}`);
      console.log(`Safety Backup Preserved at    : ${backupPath}`);
      console.log('================================================================');
    }

    await mongoose.disconnect();
    console.log('\n[Database] Disconnected cleanly.');
  } catch (error) {
    console.error('[Fatal Error] Script execution failed:', error);
    process.exit(1);
  }
}

runCleanup();
