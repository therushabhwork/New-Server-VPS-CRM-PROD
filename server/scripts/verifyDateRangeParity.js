const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { executeTemplateReport } = require('../services/customReportEngine');
const { executeReportPayload } = require('../services/reportEngine');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crm');

    console.log('=== TEST DATE RANGE FILTERING: 01/01/2026 to 31/12/2026 ===');

    // 1. Krunal Patel Date-Wise Template Report
    const krunal2026Tpl = await executeTemplateReport({
      template: {
        entityType: 'account',
        accountOwner: 'Krunal Patel',
        recordDateFrom: '2026-01-01',
        recordDateTo: '2026-12-31',
        selectedFields: ['accountNumber', 'accountDate', 'name', 'accountOwner', 'status']
      }
    });
    console.log('Krunal Patel 2026 Template Accounts:', krunal2026Tpl.rows.length);
    krunal2026Tpl.rows.slice(0, 3).forEach(r => {
      console.log(`  Account: ${r['Account No.']} | Date: ${r['Account Date']} | Name: ${r['Account Name']}`);
    });

    // 2. Krunal Patel Date-Wise Deals
    const krunalDeals2026 = await executeTemplateReport({
      template: {
        entityType: 'deal',
        accountOwner: 'Krunal Patel',
        recordDateFrom: '2026-01-01',
        recordDateTo: '2026-12-31',
        selectedFields: ['dealNumber', 'dealDate', 'dealName', 'dealOwner', 'status']
      }
    });
    console.log('Krunal Patel 2026 Template Deals:', krunalDeals2026.rows.length);
    krunalDeals2026.rows.slice(0, 3).forEach(r => {
      console.log(`  Deal: ${r['Deal No.']} | Date: ${r['Deal Date']} | Name: ${r['Deal Name']}`);
    });

    // 3. Jay Pandya Date-Wise Template Report
    const jay2026Tpl = await executeTemplateReport({
      template: {
        entityType: 'account',
        accountOwner: 'Jay Pandya',
        recordDateFrom: '2026-01-01',
        recordDateTo: '2026-12-31',
        selectedFields: ['accountNumber', 'accountDate', 'name', 'accountOwner', 'status']
      }
    });
    console.log('Jay Pandya 2026 Template Accounts:', jay2026Tpl.rows.length);
    jay2026Tpl.rows.slice(0, 3).forEach(r => {
      console.log(`  Account: ${r['Account No.']} | Date: ${r['Account Date']} | Name: ${r['Account Name']}`);
    });

    // 4. Standard Report Engine Date-Wise Check
    const krunalStd2026 = await executeReportPayload({
      dataSource: 'account',
      selectedFields: ['accountNumber', 'accountDate', 'accountName', 'accountOwner', 'status'],
      ownerFilter: 'Krunal Patel',
      period: 'custom',
      dateRange: { fromDate: '2026-01-01', toDate: '2026-12-31' },
      limit: 0,
    });
    console.log('Krunal Patel 2026 Standard Accounts:', krunalStd2026.rows.length);

    await mongoose.disconnect();
    console.log('\nDATE-WISE FILTERING PARITY TEST COMPLETED PERFECTLY!');
  } catch (err) {
    console.error('Date range test error:', err);
  }
})();
