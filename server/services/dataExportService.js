const mongoose = require('mongoose');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable').default || require('jspdf-autotable').autoTable || require('jspdf-autotable');
const { getUsersLookupMap, parseDateTimestamp } = require('./customReportEngine');
const { resolveDocumentField } = require('../utils/universalFieldResolver');

let cachedLogoBase64 = null;
function getSwatiLogoBase64() {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const candidatePaths = [
      path.resolve(process.cwd(), 'public/swati-logo.png'),
      path.resolve(__dirname, '../../public/swati-logo.png'),
      path.resolve(process.cwd(), 'src/assets/swati-logo.png'),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        cachedLogoBase64 = `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
        break;
      }
    }
  } catch (err) {
    console.warn('[dataExportService] Logo load warning:', err.message);
  }
  return cachedLogoBase64;
}

const formatDate = (val) => {
  if (!val) return '-';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatDateTime = (val) => {
  if (!val) return '-';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day}/${month}/${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
};

const formatCurrency = (val) => {
  if (val === undefined || val === null || val === '' || val === '-') return '0.00';
  const cleanStr = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleanStr);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseNum = (val) => {
  if (val === undefined || val === null || val === '' || val === '-') return 0;
  const cleanStr = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
};

/**
 * Build unified multi-factor owner maps from users collection and alias registries
 */
async function getOwnerMaps() {
  const db = mongoose.connection.db;
  const users = await db.collection('users').find({}).toArray();

  const nameToCanonical = {};
  const codeToName = {};
  const nameToCode = {};
  const legacyIdToName = {};
  const idToName = {};

  users.forEach((u) => {
    const canonical = String(u.name || u.username || '').trim();
    if (!canonical) return;

    nameToCanonical[canonical.toLowerCase()] = canonical;
    if (u.username) nameToCanonical[String(u.username).trim().toLowerCase()] = canonical;

    const code = String(u.ownerCode || u.owner_code || '').trim();
    if (code) {
      codeToName[code.toLowerCase()] = canonical;
      nameToCode[canonical.toLowerCase()] = code;
      if (u.username) nameToCode[String(u.username).trim().toLowerCase()] = code;
    }

    const legacyId = String(u.legacyId || '').trim();
    if (legacyId) legacyIdToName[legacyId.toLowerCase()] = canonical;

    if (u._id) idToName[String(u._id)] = canonical;
  });

  // Aliases & spelling variations across CRM history
  nameToCanonical['jagurti parmar'] = 'Jagruti Parmar';
  nameToCanonical['jagruti parmar'] = 'Jagruti Parmar';
  nameToCanonical['kanubhai shah'] = 'Kanu Shah';
  nameToCanonical['kanu shah'] = 'Kanu Shah';
  nameToCanonical['monali pateliya'] = 'Monali Pataliya';
  nameToCanonical['monali pataliya'] = 'Monali Pataliya';
  nameToCanonical['sahana prasenjit'] = 'Sahana Prasenjit';
  nameToCanonical['prasenjit sahana'] = 'Prasenjit Sahana';

  // System verified owner codes for canonical owners and aliases
  nameToCode['keval v shah'] = nameToCode['keval v shah'] || '1015';
  nameToCode['naim vhora'] = nameToCode['naim vhora'] || '1003';
  nameToCode['atish shah'] = nameToCode['atish shah'] || '1001';
  nameToCode['krunal patel'] = nameToCode['krunal patel'] || '1002';
  nameToCode['jay pandya'] = nameToCode['jay pandya'] || '1011';
  nameToCode['jagruti parmar'] = nameToCode['jagruti parmar'] || '1013';
  nameToCode['jagurti parmar'] = '1013';
  nameToCode['kanu shah'] = nameToCode['kanu shah'] || '1004';
  nameToCode['kanubhai shah'] = '1004';
  nameToCode['bhavesh prajapati'] = nameToCode['bhavesh prajapati'] || '1008';
  nameToCode['rajeshree parmar'] = nameToCode['rajeshree parmar'] || '1007';
  nameToCode['hasmukh chauhan'] = nameToCode['hasmukh chauhan'] || '1005';
  nameToCode['samir sheth'] = nameToCode['samir sheth'] || '1014';
  nameToCode['nita bhavsar'] = nameToCode['nita bhavsar'] || '1006';
  nameToCode['sahana prasenjit'] = nameToCode['sahana prasenjit'] || '1010';
  nameToCode['prasenjit sahana'] = nameToCode['prasenjit sahana'] || '1010';
  nameToCode['tajamul rafique solkar'] = nameToCode['tajamul rafique solkar'] || '1009';
  nameToCode['monali pataliya'] = nameToCode['monali pataliya'] || '1012';
  nameToCode['monali pateliya'] = '1012';

  return { nameToCanonical, codeToName, nameToCode, legacyIdToName, idToName };
}

/**
 * Universal 2-tier fallback resolver for ownerCode
 */
function resolveOwnerCode(doc, canonicalOwner, maps = {}) {
  const { nameToCode = {} } = maps;
  const directCode = doc.ownerCode || doc.formData?.ownerCode || doc.formData?.formData?.ownerCode || doc.data?.ownerCode;
  if (directCode && String(directCode).trim() && String(directCode).trim() !== '-') {
    return String(directCode).trim();
  }
  if (canonicalOwner && String(canonicalOwner).trim()) {
    const lower = String(canonicalOwner).trim().toLowerCase();
    if (nameToCode[lower]) return nameToCode[lower];
  }
  return '-';
}

/**
 * Fetch all available owners across users collection and existing records
 */
async function getAvailableOwners() {
  const db = mongoose.connection.db;
  const maps = await getOwnerMaps();
  const ownerSet = new Set();

  // 1. From Users collection
  const users = await db.collection('users').find({}).toArray();
  users.forEach((u) => {
    const name = String(u.name || u.username || '').trim();
    if (name) {
      const canonical = maps.nameToCanonical[name.toLowerCase()] || name;
      ownerSet.add(canonical);
    }
  });

  // 2. From Leads (Accounts)
  const leadOwners = await db.collection('leads').distinct('accountOwner');
  leadOwners.forEach((o) => {
    if (o && String(o).trim()) {
      const lower = String(o).trim().toLowerCase();
      if (lower !== 'unassigned') {
        const canonical = maps.nameToCanonical[lower] || maps.codeToName[lower] || maps.legacyIdToName[lower] || String(o).trim();
        ownerSet.add(canonical);
      }
    }
  });

  // 3. From Deals
  const dealOwners = await db.collection('deals').distinct('dealOwner');
  dealOwners.forEach((o) => {
    if (o && String(o).trim()) {
      const lower = String(o).trim().toLowerCase();
      if (lower !== 'unassigned') {
        const canonical = maps.nameToCanonical[lower] || maps.codeToName[lower] || maps.legacyIdToName[lower] || String(o).trim();
        ownerSet.add(canonical);
      }
    }
  });

  // 4. From Quotations
  const quoteOwners = await db.collection('quotations').distinct('quotationOwner');
  quoteOwners.forEach((o) => {
    if (o && String(o).trim()) {
      const lower = String(o).trim().toLowerCase();
      if (lower !== 'unassigned') {
        const canonical = maps.nameToCanonical[lower] || maps.codeToName[lower] || maps.legacyIdToName[lower] || String(o).trim();
        ownerSet.add(canonical);
      }
    }
  });

  // 5. From Customers
  const custOwners = await db.collection('customers').distinct('owner');
  custOwners.forEach((o) => {
    if (o && String(o).trim()) {
      const lower = String(o).trim().toLowerCase();
      if (lower !== 'unassigned') {
        const canonical = maps.nameToCanonical[lower] || maps.codeToName[lower] || maps.legacyIdToName[lower] || String(o).trim();
        ownerSet.add(canonical);
      }
    }
  });

  ownerSet.delete('Unassigned');
  return Array.from(ownerSet).sort((a, b) => a.localeCompare(b));
}

/**
 * Resolve canonical owner name across diverse entity structures and legacy codes
 * Note: Decoupled strictly from createdBy to avoid admin metadata leaks
 */
function resolveOwnerName(doc, entityType, maps = {}) {
  const { nameToCanonical = {}, codeToName = {}, legacyIdToName = {}, idToName = {} } = maps;

  let candidates = [];
  if (entityType === 'account') {
    candidates = [
      doc.accountOwner,
      doc.formData?.accountOwner,
      doc.formData?.formData?.accountOwner,
      doc.ownerName,
      doc.owner,
      doc.assignedTo,
      doc.assignedToName,
    ];
  } else if (entityType === 'deal') {
    candidates = [
      doc.dealOwner,
      doc.data?.dealOwner,
      doc.dealOwnerName,
      doc.ownerName,
      doc.owner,
      doc.assignedTo,
    ];
  } else if (entityType === 'customer') {
    candidates = [
      doc.customerOwner,
      doc.owner,
      doc.assignedTo,
      doc.ownerName,
      doc.assignedToName,
    ];
  } else if (entityType === 'quotation') {
    candidates = [
      doc.quotationOwner,
      doc.data?.quotationOwner,
      doc.owner,
      doc.ownerName,
      doc.assignedTo,
    ];
  }

  for (const c of candidates) {
    if (c !== undefined && c !== null && String(c).trim() !== '') {
      const rawStr = String(c).trim();
      const lower = rawStr.toLowerCase();
      if (lower === 'unassigned') continue;

      // 1. Check if numeric legacyId (e.g. "16", "2", "3", "7" in customers)
      if (legacyIdToName[lower]) return legacyIdToName[lower];

      // 2. Check if ownerCode (e.g. "1015", "1003")
      if (codeToName[lower]) return codeToName[lower];

      // 3. Check if canonical name or alias
      if (nameToCanonical[lower]) return nameToCanonical[lower];

      // 4. Check if MongoDB ObjectId string
      if (idToName[rawStr]) return idToName[rawStr];

      // If it's a non-numeric string name, return it directly
      if (!/^\d+$/.test(rawStr)) {
        return rawStr;
      }
    }
  }

  // Check ownerCode explicitly
  const ownerCode = doc.ownerCode || doc.formData?.ownerCode || doc.formData?.formData?.ownerCode || doc.data?.ownerCode;
  if (ownerCode && String(ownerCode).trim()) {
    const codeKey = String(ownerCode).trim().toLowerCase();
    if (codeToName[codeKey]) return codeToName[codeKey];
  }

  // Check legacyId / userId / ownerUserId explicitly (NOT createdBy!)
  const uid = doc.ownerUserId || doc.assignedTo || doc.userId || doc.data?.userId;
  if (uid && String(uid).trim()) {
    const uidKey = String(uid).trim().toLowerCase();
    if (legacyIdToName[uidKey]) return legacyIdToName[uidKey];
    if (idToName[String(uid).trim()]) return idToName[String(uid).trim()];
  }

  return 'Unassigned';
}

/**
 * Filter documents by owner and date range with universal backwards-compatibility
 * Evaluates strictly against canonical business ownership to guarantee 100% parity
 */
function isDocumentInOwnerScope(doc, selectedOwners = [], maps = {}, entityType = 'account') {
  if (!selectedOwners || selectedOwners.length === 0 || selectedOwners.includes('all')) {
    return true;
  }

  const normalizedTargets = new Set(selectedOwners.map((o) => String(o).trim().toLowerCase()));

  // Resolve canonical owner name and test match
  const canonicalOwner = resolveOwnerName(doc, entityType, maps);
  if (canonicalOwner && normalizedTargets.has(canonicalOwner.toLowerCase())) {
    return true;
  }

  return false;
}

function isDocumentInDateScope(doc, fromTime = null, toTime = null, entityType = 'account') {
  if (fromTime === null && toTime === null) return true;

  let candidates = [];
  if (entityType === 'quotation') {
    const revDates = (Array.isArray(doc.data?.revisions) ? doc.data.revisions : (Array.isArray(doc.revisions) ? doc.revisions : [])).map((r) => r.date).filter(Boolean);
    candidates = [
      ...revDates,
      doc.quotationDate,
      doc.data?.quotationDate,
      doc.data?.customerReference?.date,
      doc.date,
      doc.createdAt,
      doc.updatedAt,
      doc.lastUpdated,
    ];
  } else if (entityType === 'deal') {
    candidates = [
      doc.dealDate,
      doc.data?.dealDate,
      doc.date,
      doc.dateOfDeal,
      doc.createdAt,
      doc.updatedAt,
      doc.lastUpdated,
    ];
  } else if (entityType === 'customer') {
    candidates = [
      doc.createdAt,
      doc.addedDate,
      doc.date,
      doc.updatedAt,
      doc.lastUpdated,
    ];
  } else {
    // account
    candidates = [
      doc.accountDate,
      doc.formData?.accountDate,
      doc.date,
      doc.createdAt,
      doc.updatedAt,
      doc.formData?.updatedAt,
    ];
  }

  return candidates.filter(Boolean).some((rawVal) => {
    const ms = parseDateTimestamp(rawVal);
    if (ms === null) return false;
    if (fromTime !== null && ms < fromTime) return false;
    if (toTime !== null && ms > toTime) return false;
    return true;
  });
}

const ACCOUNTS_COLUMNS = [
  { key: 'Account Number', label: 'Account Number', align: 'center', minWidth: 16 },
  { key: 'Account Name', label: 'Account Name', align: 'left', minWidth: 26 },
  { key: 'Account Date', label: 'Account Date', align: 'center', minWidth: 14 },
  { key: 'Account Category', label: 'Account Category', align: 'center', minWidth: 14 },
  { key: 'Account Owner', label: 'Account Owner', align: 'left', minWidth: 20 },
  { key: 'Contact Person', label: 'Contact Person', align: 'left', minWidth: 20 },
  { key: 'Phone', label: 'Phone', align: 'center', minWidth: 16 },
  { key: 'Email', label: 'Email', align: 'left', minWidth: 26 },
  { key: 'Alternate Phone', label: 'Alternate Phone', align: 'center', minWidth: 16 },
  { key: 'Alternate Email', label: 'Alternate Email', align: 'left', minWidth: 26 },
  { key: 'Customer Type', label: 'Customer Type', align: 'center', minWidth: 16 },
  { key: 'Project Name', label: 'Project Name', align: 'left', minWidth: 24 },
  { key: 'Product Category', label: 'Product Category', align: 'center', minWidth: 16 },
  { key: 'State', label: 'State', align: 'left', minWidth: 16 },
  { key: 'Location', label: 'Location', align: 'left', minWidth: 18 },
  { key: 'Industry type', label: 'Industry type', align: 'left', minWidth: 18 },
  { key: 'Customer Ref. No.', label: 'Customer Ref. No.', align: 'center', minWidth: 18 },
  { key: 'Consultant Name', label: 'Consultant Name', align: 'left', minWidth: 20 },
  { key: 'PO Value', label: 'PO Value', align: 'right', minWidth: 16 },
];

const DEALS_COLUMNS = [
  { key: 'Deal Date', label: 'Deal Date', align: 'center', minWidth: 14 },
  { key: 'Deal Type', label: 'Deal Type', align: 'center', minWidth: 16 },
  { key: 'Deal Name', label: 'Deal Name', align: 'left', minWidth: 26 },
  { key: 'Deal Owner', label: 'Deal Owner', align: 'left', minWidth: 20 },
  { key: 'Deal Value', label: 'Deal Value', align: 'right', minWidth: 18 },
  { key: 'PO Value', label: 'PO Value', align: 'right', minWidth: 16 },
  { key: 'Description', label: 'Description', align: 'left', minWidth: 28 },
  { key: 'Consultant Name', label: 'Consultant Name', align: 'left', minWidth: 20 },
  { key: 'Phone', label: 'Phone', align: 'center', minWidth: 16 },
  { key: 'Project Name', label: 'Project Name', align: 'left', minWidth: 24 },
  { key: 'Added By', label: 'Added By', align: 'left', minWidth: 20 },
  { key: 'Customer Name', label: 'Customer Name', align: 'left', minWidth: 26 },
];

const CUSTOMERS_COLUMNS = [
  { key: 'Customer No.', label: 'Customer No.', align: 'center', minWidth: 16 },
  { key: 'Customer Name', label: 'Customer Name', align: 'left', minWidth: 24 },
  { key: 'Company Name', label: 'Company Name', align: 'left', minWidth: 26 },
  { key: 'Customer Owner', label: 'Customer Owner', align: 'left', minWidth: 20 },
  { key: 'Status', label: 'Status', align: 'center', minWidth: 14 },
  { key: 'Category', label: 'Category', align: 'center', minWidth: 14 },
  { key: 'Phone', label: 'Phone', align: 'center', minWidth: 16 },
  { key: 'Email', label: 'Email', align: 'left', minWidth: 26 },
  { key: 'City / Location', label: 'City / Location', align: 'left', minWidth: 18 },
  { key: 'Created At', label: 'Created At', align: 'center', minWidth: 14 },
];

const QUOTATIONS_COLUMNS = [
  { key: 'Quotation Number', label: 'Quotation Number', align: 'center', minWidth: 20 },
  { key: 'Quotation Date', label: 'Quotation Date', align: 'center', minWidth: 14 },
  { key: 'Company Name', label: 'Company Name', align: 'left', minWidth: 24 },
  { key: 'Contact Person', label: 'Contact Person', align: 'left', minWidth: 20 },
  { key: 'Quotation Valid Until', label: 'Quotation Valid Until', align: 'center', minWidth: 16 },
  { key: 'Status', label: 'Status', align: 'center', minWidth: 14 },
  { key: 'Quotation Total', label: 'Quotation Total', align: 'right', minWidth: 18 },
  { key: 'Quotation Added By', label: 'Quotation Added By', align: 'left', minWidth: 20 },
  { key: 'Account Name', label: 'Account Name', align: 'left', minWidth: 26 },
  { key: 'Project Name', label: 'Project Name', align: 'left', minWidth: 24 },
];

const SUMMARY_COLUMNS = [
  { key: 'Owner Name', label: 'Owner Name', align: 'left', minWidth: 22 },
  { key: 'Owner Code', label: 'Owner Code', align: 'center', minWidth: 12 },
  { key: 'Total Records', label: 'Total Records', align: 'center', minWidth: 14 },
  { key: 'Total Accounts', label: 'Total Accounts', align: 'center', minWidth: 14 },
  { key: 'Total Deals', label: 'Total Deals', align: 'center', minWidth: 14 },
  { key: 'Total Deal Value (₹)', label: 'Total Deal Value (₹)', align: 'right', minWidth: 20 },
  { key: 'Total Customers', label: 'Total Customers', align: 'center', minWidth: 14 },
  { key: 'Total Quotations', label: 'Total Quotations', align: 'center', minWidth: 14 },
  { key: 'Total Quotation Value (₹)', label: 'Total Quotation Value (₹)', align: 'right', minWidth: 20 },
];

/**
 * Fetch and process records for export
 */
async function getExportData({
  owners = 'all',
  modules = ['accounts', 'deals', 'customers', 'quotations'],
  dateRange = {},
}) {
  const db = mongoose.connection.db;
  const maps = await getOwnerMaps();

  const selectedOwners = Array.isArray(owners) ? owners : [owners];
  const fromTime = dateRange.from ? parseDateTimestamp(dateRange.from) : null;
  const toTime = dateRange.to ? (parseDateTimestamp(dateRange.to) ? parseDateTimestamp(dateRange.to) + 86399999 : null) : null;

  const result = {
    accounts: [],
    deals: [],
    customers: [],
    quotations: [],
    ownerSummary: [],
  };

  const ownerAgg = {};
  const touchOwner = (ownerName) => {
    const key = String(ownerName || 'Unassigned').trim();
    if (!ownerAgg[key]) {
      ownerAgg[key] = {
        owner: key,
        accounts: 0,
        deals: 0,
        dealValue: 0,
        customers: 0,
        quotations: 0,
        quotationValue: 0,
      };
    }
    return ownerAgg[key];
  };

  // 1. ACCOUNTS (leads collection - exact 19 requested columns, Account Number displays Owner Code)
  if (modules.includes('accounts')) {
    const rawAccounts = await db.collection('leads').find({}).sort({ createdAt: -1 }).toArray();
    rawAccounts.forEach((doc) => {
      if (!isDocumentInOwnerScope(doc, selectedOwners, maps, 'account')) return;
      if (!isDocumentInDateScope(doc, fromTime, toTime, 'account')) return;

      const docCat = doc.accountCategory || doc.category || doc.formData?.accountCategory || doc.formData?.category || '-';
      const owner = resolveOwnerName(doc, 'account', maps);
      const ownerCode = resolveOwnerCode(doc, owner, maps);
      const displayedAccNo = (ownerCode && ownerCode !== '-')
        ? ownerCode
        : (doc.accountNumber || doc.accountNo || doc.formData?.accountNumber || doc.formData?.accountNo || '-');

      const row = {
        'Account Number': displayedAccNo,
        'Account Name': doc.accountName || doc.formData?.accountName || doc.name || doc.formData?.name || doc.customerName || '-',
        'Account Date': formatDate(doc.accountDate || doc.formData?.accountDate || doc.createdAt),
        'Account Category': docCat,
        'Account Owner': owner,
        'Contact Person': doc.contactPerson || doc.formData?.contactPerson || '-',
        'Phone': doc.phone || doc.formData?.phone || doc.mobile || '-',
        'Email': doc.email || doc.formData?.email || '-',
        'Alternate Phone': doc.alternatePhone || doc.formData?.alternatePhone || doc.formData?.alternateMobile || doc.alternateMobile || '-',
        'Alternate Email': doc.alternateEmail || doc.formData?.alternateEmail || '-',
        'Customer Type': doc.customerType || doc.formData?.customerType || '-',
        'Project Name': doc.projectName || doc.formData?.projectName || doc.project || doc.formData?.project || (Array.isArray(doc.formData?.projects) && doc.formData.projects[0]?.projectName) || '-',
        'Product Category': doc.productCategory || doc.formData?.productCategory || doc.category || '-',
        'State': doc.state || doc.formData?.state || '-',
        'Location': doc.location || doc.city || doc.formData?.location || doc.formData?.city || '-',
        'Industry type': doc.industryType || doc.formData?.industryType || doc.industry || '-',
        'Customer Ref. No.': doc.customerRefNo || doc.formData?.customerRefNo || doc.customerReferenceNo || doc.refNo || '-',
        'Consultant Name': doc.consultantName || doc.formData?.consultantName || doc.consultant || '-',
        'PO Value': doc.poValue || doc.formData?.poValue || doc.orderValue || '-',
      };

      result.accounts.push(row);
      touchOwner(owner).accounts += 1;
    });
  }

  // 2. DEALS (deals collection - exact 12 requested columns)
  if (modules.includes('deals')) {
    const rawDeals = await db.collection('deals').find({}).sort({ createdAt: -1 }).toArray();
    rawDeals.forEach((doc) => {
      if (!isDocumentInOwnerScope(doc, selectedOwners, maps, 'deal')) return;
      if (!isDocumentInDateScope(doc, fromTime, toTime, 'deal')) return;

      const owner = resolveOwnerName(doc, 'deal', maps);
      const dVal = parseNum(doc.dealValue || doc.value || doc.amount || doc.data?.dealValue || doc.data?.value);

      const dealName =
        doc.dealName ||
        doc.data?.dealName ||
        doc.title ||
        doc.data?.title ||
        doc.name ||
        doc.data?.name ||
        doc.projectName ||
        doc.data?.projectName ||
        '-';

      const projectName =
        doc.projectName ||
        doc.data?.projectName ||
        doc.project ||
        (dealName !== '-' ? dealName : '-');

      const rawCreatorId =
        doc.createdBy?.['$numberInt'] ||
        doc.createdBy ||
        doc.data?.createdBy?.['$numberInt'] ||
        doc.data?.createdBy ||
        doc.userId ||
        doc.data?.userId;
      const creatorIdStr = rawCreatorId ? String(rawCreatorId).trim() : '';
      const mappedCreator = creatorIdStr ? (maps.legacyIdToName[creatorIdStr] || maps.idToName[creatorIdStr]) : null;

      const addedBy =
        doc.addedBy ||
        doc.data?.addedBy ||
        doc.createdByUserName ||
        doc.data?.createdByUserName ||
        doc.createdUserBy ||
        mappedCreator ||
        doc.data?.assignedUserName ||
        doc.ownerName ||
        owner ||
        '-';

      const row = {
        'Deal Date': formatDate(doc.dealDate || doc.data?.dealDate || doc.date || doc.createdAt),
        'Deal Type': doc.dealType || doc.stage || doc.data?.dealType || '-',
        'Deal Name': dealName,
        'Deal Owner': owner,
        'Deal Value': formatCurrency(dVal),
        'PO Value': doc.poValue || doc.data?.poValue || doc.orderValue || '-',
        'Description': doc.description || doc.data?.description || doc.remarks || '-',
        'Consultant Name': doc.consultantName || doc.data?.consultantName || doc.consultant || '-',
        'Phone': doc.phone || doc.data?.phone || doc.mobile || doc.data?.mobile || '-',
        'Project Name': projectName,
        'Added By': addedBy,
        'Customer Name': doc.accountName || doc.data?.accountName || doc.customerName || doc.data?.customerName || '-',
      };

      result.deals.push(row);
      const agg = touchOwner(owner);
      agg.deals += 1;
      agg.dealValue += dVal;
    });
  }

  // 3. CUSTOMERS (customers collection - exact 10 requested columns)
  if (modules.includes('customers')) {
    const rawCustomers = await db.collection('customers').find({}).sort({ createdAt: -1 }).toArray();
    rawCustomers.forEach((doc) => {
      if (!isDocumentInOwnerScope(doc, selectedOwners, maps, 'customer')) return;
      if (!isDocumentInDateScope(doc, fromTime, toTime, 'customer')) return;

      const docStatus = doc.status || doc.formData?.status || 'Active';
      const docCat = doc.customerCategory || doc.category || doc.customerType || '-';
      const owner = resolveOwnerName(doc, 'customer', maps);

      const row = {
        'Customer No.': doc.customerNumber || doc.customerNo || doc.formData?.customerNumber || '-',
        'Customer Name': doc.name || doc.customerName || '-',
        'Company Name': doc.companyName || doc.company || doc.name || '-',
        'Customer Owner': owner,
        'Status': docStatus,
        'Category': docCat,
        'Phone': doc.phone || doc.mobile || '-',
        'Email': doc.email || '-',
        'City / Location': doc.city || doc.location || '-',
        'Created At': formatDate(doc.createdAt),
      };

      result.customers.push(row);
      touchOwner(owner).customers += 1;
    });
  }

  // 4. QUOTATIONS (quotations collection - exact 10 requested columns)
  if (modules.includes('quotations')) {
    const rawQuotations = await db.collection('quotations').find({}).sort({ createdAt: -1 }).toArray();
    rawQuotations.forEach((doc) => {
      if (!isDocumentInOwnerScope(doc, selectedOwners, maps, 'quotation')) return;
      if (!isDocumentInDateScope(doc, fromTime, toTime, 'quotation')) return;

      const docStatus = doc.status || doc.data?.status || 'Open';
      const owner = resolveOwnerName(doc, 'quotation', maps);

      // Active revision and exact date resolution
      const revs = doc.data?.revisions || doc.revisions;
      const activeCode = doc.revisionCode || doc.data?.revisionCode;
      let resolvedDate = null;
      if (Array.isArray(revs) && activeCode) {
        const match = revs.find((r) => r.revisionCode === activeCode);
        if (match && match.date) resolvedDate = match.date;
      }
      if (!resolvedDate) {
        resolvedDate = doc.data?.quotationDate || doc.data?.customerReference?.date || doc.quotationDate || doc.date || doc.createdAt;
      }

      const qVal = parseNum(doc.grandTotal || doc.data?.grandTotal || doc.total || doc.data?.total || doc.amount);

      const rawQuoteCreatorId =
        doc.createdBy?.['$numberInt'] ||
        doc.createdBy ||
        doc.data?.createdBy?.['$numberInt'] ||
        doc.data?.createdBy ||
        doc.userId ||
        doc.data?.userId;
      const quoteCreatorIdStr = rawQuoteCreatorId ? String(rawQuoteCreatorId).trim() : '';
      const mappedQuoteCreator = quoteCreatorIdStr ? (maps.legacyIdToName[quoteCreatorIdStr] || maps.idToName[quoteCreatorIdStr]) : null;

      const quoteAddedBy =
        doc.addedBy ||
        doc.data?.addedBy ||
        doc.createdByUserName ||
        doc.data?.createdByUserName ||
        doc.createdUserBy ||
        mappedQuoteCreator ||
        doc.preparedBy ||
        doc.data?.preparedBy ||
        doc.ownerName ||
        owner ||
        '-';

      const quoteProjectName =
        doc.dealName ||
        doc.data?.dealName ||
        doc.projectName ||
        doc.data?.projectName ||
        doc.title ||
        '-';

      const row = {
        'Quotation Number': doc.quotationNumber || doc.quotationNo || doc.data?.quotationNumber || '-',
        'Quotation Date': formatDate(resolvedDate),
        'Company Name': doc.companyName || doc.data?.companyName || doc.company || doc.data?.company || doc.accountName || 'Ssipl',
        'Contact Person': doc.contactPerson || doc.data?.contactPerson || '-',
        'Quotation Valid Until': formatDate(doc.validUntil || doc.data?.validUntil),
        'Status': docStatus,
        'Quotation Total': formatCurrency(qVal),
        'Quotation Added By': quoteAddedBy,
        'Account Name': doc.accountName || doc.data?.customerReference?.accountName || doc.customerName || doc.companyName || '-',
        'Project Name': quoteProjectName,
      };

      result.quotations.push(row);
      const agg = touchOwner(owner);
      agg.quotations += 1;
      agg.quotationValue += qVal;
    });
  }

  // 5. OWNER SUMMARY (exact breakdown with Owner Code)
  const summaryRows = Object.values(ownerAgg).sort((a, b) => a.owner.localeCompare(b.owner));
  let grandAcc = 0;
  let grandDeals = 0;
  let grandDealVal = 0;
  let grandCust = 0;
  let grandQuotes = 0;
  let grandQuoteVal = 0;

  summaryRows.forEach((s) => {
    grandAcc += s.accounts;
    grandDeals += s.deals;
    grandDealVal += s.dealValue;
    grandCust += s.customers;
    grandQuotes += s.quotations;
    grandQuoteVal += s.quotationValue;

    const totalRecords = s.accounts + s.deals + s.customers + s.quotations;
    const ownerCode = maps.nameToCode?.[s.owner.toLowerCase()] || '-';

    result.ownerSummary.push({
      'Owner Name': s.owner,
      'Owner Code': ownerCode,
      'Total Records': totalRecords,
      'Total Accounts': s.accounts,
      'Total Deals': s.deals,
      'Total Deal Value (₹)': formatCurrency(s.dealValue),
      'Total Customers': s.customers,
      'Total Quotations': s.quotations,
      'Total Quotation Value (₹)': formatCurrency(s.quotationValue),
    });
  });

  if (summaryRows.length > 0) {
    const grandTotalRecords = grandAcc + grandDeals + grandCust + grandQuotes;
    result.ownerSummary.push({
      'Owner Name': 'GRAND TOTAL',
      'Owner Code': '-',
      'Total Records': grandTotalRecords,
      'Total Accounts': grandAcc,
      'Total Deals': grandDeals,
      'Total Deal Value (₹)': formatCurrency(grandDealVal),
      'Total Customers': grandCust,
      'Total Quotations': grandQuotes,
      'Total Quotation Value (₹)': formatCurrency(grandQuoteVal),
    });
  }

  return result;
}

/**
 * Build professional Excel sheet with prominent Top Header Banner, cell merges, and auto-adjusted column widths
 */
function buildFormattedSheet({
  moduleTitle,
  ownerScopeLabel,
  recordCountLabel,
  filterMetadataLabel,
  columnsConfig,
  rowsData,
}) {
  const headerAOA = [
    ['SWATI SWITCHGEARS INDIA PVT. LTD.'],
    [`CRM DATA EXPORT — ${moduleTitle.toUpperCase()}`],
    [`Owner Scope: ${ownerScopeLabel}   |   ${recordCountLabel}`],
    [`${filterMetadataLabel}   |   Exported On: ${formatDateTime(new Date())}`],
    [], // Blank separator row 5
    columnsConfig.map((col) => col.label), // Row 6: Table Header Row
  ];

  const dataAOA = rowsData.map((row) =>
    columnsConfig.map((col) => (row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : '-'))
  );

  const fullAOA = [...headerAOA, ...dataAOA];
  const ws = XLSX.utils.aoa_to_sheet(fullAOA);

  // Merge top header banner rows 0 to 3
  const numCols = columnsConfig.length;
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: numCols - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: numCols - 1 } },
  ];

  // Auto-width columns with content-aware boundaries
  ws['!cols'] = columnsConfig.map((col) => {
    let maxLen = col.label.length;
    rowsData.slice(0, 200).forEach((r) => {
      const valLen = String(r[col.key] || '').length;
      if (valLen > maxLen) maxLen = valLen;
    });

    let minW = col.minWidth || 12;
    let maxW = 42;

    if (/date/i.test(col.key)) { minW = 14; maxW = 16; }
    if (/phone|mobile/i.test(col.key)) { minW = 15; maxW = 18; }
    if (/value|total/i.test(col.key)) { minW = 16; maxW = 22; }
    if (/number|no\./i.test(col.key)) { minW = 14; maxW = 20; }
    if (/name|project|company|email|description/i.test(col.key)) { minW = 24; maxW = 55; }

    return { wch: Math.min(Math.max(maxLen + 3, minW), maxW) };
  });

  return ws;
}

/**
 * Generate Excel Workbook Buffer with all sheets & standardized header banners
 */
function generateWorkbookBuffer(exportData, selectedModules = ['accounts', 'deals', 'customers', 'quotations'], metadata = {}) {
  if (!Array.isArray(selectedModules)) {
    if (selectedModules && typeof selectedModules === 'object') {
      metadata = selectedModules;
    }
    selectedModules = ['accounts', 'deals', 'customers', 'quotations'];
  }
  const wb = XLSX.utils.book_new();

  const ownerLabel = metadata.owners && metadata.owners !== 'all'
    ? (Array.isArray(metadata.owners) ? metadata.owners.join(', ') : String(metadata.owners))
    : 'All Owners (Consolidated Across Entire CRM)';
  const dateRangeStr = metadata.dateRange?.from
    ? `${metadata.dateRange.from} to ${metadata.dateRange.to || 'Present'}`
    : 'All Time';
  const filterMeta = `Date Range: ${dateRangeStr}`;

  const moduleDefinitions = [
    { key: 'accounts', name: 'Accounts', columns: ACCOUNTS_COLUMNS },
    { key: 'deals', name: 'Deals', columns: DEALS_COLUMNS },
    { key: 'customers', name: 'Customers', columns: CUSTOMERS_COLUMNS },
    { key: 'quotations', name: 'Quotations', columns: QUOTATIONS_COLUMNS },
  ];

  moduleDefinitions.forEach(({ key, name, columns }) => {
    if (selectedModules.includes(key) && Array.isArray(exportData[key]) && exportData[key].length > 0) {
      const ws = buildFormattedSheet({
        moduleTitle: name,
        ownerScopeLabel: ownerLabel,
        recordCountLabel: `Total Records: ${exportData[key].length} ${name}`,
        filterMetadataLabel: filterMeta,
        columnsConfig: columns,
        rowsData: exportData[key],
      });
      XLSX.utils.book_append_sheet(wb, ws, name);
    }
  });

  // Always append Owner Summary if any data exists
  if (Array.isArray(exportData.ownerSummary) && exportData.ownerSummary.length > 0) {
    const wsSummary = buildFormattedSheet({
      moduleTitle: 'Owner Summary Breakdown',
      ownerScopeLabel: ownerLabel,
      recordCountLabel: `Total Active Owners: ${exportData.ownerSummary.filter((r) => r['Owner Name'] !== 'GRAND TOTAL').length}`,
      filterMetadataLabel: filterMeta,
      columnsConfig: SUMMARY_COLUMNS,
      rowsData: exportData.ownerSummary,
    });
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Owner Summary');
  }

  // If entirely empty, provide at least one sheet
  if (wb.SheetNames.length === 0) {
    const wsEmpty = XLSX.utils.json_to_sheet([{ Message: 'No matching records found for the selected filters.' }]);
    XLSX.utils.book_append_sheet(wb, wsEmpty, 'Data Export');
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generate PDF Document Buffer with Swati Switchgears branding, executive metadata & auto-paginated tables
 */
function generatePdfBuffer(exportData, selectedModules = ['accounts', 'deals', 'customers', 'quotations'], metadata = {}) {
  if (!Array.isArray(selectedModules)) {
    if (selectedModules && typeof selectedModules === 'object') {
      metadata = selectedModules;
    }
    selectedModules = ['accounts', 'deals', 'customers', 'quotations'];
  }
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const ownerLabel = metadata.owners && metadata.owners !== 'all'
    ? (Array.isArray(metadata.owners) ? metadata.owners.join(', ') : String(metadata.owners))
    : 'All Owners (Consolidated Across Entire CRM)';
  const dateRangeStr = metadata.dateRange?.from
    ? `${metadata.dateRange.from} to ${metadata.dateRange.to || 'Present'}`
    : 'All Time';

  const logoBase64 = getSwatiLogoBase64();
  let isFirstPage = true;

  const addHeader = (sectionTitle, recordCount) => {
    if (!isFirstPage) doc.addPage();
    isFirstPage = false;

    // 1. Top Center Swati Logo (Refined to 44x44pt - Exact 1:1 Natural Square Aspect Ratio)
    const logoWidth = 44;
    const logoHeight = 44;
    const logoX = (pageWidth - logoWidth) / 2;
    const logoY = 7;
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', logoX, logoY, logoWidth, logoHeight, 'SWATI_LOGO', 'FAST');
      } catch (e) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text('SWATI SWITCHGEARS', pageWidth / 2, 28, { align: 'center' });
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text('SWATI SWITCHGEARS', pageWidth / 2, 28, { align: 'center' });
    }

    // 2. Corporate Header Banner below logo (Clean, prominent navy card)
    doc.setFillColor(15, 23, 42); // #0f172a navy
    doc.rect(15, 56, pageWidth - 30, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`SWATI SWITCHGEARS - CRM DATA EXPORT: ${sectionTitle.toUpperCase()}`, 25, 67);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Owner Scope: ${ownerLabel}   |   Total Records: ${recordCount}   |   Date Range: ${dateRangeStr}`, 25, 75);
  };

  const moduleDefinitions = [
    { key: 'accounts', name: 'Accounts', columns: ACCOUNTS_COLUMNS },
    { key: 'deals', name: 'Deals', columns: DEALS_COLUMNS },
    { key: 'customers', name: 'Customers', columns: CUSTOMERS_COLUMNS },
    { key: 'quotations', name: 'Quotations', columns: QUOTATIONS_COLUMNS },
  ];

  moduleDefinitions.forEach(({ key, name, columns }) => {
    if (selectedModules.includes(key) && Array.isArray(exportData[key]) && exportData[key].length > 0) {
      addHeader(name, exportData[key].length);

      const head = [columns.map((c) => c.label)];
      const body = exportData[key].map((row) =>
        columns.map((c) => String(row[c.key] !== undefined && row[c.key] !== null ? row[c.key] : '-'))
      );

      let tableFontSize = 5.6;
      let tablePadding = 1.8;
      if (key === 'deals') { tableFontSize = 6.8; tablePadding = 2.2; }
      if (key === 'customers' || key === 'quotations') { tableFontSize = 7.2; tablePadding = 2.5; }

      const columnStyles = {};
      columns.forEach((c, idx) => {
        columnStyles[idx] = { halign: c.align || 'left', valign: 'middle' };
      });

      autoTable(doc, {
        head,
        body,
        startY: 84,
        theme: 'grid',
        tableWidth: pageWidth - 30,
        margin: { left: 15, right: 15, bottom: 25 },
        styles: {
          fontSize: tableFontSize,
          cellPadding: tablePadding,
          overflow: 'linebreak',
          lineColor: [203, 213, 225],
          lineWidth: 0.4,
          valign: 'middle',
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          valign: 'middle',
          halign: 'center',
          lineColor: [51, 65, 85],
          lineWidth: 0.4,
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles,
      });
    }
  });

  // Owner Summary in PDF
  if (Array.isArray(exportData.ownerSummary) && exportData.ownerSummary.length > 0) {
    addHeader('Owner Summary Breakdown', exportData.ownerSummary.length);

    const head = [SUMMARY_COLUMNS.map((c) => c.label)];
    const body = exportData.ownerSummary.map((row) =>
      SUMMARY_COLUMNS.map((c) => String(row[c.key] !== undefined && row[c.key] !== null ? row[c.key] : '-'))
    );

    const columnStyles = {};
    SUMMARY_COLUMNS.forEach((c, idx) => {
      columnStyles[idx] = { halign: c.align || 'left', valign: 'middle' };
    });

    autoTable(doc, {
      head,
      body,
      startY: 84,
      theme: 'grid',
      tableWidth: pageWidth - 30,
      margin: { left: 15, right: 15, bottom: 25 },
      styles: {
        fontSize: 7.8,
        cellPadding: 3,
        lineColor: [203, 213, 225],
        lineWidth: 0.4,
        valign: 'middle',
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        valign: 'middle',
        halign: 'center',
        lineColor: [51, 65, 85],
        lineWidth: 0.4,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles,
      didParseCell: (data) => {
        if (data.row.raw && data.row.raw[0] === 'GRAND TOTAL') {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [226, 232, 240];
        }
      },
    });
  }

  // Footer page numbering
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Swati Switchgears CRM Data Export - Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  return Buffer.from(doc.output('arraybuffer'));
}

/**
 * Generate CSV text for single module or combined
 */
function generateCsv(exportData, moduleName = 'accounts') {
  const rows = exportData[moduleName] || exportData.accounts || exportData.deals || exportData.customers || exportData.quotations || [];
  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Message: 'No records found' }]);
  return XLSX.utils.sheet_to_csv(ws);
}

module.exports = {
  getAvailableOwners,
  getExportData,
  generateWorkbookBuffer,
  generatePdfBuffer,
  generateCsv,
};
