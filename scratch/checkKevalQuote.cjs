const path = require('path');
const mongoose = require(path.resolve('./server/node_modules/mongoose'));
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crm';

mongoose.connect(uri).then(async () => {
  const db = mongoose.connection.db;

  // Find all quotations
  const allQuotes = await db.collection('quotations').find({}).toArray();
  console.log(`Total quotations in DB: ${allQuotes.length}`);

  const matches = allQuotes.filter(q => {
    const str = JSON.stringify(q).toLowerCase();
    return str.includes('keval') || str.includes('ssipl') || str.includes('03-11-2026') || str.includes('2026-11-03');
  });

  console.log(`Matching quotes: ${matches.length}`);
  matches.forEach(q => {
    console.log({
      id: q._id.toString(),
      quotationNumber: q.quotationNumber || q.quotationNo || q.data?.quotationNumber,
      date: q.date || q.quotationDate || q.data?.quotationDate || q.data?.customerReference?.date || q.createdAt,
      accountName: q.accountName || q.customerName || q.data?.customerReference?.accountName || q.data?.customerReference?.companyName,
      companyName: q.companyName || q.data?.customerReference?.companyName,
      quotationOwner: q.quotationOwner || q.owner || q.data?.quotationOwner || q.data?.selectedAccountOwner,
      ownerCode: q.ownerCode || q.data?.ownerCode,
      createdBy: q.createdBy || q.data?.createdBy,
      createdAt: q.createdAt
    });
  });

  // Also check recent report templates for Quotation
  const quoteTemplates = await db.collection('reporttemplates').find({
    entityType: { $in: ['quotation', 'Quotation', 'QUOTATION'] }
  }).sort({ _id: -1 }).limit(5).toArray();

  console.log('\nRecent Quotation templates:', quoteTemplates.map(t => ({
    id: t._id.toString(),
    name: t.name || t.reportName,
    accountOwner: t.accountOwner,
    recordDateFrom: t.recordDateFrom,
    recordDateTo: t.recordDateTo,
    selectedFields: t.selectedFields,
    filters: t.filters
  })));

  process.exit(0);
});
