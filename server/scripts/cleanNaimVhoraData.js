/**
 * Data Cleanup Script for Naim Vhora / Vora (Excel Imported Data & CRM Data)
 * 
 * IMPORTANT SAFETY RULES:
 * - The user login account in `users` is 100% PROTECTED and will NEVER be deleted or modified.
 * - By default or with `--dry-run`, this script is in SIMULATION mode. No data is modified.
 * - Before any live execution (`--execute`), a full JSON backup of all target records
 *   is automatically saved to `server/scripts/backups/`.
 * 
 * Usage:
 *   1. Dry Run (Inspect Excel Imported Data only - Default):
 *      node server/scripts/cleanNaimVhoraData.js --dry-run
 * 
 *   2. Dry Run (Inspect ALL Naim Vhora data including manual & imported):
 *      node server/scripts/cleanNaimVhoraData.js --dry-run --all-data
 * 
 *   3. Execute Deletion of Excel Imported Data Only:
 *      node server/scripts/cleanNaimVhoraData.js --execute
 *      (or: node server/scripts/cleanNaimVhoraData.js --execute --imported-only)
 * 
 *   4. Execute Deletion of ALL Naim Vhora CRM Data:
 *      node server/scripts/cleanNaimVhoraData.js --execute --all-data
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, '../.env') });
const { connectDatabase } = require('../config/db');

const isExecute = process.argv.includes('--execute');
const isDryRun = process.argv.includes('--dry-run') || !isExecute;
const isAllData = process.argv.includes('--all-data');
const isImportedOnly = !isAllData;

async function cleanNaimVhoraData() {
  console.log('================================================================');
  console.log(`MODE: ${isDryRun ? '[DRY RUN] (SAFE SIMULATION - NO DATA MODIFIED)' : '*** LIVE DATA EXECUTION ***'}`);
  console.log(`SCOPE: ${isImportedOnly ? 'EXCEL IMPORTED DATA ONLY' : 'ALL CRM DATA (Imported + Manual)'}`);
  console.log('NOTE: User login account in `users` is 100% PROTECTED and will NEVER be removed or disabled.');
  console.log('================================================================\n');

  try {
    await connectDatabase();
    const db = mongoose.connection.db;
    console.log('[Database] MongoDB connected successfully.\n');

    // 1. Identify Naim Vhora / Vora in users collection
    const naimUsers = await db.collection('users').find({
      $or: [
        { name: /naim(\s+vh?ora)?/i },
        { username: /naim/i },
        { email: 'sales1@swatiswitchgears.com' },
        { email: /naim/i }
      ]
    }).toArray();

    if (naimUsers.length === 0) {
      console.error('[Error] No user record found matching Naim Vhora / Vora! Aborting.');
      process.exit(1);
    }

    console.log(`Found ${naimUsers.length} user record(s) matching Naim Vhora / Vora:`);
    const userIds = [];
    const legacyIds = [];
    const ownerCodes = [];

    naimUsers.forEach((u) => {
      userIds.push(u._id);
      if (u.legacyId && !legacyIds.includes(u.legacyId)) legacyIds.push(u.legacyId);
      if (u.id && !legacyIds.includes(u.id)) legacyIds.push(u.id);
      if (u.ownerCode && !ownerCodes.includes(String(u.ownerCode))) ownerCodes.push(String(u.ownerCode));
      if (u.employeeId && !ownerCodes.includes(String(u.employeeId))) ownerCodes.push(String(u.employeeId));
      console.log(`  - Name: ${u.name} | ID: ${u._id} | Legacy ID: ${u.legacyId || u.id} | OwnerCode: ${u.ownerCode} | Email: ${u.email}`);
    });
    console.log('----------------------------------------------------------------\n');

    const naimNameRegex = /naim(\s+vh?ora)?/i;
    const allUserIds = legacyIds.concat(userIds).concat(legacyIds.map(String)).concat(userIds.map(String));

    // Base ownership criteria for Naim Vhora
    const baseOwnershipFilter = {
      $or: [
        { ownerName: naimNameRegex },
        { dealOwner: naimNameRegex },
        { accountOwner: naimNameRegex },
        { quotationOwner: naimNameRegex },
        { sales_person: naimNameRegex },
        { salesPerson: naimNameRegex },
        { owner: naimNameRegex },
        { selectedAccountOwner: naimNameRegex },
        { assignedTo: { $in: allUserIds } },
        { ownerUserId: { $in: allUserIds } },
        { createdBy: { $in: allUserIds } },
        { userId: { $in: allUserIds } },
        { ownerCode: { $in: ownerCodes } },
        { accountOwnerCode: { $in: ownerCodes } },
        { customerOwnerCode: { $in: ownerCodes } },
        { 'data.ownerName': naimNameRegex },
        { 'data.dealOwner': naimNameRegex },
        { 'data.accountOwner': naimNameRegex },
        { 'data.quotationOwner': naimNameRegex },
        { 'data.selectedAccountOwner': naimNameRegex },
        { 'data.customerOwner': naimNameRegex },
        { 'data.customerOwnerName': naimNameRegex },
        { 'data.customerOwnerCode': { $in: ownerCodes } },
        { 'data.ownerCode': { $in: ownerCodes } },
        { 'data.assignedUserName': naimNameRegex },
        { 'data.assignedTo': { $in: allUserIds } },
        { 'data.ownerUserId': { $in: allUserIds } },
        { 'data.createdBy': { $in: allUserIds } },
        { 'data.userId': { $in: allUserIds } },
        { 'formData.accountOwner': naimNameRegex }
      ]
    };

    // Excel import identifier criteria
    const importedCriteria = {
      $and: [
        {
          // Must NOT be explicitly marked as manual non-imported
          $or: [
            { isExcelImport: { $ne: false } },
            { isOldQuotation: { $ne: false } }
          ]
        },
        {
          $or: [
            { isExcelImport: true },
            { isOldQuotation: true },
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
            { 'data.isOldQuotation': true },
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

    // Target query per collection
    const buildCollectionQuery = (isQuotations = false) => {
      if (isImportedOnly) {
        return {
          $and: [
            baseOwnershipFilter,
            importedCriteria
          ]
        };
      }
      return baseOwnershipFilter;
    };

    const targetCollections = [
      { name: 'quotations', description: 'Quotations', isQuotations: true },
      { name: 'accounts', description: 'Accounts', isQuotations: false },
      { name: 'deals', description: 'Deals', isQuotations: false },
      { name: 'leads', description: 'Leads', isQuotations: false },
      { name: 'converted_deals', description: 'Converted Deals', isQuotations: false },
      { name: 'customers', description: 'Customers', isQuotations: false }
    ];

    console.log('--- SCANNING RECORDS ---');
    const recordsToClean = {};
    let totalCount = 0;
    const summary = [];

    for (const colDef of targetCollections) {
      const col = db.collection(colDef.name);
      const query = buildCollectionQuery(colDef.isQuotations);
      const matchingDocs = await col.find(query).toArray();
      const count = matchingDocs.length;
      totalCount += count;
      recordsToClean[colDef.name] = matchingDocs;

      if (count > 0) {
        console.log(`[${colDef.name}] Found ${count} matching ${isImportedOnly ? 'imported' : ''} records. Samples:`);
        matchingDocs.slice(0, 3).forEach((doc, i) => {
          const num = doc.quotationNumber || doc.quoteNumber || doc.oldQuotationNumber || doc.dealNumber || doc.accountNumber || doc._id;
          const name = doc.title || doc.name || doc.dealName || doc.projectName || doc.companyName || doc.customerName || 'N/A';
          const owner = doc.selectedAccountOwner || doc.accountOwner || doc.ownerName || doc.dealOwner || doc.quotationOwner || 'Naim Vora';
          const isImp = Boolean(doc.isExcelImport || doc.isOldQuotation || doc.imported || doc.data?.isExcelImport || doc.data?.isOldQuotation);
          console.log(`   ${i + 1}. Num/ID: ${num} | Title/Name: ${name} | Owner: ${owner} | Imported: ${isImp}`);
        });
        console.log('');
      }

      summary.push({
        Collection: colDef.name,
        Description: colDef.description,
        MatchingCount: count,
        Action: isExecute ? (count > 0 ? 'DELETED' : 'NO CHANGE') : 'WILL DELETE'
      });
    }

    // Always report protected User Login
    summary.push({
      Collection: 'users',
      Description: 'Naim Vora Login Account',
      MatchingCount: naimUsers.length,
      Action: 'PROTECTED (KEPT INTACT)'
    });

    console.log('--- SUMMARY REPORT ---');
    console.table(summary);
    console.log(`Total Target Records: ${totalCount}`);
    console.log(`User Login Account: PROTECTED (100% INTACT - NOT TOUCHED)\n`);

    if (totalCount === 0) {
      console.log('No matching records found to clean.');
      await mongoose.disconnect();
      return;
    }

    if (isDryRun) {
      console.log('================================================================');
      console.log('>>> DRY RUN COMPLETED SUCCESSFULLY: NO DATA WAS REMOVED. <<<');
      console.log('To execute and permanently delete these records (with auto-backup), run:');
      if (isImportedOnly) {
        console.log('  node server/scripts/cleanNaimVhoraData.js --execute');
      } else {
        console.log('  node server/scripts/cleanNaimVhoraData.js --execute --all-data');
      }
      console.log('================================================================');
    } else {
      // 1. Create a timestamped backup before deleting
      const backupDir = path.join(__dirname, 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `naim_vhora_${isImportedOnly ? 'imported_' : ''}backup_${timestamp}.json`);

      fs.writeFileSync(backupPath, JSON.stringify(recordsToClean, null, 2), 'utf8');
      console.log(`[Backup] Complete safety backup saved to: ${backupPath}\n`);

      // 2. Perform deletion
      for (const colDef of targetCollections) {
        const docs = recordsToClean[colDef.name];
        if (docs && docs.length > 0) {
          const col = db.collection(colDef.name);
          const idsToDelete = docs.map((d) => d._id);
          const result = await col.deleteMany({ _id: { $in: idsToDelete } });
          console.log(`[Deleted] Removed ${result.deletedCount} records from ${colDef.name}`);
        }
      }

      console.log('\n================================================================');
      console.log('>>> LIVE CLEANUP COMPLETED SUCCESSFULLY. <<<');
      console.log(`Total Records Cleaned: ${totalCount}`);
      console.log(`User Login Account: 100% INTACT & FUNCTIONAL.`);
      console.log('================================================================');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Fatal execution error:', error);
    process.exit(1);
  }
}

cleanNaimVhoraData();
