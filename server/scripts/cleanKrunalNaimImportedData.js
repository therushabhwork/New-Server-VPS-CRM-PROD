/**
 * Standalone Cleanup Utility for Excel-Imported Accounts and Deals
 * Target Owners: Krunal Patel & Naim Vhora
 * 
 * IMPORTANT SAFETY RULES:
 * 1. USER LOGIN ACCOUNTS in `users` are 100% PROTECTED and will NEVER be touched or modified.
 * 2. ONLY EXCEL-IMPORTED data is targeted. Manually entered CRM data is 100% preserved.
 * 3. By default (or with `--dry-run`), this script runs in SIMULATION MODE (zero database modifications).
 * 4. With `--execute`, an automatic timestamped JSON backup of all target documents is saved
 *    to `server/scripts/backups/` BEFORE any deletion occurs.
 * 
 * Usage:
 *   Dry-Run Simulation (Default - Safe inspection):
 *     node server/scripts/cleanKrunalNaimImportedData.js --dry-run
 * 
 *   Live Execution (Creates automated backup first, then deletes imported records):
 *     node server/scripts/cleanKrunalNaimImportedData.js --execute
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

// Known Identifier Registry for Krunal Patel and Naim Vhora
const TARGET_PROFILES = [
  {
    canonicalName: 'Krunal Patel',
    nameRegex: /krunal(\s+patel)?/i,
    emailKeywords: ['mkt.brd@swatiswitchgears.com', 'krunal'],
    knownLegacyIds: [2, 51, 52],
    knownOwnerCodes: ['1002', '1031']
  },
  {
    canonicalName: 'Naim Vhora',
    nameRegex: /naim(\s+vh?ora)?/i,
    emailKeywords: ['sales1@swatiswitchgears.com', 'naim'],
    knownLegacyIds: [3, 1003],
    knownOwnerCodes: ['1003', '1029']
  }
];

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
        { 'data.isExcelImport': true },
        { 'data.imported': true },
        { 'data.isImported': true },
        { 'data.source': 'excel' },
        { 'data.source': 'MARKETING-SWATI' },
        { 'formData.isExcelImport': true },
        { 'formData.imported': true },
        { 'formData.isImported': true }
      ]
    }
  ]
};

// Target Collections for Accounts and Deals
const TARGET_COLLECTIONS = [
  { name: 'accounts', label: 'Accounts', module: 'Accounts' },
  { name: 'leads', label: 'Leads (Legacy Accounts)', module: 'Accounts' },
  { name: 'deals', label: 'Deals', module: 'Deals' },
  { name: 'converted_deals', label: 'Converted Deals', module: 'Deals' }
];

async function runCleanup() {
  console.log('================================================================');
  console.log(' SWATI SWITCHGEARS CRM - DATA CLEANUP UTILITY');
  console.log(` TARGET OWNERS : Krunal Patel & Naim Vhora`);
  console.log(` TARGET MODULES: Accounts & Deals (Excel-Imported Data ONLY)`);
  console.log(` CURRENT MODE  : ${isExecute ? '*** LIVE EXECUTION (WITH AUTO-BACKUP) ***' : '[DRY RUN] (SAFE SIMULATION - READ-ONLY)'}`);
  console.log(' NOTE          : User login accounts in `users` are 100% PROTECTED.');
  console.log('================================================================\n');

  try {
    await connectDatabase();
    const db = mongoose.connection.db;
    console.log('[Database] Connected to MongoDB successfully.\n');

    // 1. Resolve exact user IDs & owner codes from `users` collection
    const resolvedOwners = [];
    const allUserIds = [];
    const allOwnerCodes = [];

    for (const profile of TARGET_PROFILES) {
      const emailOrFilters = profile.emailKeywords.map((kw) => ({ email: new RegExp(kw, 'i') }));
      const userDocs = await db.collection('users').find({
        $or: [
          { name: profile.nameRegex },
          { username: profile.nameRegex },
          ...emailOrFilters
        ]
      }).toArray();

      const userIds = [...profile.knownLegacyIds];
      const ownerCodes = [...profile.knownOwnerCodes];

      userDocs.forEach((u) => {
        userIds.push(u._id);
        if (u.id) userIds.push(u.id);
        if (u.legacyId) userIds.push(u.legacyId);
        if (u.ownerCode && !ownerCodes.includes(String(u.ownerCode))) ownerCodes.push(String(u.ownerCode));
        if (u.employeeId && !ownerCodes.includes(String(u.employeeId))) ownerCodes.push(String(u.employeeId));
        console.log(`[User Match] ${profile.canonicalName} -> ID: ${u._id} | LegacyID: ${u.legacyId || u.id || '-'} | OwnerCode: ${u.ownerCode || '-'} | Email: ${u.email}`);
      });

      // String versions for string-typed fields
      const allIdsForProfile = userIds.concat(userIds.map(String));

      resolvedOwners.push({
        canonicalName: profile.canonicalName,
        nameRegex: profile.nameRegex,
        ids: allIdsForProfile,
        ownerCodes: ownerCodes
      });

      allUserIds.push(...allIdsForProfile);
      allOwnerCodes.push(...ownerCodes);
    }
    console.log('----------------------------------------------------------------\n');

    // 2. Build Ownership Query for Krunal Patel & Naim Vhora
    const buildOwnerQuery = (owner) => ({
      $or: [
        { ownerName: owner.nameRegex },
        { dealOwner: owner.nameRegex },
        { accountOwner: owner.nameRegex },
        { sales_person: owner.nameRegex },
        { salesPerson: owner.nameRegex },
        { owner: owner.nameRegex },
        { selectedAccountOwner: owner.nameRegex },
        { assignedTo: { $in: owner.ids } },
        { ownerUserId: { $in: owner.ids } },
        { createdBy: { $in: owner.ids } },
        { userId: { $in: owner.ids } },
        { ownerCode: { $in: owner.ownerCodes } },
        { accountOwnerCode: { $in: owner.ownerCodes } },
        { 'data.ownerName': owner.nameRegex },
        { 'data.dealOwner': owner.nameRegex },
        { 'data.accountOwner': owner.nameRegex },
        { 'data.selectedAccountOwner': owner.nameRegex },
        { 'data.ownerCode': { $in: owner.ownerCodes } },
        { 'data.assignedUserName': owner.nameRegex },
        { 'data.assignedTo': { $in: owner.ids } },
        { 'data.ownerUserId': { $in: owner.ids } },
        { 'data.createdBy': { $in: owner.ids } },
        { 'data.userId': { $in: owner.ids } },
        { 'formData.accountOwner': owner.nameRegex }
      ]
    });

    const combinedOwnerQuery = {
      $or: resolvedOwners.map(buildOwnerQuery)
    };

    // 3. Scan Collections and Categorize Records
    console.log('--- SCANNING COLLECTIONS FOR ACCOUNTS & DEALS ---');
    const recordsToClean = {};
    const summaryReport = [];
    let grandTotalImported = 0;
    let grandTotalManual = 0;

    for (const colDef of TARGET_COLLECTIONS) {
      const col = db.collection(colDef.name);

      // A. Total records matching target owners
      const allOwnerDocs = await col.find(combinedOwnerQuery).toArray();

      // B. Imported records matching target owners
      const importedDocs = await col.find({
        $and: [
          combinedOwnerQuery,
          IMPORTED_CRITERIA
        ]
      }).toArray();

      const importedCount = importedDocs.length;
      const manualCount = Math.max(0, allOwnerDocs.length - importedCount);

      grandTotalImported += importedCount;
      grandTotalManual += manualCount;
      recordsToClean[colDef.name] = importedDocs;

      // Per-owner breakdown
      const krunalImported = importedDocs.filter((d) => {
        const ownerStr = String(d.ownerName || d.accountOwner || d.dealOwner || d.owner || d.data?.ownerName || '');
        const code = String(d.ownerCode || d.accountOwnerCode || d.data?.ownerCode || '');
        return /krunal/i.test(ownerStr) || ['1002', '1031'].includes(code);
      }).length;

      const naimImported = importedCount - krunalImported;

      summaryReport.push({
        Collection: colDef.name,
        Module: colDef.module,
        'Imported (Targeted)': importedCount,
        'Krunal Patel': krunalImported,
        'Naim Vhora': naimImported,
        'Manual (Preserved)': manualCount,
        Action: isExecute ? (importedCount > 0 ? 'DELETED' : 'NO CHANGE') : 'SIMULATE DELETE'
      });

      if (importedCount > 0) {
        console.log(`[${colDef.name}] Found ${importedCount} imported records (${manualCount} manual preserved). Samples:`);
        importedDocs.slice(0, 3).forEach((doc, idx) => {
          const id = doc._id;
          const name = doc.dealName || doc.accountName || doc.title || doc.name || doc.projectName || 'N/A';
          const owner = doc.ownerName || doc.accountOwner || doc.dealOwner || doc.owner || 'N/A';
          const source = doc.source || doc.importSource || (doc.isExcelImport ? 'excel' : (doc.data?.source || 'imported'));
          console.log(`   ${idx + 1}. ID: ${id} | Name: ${name} | Owner: ${owner} | Source: ${source}`);
        });
        console.log('');
      }
    }

    console.log('--- SUMMARY AUDIT REPORT ---');
    console.table(summaryReport);
    console.log(`Total Excel-Imported Records Target for Deletion: ${grandTotalImported}`);
    console.log(`Total Manual CRM Records Protected (Preserved)    : ${grandTotalManual}`);
    console.log(`User Login Accounts in 'users'                    : 100% PROTECTED & FUNCTIONAL\n`);

    if (grandTotalImported === 0) {
      console.log('>>> No matching imported accounts or deals found to delete. Database is already clean. <<<');
      await mongoose.disconnect();
      return;
    }

    // 4. Execution or Dry Run Completion
    if (isDryRun) {
      console.log('================================================================');
      console.log('>>> DRY RUN COMPLETED SUCCESSFULLY: ZERO RECORDS MODIFIED. <<<');
      console.log('To execute the deletion and permanently clean these imported records');
      console.log('(which automatically creates a full safety backup first), run:');
      console.log('  node server/scripts/cleanKrunalNaimImportedData.js --execute');
      console.log('================================================================');
    } else {
      // Step A: Create Automated Safety Backup
      const backupDir = path.join(__dirname, 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilename = `krunal_naim_imported_backup_${timestamp}.json`;
      const backupPath = path.join(backupDir, backupFilename);

      fs.writeFileSync(backupPath, JSON.stringify(recordsToClean, null, 2), 'utf8');
      const backupStat = fs.statSync(backupPath);
      console.log(`[Backup] Automated safety backup created successfully.`);
      console.log(`[Backup] File: ${backupPath} (${(backupStat.size / 1024).toFixed(2)} KB)\n`);

      if (backupStat.size === 0) {
        throw new Error('Backup file verification failed (size is 0 bytes). Aborting deletion.');
      }

      // Step B: Execute Deletion
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
