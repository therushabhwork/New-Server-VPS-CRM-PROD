const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { parseUniversalDate, formatDateDisplay } = require('../utils/universalFieldResolver');
const { executeTemplateReport, generateTemplateExcelBuffer, getUsersLookupMap } = require('../services/customReportEngine');
const { executeReportPayload } = require('../services/reportEngine');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crm');

    console.log('=== TEST 1: Date Parser & Formatter ===');
    const bson1 = { $date: { $numberLong: '1771200000000' } };
    const bson2 = { $date: '2026-02-16T00:00:00.000Z' };
    const strDate = '2026-02-16';
    const dmyDate = '16/02/2026';
    const typoDate = '0026-02-16';

    console.log('BSON $numberLong formatted:', formatDateDisplay(bson1));
    console.log('BSON $date string formatted:', formatDateDisplay(bson2));
    console.log('ISO YYYY-MM-DD formatted:', formatDateDisplay(strDate));
    console.log('DD/MM/YYYY formatted:', formatDateDisplay(dmyDate));
    console.log('Typo 0026-02-16 formatted:', formatDateDisplay(typoDate));

    console.log('\n=== TEST 2: Dynamic User Lookup Map ===');
    const usersMap = await getUsersLookupMap(true);
    console.log('Users map total registered keys:', Object.keys(usersMap).length);
    console.log('Krunal Patel profile in map:', usersMap._profiles?.['krunal patel']?.name, '| Code:', usersMap._codes?.['krunal patel']);
    console.log('Code 1002 mapped to:', usersMap['1002']);
    console.log('Code 1007 mapped to:', usersMap['1007']);
    console.log('Jay Pandya profile in map:', usersMap._profiles?.['jay pandya']?.name, '| Code:', usersMap._codes?.['jay pandya']);
    console.log('Code 1004 mapped to:', usersMap['1004']);
    console.log('Naim Vhora profile in map:', usersMap._profiles?.['naim vhora']?.name, '| Code:', usersMap._codes?.['naim vhora']);
    console.log('Code 1003 mapped to:', usersMap['1003']);

    console.log('\n=== TEST 3: Jay Pandya (Baseline Parity Check) ===');
    const jayTplAcc = await executeTemplateReport({
      template: {
        entityType: 'account',
        accountOwner: 'Jay Pandya',
        selectedFields: ['accountNumber', 'accountDate', 'name', 'accountOwner', 'status'],
      }
    });
    console.log('Jay Pandya Template Accounts:', jayTplAcc.rows.length);

    const jayStdAcc = await executeReportPayload({
      dataSource: 'account',
      selectedFields: ['accountNumber', 'accountDate', 'accountName', 'accountOwner', 'status'],
      ownerFilter: 'Jay Pandya',
      period: 'all',
      limit: 0,
    });
    console.log('Jay Pandya Standard Accounts:', jayStdAcc.rows.length);

    console.log('\n=== TEST 4: Krunal Patel Parity Check ===');
    const krunalTplAcc = await executeTemplateReport({
      template: {
        entityType: 'account',
        accountOwner: 'Krunal Patel',
        selectedFields: ['accountNumber', 'accountDate', 'name', 'accountOwner', 'status'],
      }
    });
    console.log('Krunal Patel Template Accounts:', krunalTplAcc.rows.length);
    if (krunalTplAcc.rows.length > 0) {
      console.log('Krunal Sample Account Date:', krunalTplAcc.rows[0]['Account Date']);
    }

    const krunalStdAcc = await executeReportPayload({
      dataSource: 'account',
      selectedFields: ['accountNumber', 'accountDate', 'accountName', 'accountOwner', 'status'],
      ownerFilter: 'Krunal Patel',
      period: 'all',
      limit: 0,
    });
    console.log('Krunal Patel Standard Accounts (previously was 1!):', krunalStdAcc.rows.length);

    const krunalTplDeals = await executeTemplateReport({
      template: {
        entityType: 'deal',
        accountOwner: 'Krunal Patel',
        selectedFields: ['dealNumber', 'dealName', 'dealDate', 'dealOwner', 'status'],
      }
    });
    console.log('Krunal Patel Template Deals:', krunalTplDeals.rows.length);
    if (krunalTplDeals.rows.length > 0) {
      console.log('Krunal Sample Deal Date:', krunalTplDeals.rows[0]['Deal Date']);
    }

    console.log('\n=== TEST 5: Naim Vhora Parity Check ===');
    const naimTplAcc = await executeTemplateReport({
      template: {
        entityType: 'account',
        accountOwner: 'Naim Vhora',
        selectedFields: ['accountNumber', 'accountDate', 'name', 'accountOwner', 'status'],
      }
    });
    console.log('Naim Vhora Template Accounts:', naimTplAcc.rows.length);

    const naimStdAcc = await executeReportPayload({
      dataSource: 'account',
      selectedFields: ['accountNumber', 'accountDate', 'accountName', 'accountOwner', 'status'],
      ownerFilter: 'Naim Vhora',
      period: 'all',
      limit: 0,
    });
    console.log('Naim Vhora Standard Accounts (previously was 1!):', naimStdAcc.rows.length);

    console.log('\n=== TEST 6: Excel Export Buffer Generation ===');
    const excelRes = generateTemplateExcelBuffer({
      reportTitle: 'Krunal Patel Account Report',
      fieldLabels: krunalTplAcc.fieldLabels,
      rows: krunalTplAcc.rows,
    });
    console.log('Excel Buffer created successfully! Size:', excelRes.buffer.length, 'bytes, FileName:', excelRes.fileName);

    await mongoose.disconnect();
    console.log('\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('Verification error:', err);
  }
})();
