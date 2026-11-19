const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/crm');
  const db = mongoose.connection.db;

  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  console.log(`Starting Safe Backup & Deletion for Naim Vhora at ${timestamp}...`);

  // Target query for Naim Vhora records
  const naimQuery = {
    $or: [
      { owner: /Naim Vhora/i },
      { accountOwner: /Naim Vhora/i },
      { dealOwner: /Naim Vhora/i },
      { quotationOwner: /Naim Vhora/i },
      { ownerName: /Naim Vhora/i },
      { userEmail: 'sales1@swatiswitchgears.com' },
      { ownerEmail: 'sales1@swatiswitchgears.com' },
      { accountOwnerEmail: 'sales1@swatiswitchgears.com' },
      { 'formData.accountOwner': /Naim Vhora/i },
      { 'formData.ownerName': /Naim Vhora/i },
      { ownerCode: 1003 },
      { ownerCode: '1003' }
    ]
  };

  // 1. BACKUP & DELETE FROM LEADS
  const leadsCol = db.collection('leads');
  const naimLeads = await leadsCol.find(naimQuery).toArray();
  const leadsBackupPath = path.join(backupDir, `naim_vhora_leads_backup_${timestamp}.json`);
  fs.writeFileSync(leadsBackupPath, JSON.stringify(naimLeads, null, 2), 'utf-8');
  console.log(`✅ Backed up ${naimLeads.length} leads to ${leadsBackupPath}`);

  const deleteLeadsRes = await leadsCol.deleteMany(naimQuery);
  console.log(`🗑️ Deleted ${deleteLeadsRes.deletedCount} leads for Naim Vhora.`);

  // 2. BACKUP & DELETE FROM CUSTOMERS
  const customersCol = db.collection('customers');
  const naimCustomers = await customersCol.find(naimQuery).toArray();
  const customersBackupPath = path.join(backupDir, `naim_vhora_customers_backup_${timestamp}.json`);
  fs.writeFileSync(customersBackupPath, JSON.stringify(naimCustomers, null, 2), 'utf-8');
  console.log(`✅ Backed up ${naimCustomers.length} customers to ${customersBackupPath}`);

  const deleteCustomersRes = await customersCol.deleteMany(naimQuery);
  console.log(`🗑️ Deleted ${deleteCustomersRes.deletedCount} customers for Naim Vhora.`);

  // 3. BACKUP & DELETE FROM REPORTTEMPLATES
  const tplCol = db.collection('reporttemplates');
  const naimTpls = await tplCol.find({
    $or: [
      { owner: /Naim Vhora/i },
      { accountOwner: /Naim Vhora/i },
      { name: /naim/i },
      { reportName: /naim/i },
      { ownerEmail: 'sales1@swatiswitchgears.com' },
      { accountOwnerEmail: 'sales1@swatiswitchgears.com' }
    ]
  }).toArray();
  const tplBackupPath = path.join(backupDir, `naim_vhora_templates_backup_${timestamp}.json`);
  fs.writeFileSync(tplBackupPath, JSON.stringify(naimTpls, null, 2), 'utf-8');
  console.log(`✅ Backed up ${naimTpls.length} templates to ${tplBackupPath}`);

  const deleteTplRes = await tplCol.deleteMany({
    $or: [
      { owner: /Naim Vhora/i },
      { accountOwner: /Naim Vhora/i },
      { name: /naim/i },
      { reportName: /naim/i },
      { ownerEmail: 'sales1@swatiswitchgears.com' },
      { accountOwnerEmail: 'sales1@swatiswitchgears.com' }
    ]
  });
  console.log(`🗑️ Deleted ${deleteTplRes.deletedCount} report templates for Naim Vhora.`);

  // 4. VERIFICATION OF INTEGRITY FOR ALL OTHER OWNERS
  console.log('\n--- VERIFYING OTHER OWNERS ARE 100% UNTOUCHED ---');
  const jayCount = await leadsCol.countDocuments({
    $or: [{ owner: /Jay Pandya/i }, { accountOwner: /Jay Pandya/i }]
  });
  console.log(`Jay Pandya leads count: ${jayCount} (Must be >= 23)`);

  const krunalCount = await leadsCol.countDocuments({
    $or: [{ owner: /Krunal Patel/i }, { accountOwner: /Krunal Patel/i }]
  });
  console.log(`Krunal Patel leads count: ${krunalCount} (Must be 114)`);

  const atishCount = await leadsCol.countDocuments({
    $or: [{ owner: /Atish Shah/i }, { accountOwner: /Atish Shah/i }]
  });
  console.log(`Atish Shah leads count: ${atishCount}`);

  const naimRemaining = await leadsCol.countDocuments(naimQuery);
  console.log(`Naim Vhora remaining leads: ${naimRemaining} (Must be 0)`);

  await mongoose.disconnect();
  console.log('\n✅ Safe Backup & Deletion completed successfully!');
}

run().catch((err) => {
  console.error('Error executing deletion:', err);
  process.exit(1);
});
