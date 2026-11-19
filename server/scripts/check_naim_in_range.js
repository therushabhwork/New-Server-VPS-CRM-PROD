const { connectDatabase } = require('../config/db');
const mongoose = require('mongoose');

async function checkAllNaimLeadsInRange() {
  await connectDatabase();
  const leads = await mongoose.connection.db.collection('leads').find({}).toArray();

  const from = new Date('2026-07-23T00:00:00.000Z').getTime();
  const to = new Date('2026-10-03T23:59:59.999Z').getTime();

  console.log('Checking all leads for Naim Vhora between 2026-07-23 and 2026-10-03:');

  leads.forEach(l => {
    const owner = l.accountOwner || l.formData?.accountOwner || l.ownerName || l.owner || '';
    const email = l.userEmail || l.createdUserBy || l.accountOwnerEmail;
    const code = l.ownerCode || l.formData?.ownerCode;

    const isNaim = owner.toLowerCase().includes('naim') || String(email).includes('sales1@') || String(code) === '1003';
    if (!isNaim) return;

    const ad = l.accountDate || l.formData?.accountDate;
    const cd = l.createdAt;
    const ud = l.updatedAt;

    const parseDate = (d) => {
      if (!d) return null;
      const t = new Date(d).getTime();
      return isNaN(t) ? null : t;
    };

    const adT = parseDate(ad);
    const cdT = parseDate(cd);
    const udT = parseDate(ud);

    const adInRange = adT && adT >= from && adT <= to;
    const cdInRange = cdT && cdT >= from && cdT <= to;
    const udInRange = udT && udT >= from && udT <= to;

    if (adInRange || cdInRange || udInRange) {
      console.log({
        accNo: l.accountNumber,
        name: l.formData?.accountName || l.name,
        owner: l.formData?.accountOwner || l.accountOwner,
        code,
        email,
        accountDate: ad,
        createdAt: cd,
        updatedAt: ud,
        adInRange,
        cdInRange,
        udInRange
      });
    }
  });

  process.exit(0);
}

checkAllNaimLeadsInRange().catch(e => { console.error(e); process.exit(1); });
