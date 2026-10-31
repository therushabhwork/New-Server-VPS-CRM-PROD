/**
 * Dry-Run & Clean-up Script for Naim Vhora / Vora DATA ONLY in local CRM MongoDB
 * 
 * IMPORTANT:
 * - This script STRICTLY DOES NOT delete or disable the Naim Vhora user login account in `users`.
 * - The user account and login are 100% PROTECTED AND KEPT INTACT.
 * - It inspects and cleans Naim Vhora's CRM data (accounts, deals, quotations, converted deals, leads).
 * 
 * Usage:
 *   Dry run (default - safe simulation, NO data modified):
 *     node server/scripts/dry_run_remove_naim_vhora.js
 * 
 *   Execute data-only deletion (keeps user login 100% intact):
 *     node server/scripts/dry_run_remove_naim_vhora.js --execute
 */

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crm';

const isExecute = process.argv.includes('--execute');

async function run() {
    console.log('================================================================');
    console.log(`MODE: ${isExecute ? '*** LIVE DATA EXECUTION (CLEANING DATA ONLY) ***' : '[DRY RUN] (SIMULATION ONLY - NO DATA MODIFIED)'}`);
    console.log(`Connecting to: ${MONGODB_URI}`);
    console.log('NOTE: User login account in `users` is 100% PROTECTED and will NEVER be removed or disabled.');
    console.log('================================================================\n');

    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;

    // Find all user records matching Naim Vhora / Vora to identify his owner IDs & codes
    const naimUsers = await db.collection('users').find({
        $or: [
            { name: /naim(\s+vh?ora)?/i },
            { username: /naim/i },
            { email: 'sales1@swatiswitchgears.com' },
            { email: /naim/i }
        ]
    }).toArray();

    console.log(`Found ${naimUsers.length} user account(s) matching Naim Vhora / Vora:`);
    const userIds = [];
    const legacyIds = [];
    const ownerCodes = [];

    naimUsers.forEach(u => {
        userIds.push(u._id);
        if (u.legacyId && !legacyIds.includes(u.legacyId)) legacyIds.push(u.legacyId);
        if (u.id && !legacyIds.includes(u.id)) legacyIds.push(u.id);
        if (u.ownerCode && !ownerCodes.includes(String(u.ownerCode))) ownerCodes.push(String(u.ownerCode));
        if (u.employeeId && !ownerCodes.includes(String(u.employeeId))) ownerCodes.push(String(u.employeeId));
        console.log(`  - ID: ${u._id} | Legacy ID: ${u.legacyId || u.id} | OwnerCode: ${u.ownerCode} | Status: ${u.status} | Email: ${u.email}`);
    });
    console.log('----------------------------------------------------------------\n');

    const naimNameRegex = /naim(\s+vh?ora)?/i;

    // Build unified filter for Accounts & Deals
    const dataFilter = {
        $or: [
            { ownerName: naimNameRegex },
            { dealOwner: naimNameRegex },
            { accountOwner: naimNameRegex },
            { quotationOwner: naimNameRegex },
            { sales_person: naimNameRegex },
            { salesPerson: naimNameRegex },
            { owner: naimNameRegex },
            { assignedTo: { $in: legacyIds } },
            { ownerUserId: { $in: legacyIds } },
            { createdBy: { $in: legacyIds } },
            { userId: { $in: legacyIds } },
            { userId: { $in: userIds } },
            { createdBy: { $in: userIds } },
            { assignedTo: { $in: legacyIds.map(String) } },
            { ownerUserId: { $in: legacyIds.map(String) } },
            { ownerCode: { $in: ownerCodes } },
            { "data.ownerName": naimNameRegex },
            { "data.dealOwner": naimNameRegex },
            { "data.accountOwner": naimNameRegex },
            { "data.quotationOwner": naimNameRegex },
            { "data.customerOwner": naimNameRegex },
            { "data.customerOwnerName": naimNameRegex },
            { "data.customerOwnerCode": { $in: ownerCodes } },
            { "data.assignedUserName": naimNameRegex },
            { "data.assignedTo": { $in: legacyIds } },
            { "data.ownerUserId": { $in: legacyIds } }
        ]
    };

    // Find all Naim's deal IDs and account IDs to catch linked quotations
    const naimDeals = await db.collection('deals').find(dataFilter, { projection: { _id: 1, id: 1, dealNumber: 1, dealNo: 1 } }).toArray();
    const naimDealKeys = [];
    naimDeals.forEach(d => {
        if (d._id) naimDealKeys.push(String(d._id));
        if (d.id) naimDealKeys.push(String(d.id));
        if (d.dealNumber) naimDealKeys.push(String(d.dealNumber));
        if (d.dealNo) naimDealKeys.push(String(d.dealNo));
    });

    const naimAccounts = await db.collection('accounts').find(dataFilter, { projection: { _id: 1, id: 1, accountNumber: 1, accountNo: 1 } }).toArray();
    const naimAccountKeys = [];
    naimAccounts.forEach(a => {
        if (a._id) naimAccountKeys.push(String(a._id));
        if (a.id) naimAccountKeys.push(String(a.id));
        if (a.accountNumber) naimAccountKeys.push(String(a.accountNumber));
        if (a.accountNo) naimAccountKeys.push(String(a.accountNo));
    });

    // Comprehensive filter for Quotations
    const allUserIds = legacyIds.concat(userIds).concat(legacyIds.map(String)).concat(userIds.map(String));
    const quotationsFilter = {
        $or: [
            { quotationOwner: naimNameRegex },
            { ownerName: naimNameRegex },
            { owner: naimNameRegex },
            { salesPerson: naimNameRegex },
            { sales_person: naimNameRegex },
            { createdBy: { $in: allUserIds } },
            { userId: { $in: allUserIds } },
            { ownerCode: { $in: ownerCodes } },
            { customerOwnerCode: { $in: ownerCodes } },
            { dealId: { $in: naimDealKeys } },
            { sourceDealId: { $in: naimDealKeys } },
            { customerId: { $in: naimAccountKeys } },
            { selectedAccountId: { $in: naimAccountKeys } },
            { "data.quotationOwner": naimNameRegex },
            { "data.ownerName": naimNameRegex },
            { "data.owner": naimNameRegex },
            { "data.salesPerson": naimNameRegex },
            { "data.sales_person": naimNameRegex },
            { "data.selectedAccountOwner": naimNameRegex },
            { "data.customerOwner": naimNameRegex },
            { "data.customerOwnerName": naimNameRegex },
            { "data.customerOwnerCode": { $in: ownerCodes } },
            { "data.ownerCode": { $in: ownerCodes } },
            { "data.createdBy": { $in: allUserIds } },
            { "data.userId": { $in: allUserIds } },
            { "data.dealId": { $in: naimDealKeys } },
            { "data.sourceDealId": { $in: naimDealKeys } },
            { "data.customerId": { $in: naimAccountKeys } },
            { "data.selectedAccountId": { $in: naimAccountKeys } }
        ]
    };

    // Collections to clean (DATA ONLY - users collection is strictly protected)
    const collectionsToClean = [
        {
            name: 'accounts',
            description: 'Accounts owned by / assigned to Naim Vhora',
            query: dataFilter
        },
        {
            name: 'deals',
            description: 'Deals owned by / assigned to Naim Vhora',
            query: dataFilter
        },
        {
            name: 'quotations',
            description: 'Quotations owned by / created by / linked to Naim Vhora',
            query: quotationsFilter
        },
        {
            name: 'converted_deals',
            description: 'Converted deals for Naim Vhora',
            query: dataFilter
        },
        {
            name: 'leads',
            description: 'Leads owned by / assigned to Naim Vhora',
            query: dataFilter
        }
    ];

    let totalDataCount = 0;
    const summary = [];

    for (const item of collectionsToClean) {
        const col = db.collection(item.name);
        const count = await col.countDocuments(item.query);
        totalDataCount += count;

        // Print sample matching items if count > 0
        if (count > 0) {
            const samples = await col.find(item.query).limit(3).toArray();
            console.log(`[${item.name}] Found ${count} matching records. Samples:`);
            samples.forEach((doc, i) => {
                const identifier = doc.quotationNumber || doc.quoteNumber || doc.dealNumber || doc.dealNo || doc.accountNumber || doc.accountNo || doc._id;
                const title = doc.name || doc.dealName || doc.projectName || doc.clientName || doc.companyName || 'N/A';
                console.log(`   ${i + 1}. ID/Number: ${identifier} | Name/Title: ${title} | Owner: ${doc.ownerName || doc.dealOwner || doc.accountOwner || doc.quotationOwner || 'N/A'}`);
            });
            console.log('');
        }

        summary.push({
            Target: item.name,
            Type: 'DATA ONLY',
            Description: item.description,
            Count: count,
            Action: isExecute ? (count > 0 ? 'DELETED' : 'NO CHANGE') : 'WILL DELETE'
        });

        if (isExecute && count > 0) {
            await col.deleteMany(item.query);
        }
    }

    // User Login Account is ALWAYS kept intact
    const userAction = 'KEPT INTACT (PROTECTED - NOT MODIFIED)';
    summary.push({
        Target: 'users (Login Account)',
        Type: 'AUTH / LOGIN',
        Description: `Naim Vhora user account (${naimUsers.length} user record) - ALWAYS KEPT`,
        Count: naimUsers.length,
        Action: userAction
    });

    console.log('\n--- DATA CLEANUP SUMMARY ---');
    console.table(summary);
    console.log(`Total CRM Data Records Identified: ${totalDataCount}`);
    console.log(`User Login Status: ${userAction}`);

    if (!isExecute) {
        console.log('\n>>> DRY RUN FINISHED: NO DATA OR LOGIN WAS MODIFIED. <<<');
        console.log('To execute this data-only clean-up (user login remains 100% intact), run:');
        console.log('  node server/scripts/dry_run_remove_naim_vhora.js --execute');
    } else {
        console.log('\n>>> LIVE EXECUTION FINISHED: Data cleaned up successfully. User login was kept 100% intact. <<<');
    }

    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Execution error:', err);
    process.exit(1);
});
