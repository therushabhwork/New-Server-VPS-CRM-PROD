/**
 * Dry-Run & Clean-up Script for Krunal Patel DATA in local CRM MongoDB
 * 
 * IMPORTANT:
 * - By default, this script DOES NOT delete the Krunal Patel user login account in `users`.
 * - It ONLY cleans Krunal Patel's CRM data (leads, accounts, customers, deals, converted deals, reminders).
 * 
 * Usage:
 *   Dry run (default - safe, NO data modified):
 *     node dry_run_remove_krunal.js
 * 
 *   Execute data-only deletion (keeps user login intact):
 *     node dry_run_remove_krunal.js --execute
 * 
 *   Optional: Also disable user login so Krunal cannot log in (without deleting user):
 *     node dry_run_remove_krunal.js --execute --disable-login
 * 
 *   Optional: Permanently delete user login account too:
 *     node dry_run_remove_krunal.js --execute --delete-user
 */

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crm';

const isExecute = process.argv.includes('--execute');
const shouldDisableLogin = process.argv.includes('--disable-login');
const shouldDeleteUser = process.argv.includes('--delete-user');

async function run() {
    console.log('================================================================');
    console.log(`MODE: ${isExecute ? '*** LIVE EXECUTION (DELETING DATA) ***' : '[DRY RUN] (SIMULATION ONLY - NO DATA MODIFIED)'}`);
    console.log(`Connecting to: ${MONGODB_URI}`);
    console.log('================================================================\n');

    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;

    // Find all user records matching Krunal Patel
    const krunalUsers = await db.collection('users').find({
        $or: [
            { name: /krunal(\s+patel)?/i },
            { username: /krunal/i },
            { email: 'mkt.brd@swatiswitchgears.com' }
        ]
    }).toArray();

    console.log(`Found ${krunalUsers.length} user account(s) matching Krunal Patel:`);
    const userIds = [];
    const legacyIds = [2, 51, 52]; // Known legacyIds for Krunal Patel
    const ownerCodes = ['1002', '1031'];

    krunalUsers.forEach(u => {
        userIds.push(u._id);
        if (u.legacyId && !legacyIds.includes(u.legacyId)) legacyIds.push(u.legacyId);
        if (u.ownerCode && !ownerCodes.includes(String(u.ownerCode))) ownerCodes.push(String(u.ownerCode));
        console.log(`  - ID: ${u._id} | Legacy ID: ${u.legacyId} | OwnerCode: ${u.ownerCode} | Status: ${u.status} | Email: ${u.email}`);
    });
    console.log('----------------------------------------------------------------\n');

    const krunalNameRegex = /krunal(\s+patel)?/i;

    // Build unified filter for CRM data records
    const dataFilter = {
        $or: [
            { ownerName: krunalNameRegex },
            { dealOwner: krunalNameRegex },
            { accountOwner: krunalNameRegex },
            { sales_person: krunalNameRegex },
            { assignedTo: { $in: legacyIds } },
            { ownerUserId: { $in: legacyIds } },
            { createdBy: { $in: legacyIds } },
            { assignedTo: { $in: legacyIds.map(String) } },
            { ownerUserId: { $in: legacyIds.map(String) } },
            { ownerCode: { $in: ownerCodes } },
            { "data.ownerName": krunalNameRegex },
            { "data.dealOwner": krunalNameRegex },
            { "data.accountOwner": krunalNameRegex },
            { "data.customerOwner": krunalNameRegex },
            { "data.customerOwnerName": krunalNameRegex },
            { "data.customerOwnerCode": { $in: ownerCodes } },
            { "data.assignedUserName": krunalNameRegex },
            { "data.assignedTo": { $in: legacyIds } },
            { "data.ownerUserId": { $in: legacyIds } }
        ]
    };

    // Collections to clean (DATA ONLY - users collection is excluded by default)
    const collectionsToClean = [
        {
            name: 'leads',
            description: 'Leads owned by / assigned to Krunal Patel',
            query: dataFilter
        },
        {
            name: 'accounts',
            description: 'Accounts owned by / assigned to Krunal Patel',
            query: dataFilter
        },
        {
            name: 'customers',
            description: 'Customer records for Krunal Patel',
            query: dataFilter
        },
        {
            name: 'deals',
            description: 'Deals owned by / assigned to Krunal Patel',
            query: dataFilter
        },
        {
            name: 'converted_deals',
            description: 'Converted deals for Krunal Patel',
            query: dataFilter
        },
        {
            name: 'remark_reminders',
            description: 'Remark reminders for Krunal Patel',
            query: {
                $or: [
                    { assignedTo: { $in: legacyIds } },
                    { ownerUserId: { $in: legacyIds } },
                    { createdBy: { $in: legacyIds } }
                ]
            }
        }
    ];

    let totalDataCount = 0;
    const summary = [];

    for (const item of collectionsToClean) {
        const col = db.collection(item.name);
        const count = await col.countDocuments(item.query);
        totalDataCount += count;

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

    // Handle Login Account & Sessions
    let userAction = 'KEPT INTACT (LOGIN PRESERVED)';
    if (shouldDeleteUser) {
        userAction = isExecute ? 'USER ACCOUNT DELETED' : 'WILL DELETE USER ACCOUNT';
        if (isExecute) {
            await db.collection('users').deleteMany({ _id: { $in: userIds } });
            await db.collection('user_sessions').deleteMany({
                $or: [
                    { userId: { $in: userIds } },
                    { userId: { $in: legacyIds } },
                    { ownerCode: { $in: ownerCodes } }
                ]
            });
            await db.collection('remembered_devices').deleteMany({
                $or: [
                    { userId: { $in: legacyIds.map(String) } },
                    { userEmail: 'mkt.brd@swatiswitchgears.com' }
                ]
            });
        }
    } else if (shouldDisableLogin) {
        userAction = isExecute ? 'LOGIN DISABLED (BLOCKED)' : 'WILL DISABLE LOGIN (BLOCK)';
        if (isExecute) {
            await db.collection('users').updateMany(
                { _id: { $in: userIds } },
                {
                    $set: {
                        status: 'disabled',
                        isApproved: false,
                        isOnline: false,
                        refreshSessions: []
                    }
                }
            );
            await db.collection('user_sessions').deleteMany({
                $or: [
                    { userId: { $in: userIds } },
                    { userId: { $in: legacyIds } },
                    { ownerCode: { $in: ownerCodes } }
                ]
            });
            await db.collection('remembered_devices').deleteMany({
                $or: [
                    { userId: { $in: legacyIds.map(String) } },
                    { userEmail: 'mkt.brd@swatiswitchgears.com' }
                ]
            });
        }
    }

    summary.push({
        Target: 'users (Login Account)',
        Type: 'AUTH / LOGIN',
        Description: `Krunal Patel user account (${krunalUsers.length} user record)`,
        Count: krunalUsers.length,
        Action: userAction
    });

    console.log('\n--- DATA CLEANUP SUMMARY ---');
    console.table(summary);
    console.log(`Total CRM Data Records Identified: ${totalDataCount}`);
    console.log(`User Login Status: ${userAction}`);

    if (!isExecute) {
        console.log('\n>>> DRY RUN FINISHED: NO DATA OR LOGIN WAS MODIFIED. <<<');
        console.log('To execute this data-only clean-up, run:');
        console.log('  node dry_run_remove_krunal.js --execute');
        console.log('\nIf you also want to block Krunal Patel from logging in:');
        console.log('  node dry_run_remove_krunal.js --execute --disable-login');
    } else {
        console.log('\n>>> LIVE EXECUTION FINISHED: Selected data has been cleaned up successfully. <<<');
    }

    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Execution error:', err);
    process.exit(1);
});