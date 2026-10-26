const {
  canonicalizeKey,
  parseUniversalDate,
  formatDateDisplay,
  formatNumberOrCurrency,
  findDeepFieldValue,
  resolveDocumentField,
} = require('../utils/universalFieldResolver');
const mongoose = require('mongoose');
const XLSX = require('xlsx');

// Collection mapping
const COLLECTION_MAP = {
  account: 'leads',
  lead: 'leads',
  deal: 'deals',
  customer: 'customers',
  quotation: 'quotations',
};

// Field label resolution dictionaries (matching CustomReportsPage.jsx & report definitions)
const ACCOUNT_FIELD_LABELS = {
  accountNumber: 'Account No.',
  accountNo: 'Account No.',
  id: 'Account No.',
  accountDate: 'Account Date',
  date: 'Account Date',
  name: 'Account Name',
  accountName: 'Account Name',
  customerName: 'Account Name',
  accountOwner: 'Account Owner',
  accountOwnerName: 'Account Owner',
  owner: 'Account Owner',
  ownerCode: 'Owner Code',
  status: 'Account Status',
  accountStatus: 'Account Status',
  accountCategory: 'Account Category',
  category: 'Account Category',
  accountSource: 'Account Source',
  source: 'Account Source',
  contactPerson: 'Contact Person',
  phone: 'Phone',
  mobile: 'Phone',
  email: 'Email',
  projectName: 'Project Name',
  project: 'Project Name',
  location: 'Location',
  city: 'Location',
  poValue: 'PO Value',
  jobNo: 'Job No',
  reasonForLost: 'Reason For Lost',
  latestRemark: 'Latest Remark',
  remarks: 'Latest Remark',
  addedBy: 'Added By',
  createdAt: 'Created At',
  accountState: 'Account State',
  state: 'Account State',
};

const DEAL_FIELD_LABELS = {
  dealNumber: 'Deal No.',
  id: 'Deal No.',
  dealName: 'Deal Name',
  name: 'Deal Name',
  title: 'Deal Name',
  dealDate: 'Deal Date',
  dealOwner: 'Deal Owner',
  dealOwnerName: 'Deal Owner',
  owner: 'Deal Owner',
  ownerCode: 'Owner Code',
  dealType: 'Deal Type',
  stage: 'Stage',
  status: 'Deal Status',
  dealStatus: 'Deal Status',
  dealValue: 'Deal Value',
  value: 'Deal Value',
  amount: 'Deal Value',
  customerName: 'Customer Name',
  projectName: 'Project Name',
  project: 'Project Name',
  consultantName: 'Consultant Name',
  expectedCloseDate: 'Expected Close Date',
  expectedClosureDate: 'Closure Date',
  poValue: 'PO Value',
  addedOn: 'Added On',
  createdAt: 'Created At',
};

const CUSTOMER_FIELD_LABELS = {
  customerNumber: 'Customer No.',
  customerNo: 'Customer No.',
  id: 'Customer No.',
  customerName: 'Customer Name',
  name: 'Customer Name',
  company: 'Company Name',
  companyName: 'Company Name',
  city: 'City',
  location: 'City',
  phone: 'Phone',
  mobile: 'Phone',
  email: 'Email',
  status: 'Customer Status',
  customerStatus: 'Customer Status',
  customerCategory: 'Category',
  customerType: 'Customer Type',
  assignedTo: 'Customer Owner',
  assignedToName: 'Customer Owner',
  customerOwner: 'Customer Owner',
  owner: 'Customer Owner',
  ownerCode: 'Owner Code',
  contactPerson: 'Contact Person',
  state: 'State',
  industryType: 'Industry Type',
  createdAt: 'Created At',
};

const QUOTATION_FIELD_LABELS = {
  quotationNo: 'Quotation No.',
  quotationNumber: 'Quotation No.',
  id: 'Quotation No.',
  date: 'Quotation Date',
  quotationDate: 'Quotation Date',
  accountName: 'Account Name',
  customerName: 'Customer Name',
  dealName: 'Deal Name',
  title: 'Quotation Title',
  quotationTitle: 'Quotation Title',
  grandTotal: 'Grand Total',
  total: 'Grand Total',
  amount: 'Quotation Amount',
  status: 'Status',
  quotationStatus: 'Status',
  quotationOwner: 'Quotation Owner',
  ownerCode: 'Owner Code',
  projectName: 'Project Name',
  validUntil: 'Valid Until',
  createdAt: 'Created At',
};

const DEFAULT_FIELDS = {
  account: ['accountNumber', 'accountDate', 'name', 'accountOwner', 'status', 'projectName', 'phone', 'email'],
  deal: ['dealNumber', 'dealName', 'dealDate', 'dealOwner', 'dealType', 'status', 'dealValue', 'projectName'],
  customer: ['customerNumber', 'customerName', 'companyName', 'city', 'phone', 'email', 'status'],
  quotation: ['quotationNo', 'date', 'accountName', 'dealName', 'grandTotal', 'status'],
};

const formatDate = (val) => {
  if (!val) return '-';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const parseDateTimestamp = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? null : t;
  }
  if (typeof value === 'number') {
    return Number.isNaN(value) ? null : value;
  }
  const str = String(value).trim();
  if (!str) return null;

  // ISO or YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    const dateObj = new Date(y, m, d, 0, 0, 0, 0);
    return Number.isNaN(dateObj.getTime()) ? null : dateObj.getTime();
  }

  // DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    const dateObj = new Date(y, m, d, 0, 0, 0, 0);
    return Number.isNaN(dateObj.getTime()) ? null : dateObj.getTime();
  }

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.getTime();
  }
  return null;
};

const resolveDateBounds = (dateRangeType = 'last_7_days', customStart = null, customEnd = null) => {
  const now = new Date();
  let fromTime = null;
  let toTime = null;

  if (dateRangeType === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    fromTime = start.getTime();
    toTime = end.getTime();
  } else if (dateRangeType === 'last_7_days') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    fromTime = start.getTime();
    toTime = now.getTime();
  } else if (dateRangeType === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    fromTime = start.getTime();
    toTime = now.getTime();
  } else if (dateRangeType === 'previous_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    fromTime = start.getTime();
    toTime = end.getTime();
  } else if (dateRangeType === 'custom' && customStart && customEnd) {
    fromTime = new Date(customStart).getTime();
    const end = new Date(customEnd);
    end.setHours(23, 59, 59, 999);
    toTime = end.getTime();
  }

  return { fromTime, toTime };
};

const mapAccountDoc = (doc) => {
  const rawNo = doc.accountNumber || doc.accountNo || doc.id || '-';
  const rawName = doc.name || doc.companyName || doc.customerName || doc.accountName || '-';
  const rawOwner = doc.accountOwnerName || doc.accountOwner || doc.ownerName || doc.owner || doc.ownerCode || '-';
  const rawDate = formatDate(doc.accountDate || doc.date || doc.createdAt);
  const rawStatus = doc.status || doc.accountStatus || '-';

  return {
    ...doc,
    accountNumber: rawNo,
    accountNo: rawNo,
    id: rawNo,
    name: rawName,
    accountName: rawName,
    customerName: rawName,
    accountOwner: rawOwner,
    accountOwnerName: rawOwner,
    owner: rawOwner,
    accountDate: rawDate,
    date: rawDate,
    status: rawStatus,
    accountStatus: rawStatus,
    accountCategory: doc.accountCategory || doc.category || '-',
    category: doc.accountCategory || doc.category || '-',
    accountSource: doc.accountSource || doc.source || '-',
    source: doc.accountSource || doc.source || '-',
    contactPerson: doc.contactPerson || '-',
    phone: doc.phone || doc.mobile || '-',
    mobile: doc.phone || doc.mobile || '-',
    email: doc.email || '-',
    projectName: doc.projectName || doc.project || '-',
    project: doc.projectName || doc.project || '-',
    location: doc.location || doc.city || '-',
    city: doc.location || doc.city || '-',
    poValue: doc.poValue || '-',
    jobNo: doc.jobNo || '-',
    reasonForLost: doc.reasonForLost || '-',
    latestRemark: doc.latestRemark || doc.remarks || '-',
    remarks: doc.latestRemark || doc.remarks || '-',
    addedBy: doc.addedBy || doc.creatorName || doc.createdBy || '-',
    createdAt: formatDate(doc.createdAt),
    accountState: doc.accountState || doc.state || '-',
    state: doc.accountState || doc.state || '-',
  };
};

const mapDealDoc = (doc, usersMap = {}) => {
  const rawNo = doc.dealNumber || doc.id || doc.data?.dealNumber || '-';
  const rawName = doc.dealName || doc.name || doc.title || doc.data?.dealName || doc.data?.title || '-';
  const rawOwner = doc.dealOwnerName || doc.dealOwner || doc.ownerName || doc.owner || doc.data?.dealOwner || doc.data?.ownerName || '-';
  const resolvedOwner = (usersMap && usersMap[String(rawOwner).trim().toLowerCase()]) || rawOwner;
  const rawDate = formatDate(doc.dealDate || doc.data?.dealDate || doc.data?.convertedAt || doc.quotationDate || doc.createdAt);
  const rawValue = doc.dealValue || doc.value || doc.amount || doc.data?.dealValue || doc.data?.value || '-';
  const ownerEmail = (usersMap._emails && usersMap._emails[String(resolvedOwner).trim().toLowerCase()]) ||
    (usersMap._emails && usersMap._emails[String(rawOwner).trim().toLowerCase()]) || '-';

  return {
    ...doc,
    dealNumber: rawNo,
    id: rawNo,
    dealName: rawName,
    name: rawName,
    title: rawName,
    dealDate: rawDate,
    date: rawDate,
    dealOwner: resolvedOwner,
    dealOwnerName: resolvedOwner,
    owner: resolvedOwner,
    email: ownerEmail,
    ownerEmail: ownerEmail,
    dealType: doc.dealType || doc.stage || doc.data?.dealType || '-',
    stage: doc.stage || doc.dealType || doc.data?.stage || '-',
    status: doc.status || doc.stage || doc.data?.status || '-',
    dealStatus: doc.status || doc.stage || doc.data?.status || '-',
    dealValue: rawValue,
    value: rawValue,
    amount: rawValue,
    customerName: doc.customerName || doc.name || doc.data?.customerName || '-',
    projectName: doc.projectName || doc.project || doc.data?.projectName || '-',
    project: doc.projectName || doc.project || doc.data?.projectName || '-',
    consultantName: doc.consultantName || doc.data?.consultantName || '-',
    expectedCloseDate: formatDate(doc.expectedCloseDate || doc.data?.expectedCloseDate),
    expectedClosureDate: formatDate(doc.expectedClosureDate || doc.expectedCloseDate || doc.data?.expectedClosureDate),
    poValue: doc.poValue || doc.data?.poValue || '-',
    addedOn: formatDate(doc.addedOn || doc.data?.convertedAt || doc.createdAt),
    createdAt: formatDate(doc.createdAt),
  };
};

const mapCustomerDoc = (doc, usersMap = {}) => {
  const rawNo = doc.customerNumber || doc.customerNo || doc.id || doc.formData?.customerNumber || '-';
  const rawName = doc.customerName || doc.name || doc.formData?.customerName || '-';
  const rawOwner = doc.assignedToName || doc.ownerName || doc.owner || doc.customerOwner || doc.formData?.assignedTo || '-';
  const resolvedOwner = (usersMap && usersMap[String(rawOwner).trim().toLowerCase()]) || rawOwner;
  const ownerEmail = (usersMap._emails && usersMap._emails[String(resolvedOwner).trim().toLowerCase()]) ||
    (usersMap._emails && usersMap._emails[String(rawOwner).trim().toLowerCase()]) || '-';

  return {
    ...doc,
    customerNumber: rawNo,
    customerNo: rawNo,
    id: rawNo,
    customerName: rawName,
    name: rawName,
    company: doc.company || doc.companyName || doc.formData?.company || '-',
    companyName: doc.company || doc.companyName || doc.formData?.companyName || '-',
    city: doc.city || doc.location || doc.formData?.city || '-',
    location: doc.city || doc.location || doc.formData?.location || '-',
    phone: doc.phone || doc.mobile || doc.formData?.phone || '-',
    mobile: doc.phone || doc.mobile || doc.formData?.mobile || '-',
    email: doc.email || doc.formData?.email || ownerEmail,
    ownerEmail: ownerEmail,
    status: doc.status || doc.formData?.status || '-',
    customerStatus: doc.status || doc.formData?.status || '-',
    customerCategory: doc.customerCategory || doc.category || doc.formData?.category || '-',
    customerType: doc.customerType || doc.formData?.customerType || '-',
    assignedTo: resolvedOwner,
    assignedToName: resolvedOwner,
    customerOwner: resolvedOwner,
    owner: resolvedOwner,
    contactPerson: doc.contactPerson || doc.formData?.contactPerson || '-',
    state: doc.state || doc.formData?.state || '-',
    industryType: doc.industryType || doc.formData?.industryType || '-',
    createdAt: formatDate(doc.createdAt),
  };
};

const mapQuotationDoc = (doc, usersMap = {}) => {
  const rawNo = doc.quotationNo || doc.quotationNumber || doc.id || doc.data?.quotationNumber || '-';
  const rawDate = formatDate(doc.date || doc.quotationDate || doc.data?.quotationDate || doc.data?.customerReference?.date || doc.createdAt);
  const rawAccount = doc.accountName || doc.customerName || doc.name || doc.data?.customerReference?.accountName || '-';
  const rawDeal = doc.dealName || doc.title || doc.data?.dealName || '-';
  const rawTotal = doc.grandTotal || doc.total || doc.amount || doc.data?.grandTotal || '-';
  const rawOwner = doc.quotationOwner || doc.owner || doc.data?.quotationOwner || doc.data?.owner || '-';
  const resolvedOwner = (usersMap && usersMap[String(rawOwner).trim().toLowerCase()]) || rawOwner;
  const ownerEmail = (usersMap._emails && usersMap._emails[String(resolvedOwner).trim().toLowerCase()]) ||
    (usersMap._emails && usersMap._emails[String(rawOwner).trim().toLowerCase()]) || '-';

  return {
    ...doc,
    quotationNo: rawNo,
    quotationNumber: rawNo,
    id: rawNo,
    date: rawDate,
    quotationDate: rawDate,
    accountName: rawAccount,
    customerName: rawAccount,
    dealName: rawDeal,
    title: rawDeal,
    quotationTitle: rawDeal,
    grandTotal: rawTotal,
    total: rawTotal,
    amount: rawTotal,
    status: doc.status || doc.data?.status || '-',
    quotationStatus: doc.status || doc.data?.status || '-',
    quotationOwner: resolvedOwner,
    owner: resolvedOwner,
    email: ownerEmail,
    ownerEmail: ownerEmail,
    projectName: doc.projectName || doc.project || doc.data?.projectName || '-',
    validUntil: formatDate(doc.validUntil || doc.data?.validUntil),
    createdAt: formatDate(doc.createdAt),
  };
};

/**
 * Executes a custom or standard report and generates a complete Excel Buffer (.xlsx)
 * with all exact columns matching http://localhost:3000/admin/reports/custom
 */
async function generateCustomReportExcelBuffer({ scheduledReport }) {
  const config = scheduledReport.reportConfig || {};
  let template = null;

  // 1. Look up live template if templateId is provided
  if (config.templateId) {
    try {
      const templateCol = mongoose.connection.db.collection('reporttemplates');
      template = await templateCol.findOne({
        $or: [
          { _id: new mongoose.Types.ObjectId(String(config.templateId)) },
          { id: String(config.templateId) },
        ],
      }).catch(() => null);

      if (!template) {
        // Fallback to generated reports collection
        const reportsCol = mongoose.connection.db.collection('reports');
        template = await reportsCol.findOne({
          $or: [
            { _id: new mongoose.Types.ObjectId(String(config.templateId)) },
            { id: String(config.templateId) },
          ],
        }).catch(() => null);
      }
    } catch (_) {
      // Ignore lookup errors
    }
  }

  // 2. Resolve Entity Type accurately
  let rawEntity = String(
    template?.entityType ||
    template?.categoryKey ||
    template?.reportContext ||
    config.entityType ||
    config.dataSource ||
    'account'
  ).toLowerCase().trim();

  if (rawEntity === 'accounts' || rawEntity === 'lead' || rawEntity === 'leads') rawEntity = 'account';
  if (rawEntity === 'deals') rawEntity = 'deal';
  if (rawEntity === 'customers') rawEntity = 'customer';
  if (rawEntity === 'quotations') rawEntity = 'quotation';

  const entityType = rawEntity;
  const collectionName = COLLECTION_MAP[entityType] || 'leads';

  // 3. Resolve Display Fields
  let fields = [];
  if (Array.isArray(template?.displayFields) && template.displayFields.length > 0) {
    fields = template.displayFields;
  } else if (Array.isArray(template?.selectedFields) && template.selectedFields.length > 0) {
    fields = template.selectedFields;
  } else if (Array.isArray(config.selectedFields) && config.selectedFields.length > 0) {
    fields = config.selectedFields;
  } else {
    fields = DEFAULT_FIELDS[entityType] || DEFAULT_FIELDS.account;
  }

  // 4. Resolve Field Label Mapping Dictionary
  let labelDict = ACCOUNT_FIELD_LABELS;
  let mapper = mapAccountDoc;
  if (entityType === 'deal') {
    labelDict = DEAL_FIELD_LABELS;
    mapper = mapDealDoc;
  } else if (entityType === 'customer') {
    labelDict = CUSTOMER_FIELD_LABELS;
    mapper = mapCustomerDoc;
  } else if (entityType === 'quotation') {
    labelDict = QUOTATION_FIELD_LABELS;
    mapper = mapQuotationDoc;
  }

  // 5. Query MongoDB Collection
  const col = mongoose.connection.db.collection(collectionName);
  const rawDocs = await col.find({}).sort({ createdAt: -1 }).toArray();

  // 6. Apply Date Range Filter
  const dateRangeType = config.dateRangeType || 'all_time';
  const { fromTime, toTime } = resolveDateBounds(dateRangeType, config.customStartDate, config.customEndDate);

  let filteredDocs = rawDocs;
  if (fromTime || toTime) {
    filteredDocs = filteredDocs.filter((doc) => {
      let candidateDate = null;
      if (entityType === 'account') {
        candidateDate = doc.accountDate || doc.date || doc.createdAt;
      } else if (entityType === 'deal') {
        candidateDate = doc.dealDate || doc.quotationDate || doc.createdAt;
      } else if (entityType === 'customer') {
        candidateDate = doc.createdAt || doc.addedDate;
      } else if (entityType === 'quotation') {
        candidateDate = doc.date || doc.quotationDate || doc.createdAt;
      }
      const ts = parseDateTimestamp(candidateDate);
      if (ts === null) return false;
      if (fromTime && ts < fromTime) return false;
      if (toTime && ts > toTime) return false;
      return true;
    });
  }

  // 7. Apply Owner Scoping Filter
  const ownerFilter = String(template?.accountOwner || config.accountOwner || 'all').trim().toLowerCase();
  if (ownerFilter && ownerFilter !== 'all') {
    filteredDocs = filteredDocs.filter((doc) => {
      const docOwners = [
        doc.accountOwnerName,
        doc.accountOwner,
        doc.ownerName,
        doc.owner,
        doc.dealOwnerName,
        doc.dealOwner,
        doc.assignedToName,
        doc.assignedTo,
        doc.customerOwner,
        doc.quotationOwner,
        doc.ownerCode,
      ].filter(Boolean).map((o) => String(o).trim().toLowerCase());

      return docOwners.some((o) => o === ownerFilter || o.includes(ownerFilter) || ownerFilter.includes(o));
    });
  }

  // 8. Transform to Clean Rows with Human-Readable Labels
  const finalRows = filteredDocs.map((doc) => {
    const mapped = mapper(doc);
    const rowObj = {};

    fields.forEach((fieldKey) => {
      const label = labelDict[fieldKey] || fieldKey;
      const val = mapped[fieldKey] !== undefined && mapped[fieldKey] !== null
        ? mapped[fieldKey]
        : (doc[fieldKey] != null ? doc[fieldKey] : '-');
      rowObj[label] = val;
    });

    return rowObj;
  });

  // 9. Build Excel Workbook
  const workbook = XLSX.utils.book_new();
  const rowsForSheet = finalRows.length > 0
    ? finalRows
    : [{ 'Report Status': 'No records found matching report criteria' }];

  const worksheet = XLSX.utils.json_to_sheet(rowsForSheet);

  // Auto-fit column widths
  const columnKeys = Object.keys(rowsForSheet[0] || {});
  worksheet['!cols'] = columnKeys.map((key) => {
    let maxLen = key.length;
    rowsForSheet.slice(0, 100).forEach((r) => {
      const val = String(r[key] ?? '');
      if (val.length > maxLen) maxLen = val.length;
    });
    return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
  });

  const reportTitle = template?.reportName || template?.name || config.reportName || scheduledReport.name || 'Report';
  const cleanSheetName = String(reportTitle).substring(0, 31).replace(/[:\\\/\?\*\[\]]/g, '_');
  XLSX.utils.book_append_sheet(workbook, worksheet, cleanSheetName);

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const fileName = `${reportTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return {
    buffer,
    recordCount: finalRows.length,
    fileName,
  };
}


async function getUsersLookupMap() {
  const map = {};
  const _emails = {};
  const _names = {};
  const _codes = {};
  const _profiles = {};

  try {
    const col = mongoose.connection.db.collection('users');
    const users = await col.find({}, {
      projection: { name: 1, username: 1, ownerCode: 1, owner_code: 1, email: 1, employeeId: 1, legacyId: 1 }
    }).toArray();

    users.forEach((u) => {
      const displayName = String(u.name || u.username || u.email || '').trim();
      const email = String(u.email || '').trim();
      const ownerCode = String(u.ownerCode || u.owner_code || '').trim();
      const legacyId = String(u.legacyId || '').trim();
      const username = String(u.username || '').trim();
      const id = String(u._id || '').trim();

      const profile = { name: displayName, email, ownerCode, legacyId, username, id };

      const registerKey = (k) => {
        if (!k) return;
        const lower = String(k).trim().toLowerCase();
        if (!lower) return;
        map[lower] = displayName;
        if (email) _emails[lower] = email;
        if (displayName) _names[lower] = displayName;
        if (ownerCode) _codes[lower] = ownerCode;
        _profiles[lower] = profile;
      };

      registerKey(id);
      registerKey(legacyId);
      registerKey(username);
      registerKey(displayName);
      registerKey(email);
      registerKey(ownerCode);
      registerKey(u.employeeId);
    });
  } catch (_) {}

  map._emails = _emails;
  map._names = _names;
  map._codes = _codes;
  map._profiles = _profiles;

  return map;
}

const detectTemplateEntityType = (tpl) => {
  let raw = String(tpl?.entityType || tpl?.categoryKey || tpl?.reportContext || '').toLowerCase().trim();
  if (raw === 'accounts' || raw === 'lead' || raw === 'leads') return 'account';
  if (raw === 'deals' || raw === 'deal') return 'deal';
  if (raw === 'quotations' || raw === 'quotation') return 'quotation';
  if (raw === 'customers' || raw === 'customer') return 'customer';

  // Dynamic signature inspection from selectedFields & displayFields
  const allFields = [...(tpl?.selectedFields || []), ...(tpl?.displayFields || [])]
    .map((f) => (typeof f === 'object' ? (f.key || f.label) : String(f)))
    .map((f) => f.toLowerCase());

  if (allFields.some((f) => f.includes('deal'))) return 'deal';
  if (allFields.some((f) => f.includes('quotation') || f.includes('quote'))) return 'quotation';
  if (allFields.some((f) => f.includes('customer'))) return 'customer';

  const name = String(tpl?.reportName || tpl?.title || tpl?.name || '').toLowerCase();
  if (name.includes('deal')) return 'deal';
  if (name.includes('quotation') || name.includes('quote')) return 'quotation';
  if (name.includes('customer')) return 'customer';

  return 'account';
};

const extractAllDocOwnerIdentities = (doc, usersMap = {}, entityType = null) => {
  const identities = new Set();
  let rawList = [];

  if (entityType === 'deal') {
    rawList = [
      doc.data?.dealOwner,
      doc.dealOwner,
      doc.data?.dealOwnerName,
      doc.dealOwnerName,
      doc.data?.data?.dealOwner,
      doc.data?.ownerCode,
      doc.ownerCode,
    ];
    if (!rawList.some((x) => x !== undefined && x !== null && String(x).trim() !== '')) {
      rawList.push(doc.assignedTo, doc.ownerUserId, doc.owner, doc.ownerName);
    }
  } else if (entityType === 'quotation') {
    rawList = [
      doc.data?.quotationOwner,
      doc.quotationOwner,
      doc.data?.customerReference?.owner,
      doc.data?.ownerCode,
      doc.ownerCode,
    ];
    if (!rawList.some((x) => x !== undefined && x !== null && String(x).trim() !== '')) {
      rawList.push(doc.assignedTo, doc.ownerUserId, doc.owner, doc.ownerName);
    }
  } else if (entityType === 'account') {
    rawList = [
      doc.accountOwner,
      doc.formData?.accountOwner,
      doc.formData?.formData?.accountOwner,
      doc.accountOwnerName,
      doc.formData?.accountOwnerName,
      doc.accountOwnerCode,
      doc.formData?.accountOwnerCode,
      doc.ownerCode,
      doc.formData?.ownerCode,
    ];
    if (!rawList.some((x) => x !== undefined && x !== null && String(x).trim() !== '')) {
      rawList.push(doc.assignedTo, doc.owner, doc.ownerName, doc.formData?.owner, doc.formData?.ownerName);
    }
  } else {
    rawList = [
      doc.accountOwner,
      doc.accountOwnerName,
      doc.ownerName,
      doc.owner,
      doc.dealOwner,
      doc.dealOwnerName,
      doc.assignedTo,
      doc.assignedToName,
      doc.customerOwner,
      doc.quotationOwner,
      doc.ownerCode,
      doc.accountOwnerCode,
      doc.formData?.accountOwner,
      doc.formData?.accountOwnerName,
      doc.formData?.ownerName,
      doc.formData?.owner,
      doc.formData?.ownerCode,
      doc.formData?.accountOwnerCode,
      doc.formData?.formData?.accountOwner,
      doc.formData?.formData?.ownerName,
      doc.data?.dealOwner,
      doc.data?.dealOwnerName,
      doc.data?.ownerName,
      doc.data?.owner,
      doc.data?.ownerCode,
      doc.data?.selectedAccountOwner,
      doc.data?.data?.dealOwner,
      doc.data?.quotationOwner,
      doc.data?.customerReference?.owner,
    ];
  }

  rawList.forEach((item) => {
    if (item !== undefined && item !== null && item !== '') {
      const s = String(item).trim().toLowerCase();
      if (s) {
        identities.add(s);
        if (usersMap[s]) identities.add(String(usersMap[s]).trim().toLowerCase());
        if (usersMap._names && usersMap._names[s]) identities.add(String(usersMap._names[s]).trim().toLowerCase());
        if (usersMap._emails && usersMap._emails[s]) identities.add(String(usersMap._emails[s]).trim().toLowerCase());
        if (usersMap._codes && usersMap._codes[s]) identities.add(String(usersMap._codes[s]).trim().toLowerCase());
      }
    }
  });

  return Array.from(identities);
};

async function executeTemplateReport({ template, templateId, filters = [] }) {
  let tpl = template || {};
  const targetId = templateId || template?._id || template?.id;

  if (targetId) {
    try {
      const templateCol = mongoose.connection.db.collection('reporttemplates');
      let dbTpl = await templateCol.findOne({
        $or: [
          ...(mongoose.Types.ObjectId.isValid(targetId) ? [{ _id: new mongoose.Types.ObjectId(String(targetId)) }] : []),
          { id: String(targetId) },
        ],
      }).catch(() => null);

      if (!dbTpl) {
        const reportsCol = mongoose.connection.db.collection('reports');
        dbTpl = await reportsCol.findOne({
          $or: [
            ...(mongoose.Types.ObjectId.isValid(targetId) ? [{ _id: new mongoose.Types.ObjectId(String(targetId)) }] : []),
            { id: String(targetId) },
          ],
        }).catch(() => null);
      }

      if (dbTpl) {
        tpl = { ...dbTpl, ...(template || {}) };
      }
    } catch (_) {}
  }

  const entityType = detectTemplateEntityType(tpl);
  const collectionName = COLLECTION_MAP[entityType] || 'leads';

  let fields = [];
  if (Array.isArray(tpl?.selectedFields) && tpl.selectedFields.length > 0) {
    fields = tpl.selectedFields;
  } else if (Array.isArray(tpl?.displayFields) && tpl.displayFields.length > 0) {
    fields = tpl.displayFields;
  } else {
    fields = DEFAULT_FIELDS[entityType] || DEFAULT_FIELDS.account;
  }

  const usersMap = await getUsersLookupMap();
  const col = mongoose.connection.db.collection(collectionName);
  // Zero companyId filtering - direct collection access
  const rawDocs = await col.find({}).sort({ createdAt: -1 }).toArray();

  // 1. Dynamic Filterization Normalization (Zero Hardcoding)
  const templateFilters = (Array.isArray(tpl?.filters) ? tpl.filters : (Array.isArray(filters) ? filters : []))
    .filter(flt => flt && flt.field && (
      (flt.value !== undefined && flt.value !== null && String(flt.value).trim() !== '') ||
      flt.operator === 'is_empty' ||
      flt.operator === 'is_not_empty'
    ));

  let filteredDocs = rawDocs;

  if (templateFilters.length > 0) {
    filteredDocs = filteredDocs.filter((doc) => {
      return templateFilters.every((flt) => {
        if (!flt.field) return true;
        const docVal = resolveDocumentField(doc, flt.field, usersMap);
        const op = String(flt.operator || 'equals').trim().toLowerCase();
        const targetVal = String(flt.value !== undefined && flt.value !== null ? flt.value : '').trim().toLowerCase();
        const testStr = String(docVal !== undefined && docVal !== null ? docVal : '').trim().toLowerCase();

        if (op === 'equals' || op === 'equal' || op === '=') return testStr === targetVal;
        if (op === 'not_equals' || op === 'not_equal' || op === '!=') return testStr !== targetVal;
        if (op === 'contains') return testStr.includes(targetVal);
        if (op === 'not_contains') return !testStr.includes(targetVal);
        if (op === 'starts_with') return testStr.startsWith(targetVal);
        if (op === 'ends_with') return testStr.endsWith(targetVal);
        if (op === 'is_empty') return docVal === '-' || docVal === '' || docVal === null || docVal === undefined;
        if (op === 'is_not_empty') return docVal !== '-' && docVal !== '' && docVal !== null && docVal !== undefined;
        if (op === '>' || op === 'greater_than') return Number(docVal) > Number(flt.value);
        if (op === '>=' || op === 'greater_than_or_equal') return Number(docVal) >= Number(flt.value);
        if (op === '<' || op === 'less_than') return Number(docVal) < Number(flt.value);
        if (op === '<=' || op === 'less_than_or_equal') return Number(docVal) <= Number(flt.value);
        return true;
      });
    });
  }

  // Universal Owner Filter (Dynamic lookup across users collection - Exact Mail-Wise Matching)
  const rawOwnerInput = String(tpl?.accountOwnerEmail || tpl?.ownerEmail || tpl?.accountOwner || tpl?.owner || tpl?.ownerFilter || 'all').trim();
  const ownerFilter = rawOwnerInput.toLowerCase();
  let targetOwnerEmail = '';
  let targetOwnerName = '';

  if (ownerFilter && ownerFilter !== 'all') {
    // 1. Resolve canonical email directly from usersMap (from users collection)
    if (usersMap._emails && usersMap._emails[ownerFilter]) {
      targetOwnerEmail = usersMap._emails[ownerFilter].toLowerCase().trim();
    } else if (ownerFilter.includes('@')) {
      targetOwnerEmail = ownerFilter;
    }

    if (usersMap[ownerFilter]) {
      targetOwnerName = usersMap[ownerFilter];
      if (!targetOwnerEmail && usersMap._emails && usersMap._emails[String(targetOwnerName).toLowerCase().trim()]) {
        targetOwnerEmail = usersMap._emails[String(targetOwnerName).toLowerCase().trim()].toLowerCase().trim();
      }
    } else if (usersMap._names && usersMap._names[ownerFilter]) {
      targetOwnerName = usersMap._names[ownerFilter];
    } else {
      targetOwnerName = rawOwnerInput;
    }

    if (usersMap._profiles && usersMap._profiles[ownerFilter]) {
      const prof = usersMap._profiles[ownerFilter];
      if (prof.email) targetOwnerEmail = prof.email.toLowerCase().trim();
      if (prof.name) targetOwnerName = prof.name;
    }

    // Build the set of target owner emails (exact mail-wise identification)
    const targetOwnerEmails = new Set();
    if (targetOwnerEmail) targetOwnerEmails.add(targetOwnerEmail);
    if (targetOwnerName && usersMap._emails && usersMap._emails[targetOwnerName.toLowerCase().trim()]) {
      targetOwnerEmails.add(usersMap._emails[targetOwnerName.toLowerCase().trim()].toLowerCase().trim());
    }

    // Build owner identities for exact code or exact name if doc stores owner name/code
    const targetOwnerExactIdentities = new Set([ownerFilter]);
    if (targetOwnerName) targetOwnerExactIdentities.add(targetOwnerName.toLowerCase().trim());
    if (targetOwnerEmail) targetOwnerExactIdentities.add(targetOwnerEmail);
    if (usersMap._codes && usersMap._codes[ownerFilter]) {
      targetOwnerExactIdentities.add(String(usersMap._codes[ownerFilter]).toLowerCase().trim());
    }
    if (targetOwnerName && usersMap._codes && usersMap._codes[targetOwnerName.toLowerCase().trim()]) {
      targetOwnerExactIdentities.add(String(usersMap._codes[targetOwnerName.toLowerCase().trim()]).toLowerCase().trim());
    }

    filteredDocs = filteredDocs.filter((doc) => {
      // 1. Direct Mail-wise match: check if document email or creator email matches target email from users collection
      const docEmailCandidates = [
        doc.userEmail,
        doc.createdUserBy,
        doc.formData?.userEmail,
        doc.formData?.createdUserBy,
        doc.accountOwnerEmail,
        doc.formData?.accountOwnerEmail,
        doc.ownerEmail,
        doc.formData?.ownerEmail,
      ].filter(Boolean).map(e => String(e).trim().toLowerCase());

      if (targetOwnerEmails.size > 0 && docEmailCandidates.some(e => targetOwnerEmails.has(e))) {
        return true;
      }

      // 2. Resolve document's owner via users collection lookup to obtain their canonical mail
      const docRawOwners = [
        doc.accountOwner,
        doc.formData?.accountOwner,
        doc.formData?.formData?.accountOwner,
        doc.ownerName,
        doc.formData?.ownerName,
        doc.owner,
        doc.formData?.owner,
        doc.dealOwner,
        doc.data?.dealOwner,
        doc.dealOwnerName,
        doc.data?.dealOwnerName,
        doc.quotationOwner,
        doc.customerOwner,
        doc.assignedTo,
        doc.assignedToName,
      ].filter(Boolean).map(o => String(o).trim().toLowerCase());

      for (const rawO of docRawOwners) {
        if (targetOwnerExactIdentities.has(rawO)) return true;
        // Resolve this doc owner's email from users collection
        if (usersMap._emails && usersMap._emails[rawO]) {
          const resolvedDocEmail = String(usersMap._emails[rawO]).toLowerCase().trim();
          if (targetOwnerEmails.has(resolvedDocEmail)) return true;
        }
      }

      // 3. Resolve document's owner code via users collection lookup to obtain canonical mail
      const docCodes = [
        doc.ownerCode,
        doc.formData?.ownerCode,
        doc.accountOwnerCode,
        doc.formData?.accountOwnerCode,
        doc.data?.ownerCode,
      ].filter(Boolean).map(c => String(c).trim().toLowerCase());

      for (const code of docCodes) {
        if (targetOwnerExactIdentities.has(code)) return true;
        if (usersMap._emails && usersMap._emails[code]) {
          const resolvedDocEmail = String(usersMap._emails[code]).toLowerCase().trim();
          if (targetOwnerEmails.has(resolvedDocEmail)) return true;
        }
      }

      return false;
    });
  }

  // Keep reference of records that matched owner and filters before applying date window
  const docsBeforeDateFilter = [...filteredDocs];
  let dateFilterFellBack = false;
  let dateMatchedCount = null;

  // Universal Date Range Filtering (Using parseDateTimestamp for ISO, YYYY-MM-DD, and DD/MM/YYYY)
  const rawFrom = tpl?.recordDateFrom || tpl?.dateRange?.fromDate || tpl?.fromDate || '';
  const rawTo = tpl?.recordDateTo || tpl?.dateRange?.toDate || tpl?.toDate || '';
  if (rawFrom || rawTo) {
    const fromTime = rawFrom ? parseDateTimestamp(rawFrom) : null;
    let toTime = rawTo ? parseDateTimestamp(rawTo) : null;
    if (toTime !== null) {
      const toObj = new Date(toTime);
      toObj.setHours(23, 59, 59, 999);
      toTime = toObj.getTime();
    }

    const dateFiltered = filteredDocs.filter((doc) => {
      let rawDateVal = null;
      if (entityType === 'account') {
        rawDateVal = doc.accountDate || doc.formData?.accountDate || doc.formData?.formData?.accountDate || doc.date || doc.createdAt;
      } else if (entityType === 'deal') {
        rawDateVal = doc.dealDate || doc.data?.dealDate || doc.data?.data?.dealDate || doc.data?.convertedAt || doc.formData?.dealDate || doc.quotationDate || doc.createdAt;
      } else if (entityType === 'customer') {
        rawDateVal = doc.createdAt || doc.addedDate || doc.date;
      } else if (entityType === 'quotation') {
        rawDateVal = doc.quotationDate || doc.data?.quotationDate || doc.data?.customerReference?.date || doc.date || doc.createdAt;
      } else {
        rawDateVal = doc.date || doc.createdAt;
      }

      if (!rawDateVal) return false;
      const docTime = parseDateTimestamp(rawDateVal);
      if (docTime === null) return false;

      if (fromTime !== null && docTime < fromTime) return false;
      if (toTime !== null && docTime > toTime) return false;
      return true;
    });

    dateMatchedCount = dateFiltered.length;

    // Strict Date Range Filtering: Do not fall back to dumping all historical records unless explicitly configured
    if (dateFiltered.length === 0 && docsBeforeDateFilter.length > 0 && tpl?.autoFallback === true) {
      filteredDocs = docsBeforeDateFilter;
      dateFilterFellBack = true;
    } else {
      filteredDocs = dateFiltered;
    }
  }

  // Field Labels Mapping
  let labelDict = ACCOUNT_FIELD_LABELS;
  if (entityType === 'deal') labelDict = DEAL_FIELD_LABELS;
  else if (entityType === 'customer') labelDict = CUSTOMER_FIELD_LABELS;
  else if (entityType === 'quotation') labelDict = QUOTATION_FIELD_LABELS;

  const fieldLabels = fields.map((f, idx) => {
    if (typeof f === 'object' && (f.label || f.key)) return f.label || f.key;
    const strKey = String(f);
    if (Array.isArray(tpl?.layoutOrder) && tpl.layoutOrder[idx]) {
      return tpl.layoutOrder[idx];
    }
    return labelDict[strKey] || strKey;
  });

  const rows = filteredDocs.map((doc) => {
    const rowObj = {};
    fields.forEach((fieldIdentifier, idx) => {
      const rawKey = typeof fieldIdentifier === 'object' ? (fieldIdentifier.key || fieldIdentifier.label) : String(fieldIdentifier);
      const displayLabel = fieldLabels[idx] || rawKey;
      const resolvedVal = resolveDocumentField(doc, fieldIdentifier, usersMap);
      const finalVal = resolvedVal !== undefined && resolvedVal !== null ? resolvedVal : '-';

      // Set both the human label and the raw key so whatever key is requested, it matches!
      rowObj[displayLabel] = finalVal;
      rowObj[rawKey] = finalVal;
    });

    // Attach identifiers for deduplication and client processing
    rowObj._id = doc._id ? String(doc._id) : undefined;
    rowObj['Account No.'] = rowObj['Account No.'] || rowObj['Account No'] || doc.accountNumber || doc.accountNo || doc.formData?.accountNumber || doc.formData?.accountNo;
    rowObj['Deal No.'] = rowObj['Deal No.'] || rowObj['Deal No'] || doc.dealNumber || doc.data?.dealNumber;
    rowObj['Quotation No.'] = rowObj['Quotation No.'] || rowObj['Quotation No'] || doc.quotationNumber || doc.data?.quotationNumber;
    rowObj['Customer No.'] = rowObj['Customer No.'] || rowObj['Customer No'] || doc.customerNumber || doc.formData?.customerNumber;

    return rowObj;
  });

  const reportTitle = tpl?.reportName || tpl?.title || tpl?.name || 'Report';

  return {
    template: tpl,
    entityType,
    collectionName,
    selectedFields: fields,
    fieldLabels,
    rows,
    totalRecords: rows.length,
    reportTitle,
    ownerEmail: targetOwnerEmail || tpl?.accountOwnerEmail || '',
    ownerName: targetOwnerName || tpl?.accountOwner || tpl?.owner || tpl?.ownerFilter || '',
    dateFilterFellBack,
    dateMatchedCount,
    ownerMatchedCount: docsBeforeDateFilter.length,
    collectionRecordsCount: rawDocs.length,
  };
}

function generateTemplateExcelBuffer({ reportTitle, fieldLabels, rows }) {
  const workbook = XLSX.utils.book_new();
  const rowsForSheet = rows.length > 0 ? rows : [{ 'Report Status': 'No records found matching report criteria' }];
  const keys = fieldLabels && fieldLabels.length > 0 ? fieldLabels : Object.keys(rowsForSheet[0] || {});
  const worksheet = XLSX.utils.json_to_sheet(rowsForSheet, { header: keys });

  worksheet['!cols'] = keys.map(key => {
    let maxLen = key.length;
    rowsForSheet.slice(0, 100).forEach(r => {
      const v = String(r[key] ?? '');
      if (v.length > maxLen) maxLen = v.length;
    });
    return { wch: Math.min(Math.max(maxLen + 3, 14), 50) };
  });

  const cleanSheetName = String(reportTitle).substring(0, 31).replace(/[:\\/?*[\]]/g, '_');
  XLSX.utils.book_append_sheet(workbook, worksheet, cleanSheetName);

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const fileName = String(reportTitle).replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';

  return { buffer, fileName, recordCount: rows.length };
}

module.exports = {
  executeTemplateReport,
  generateTemplateExcelBuffer,
  getUsersLookupMap,

  generateCustomReportExcelBuffer,
  ACCOUNT_FIELD_LABELS,
  DEAL_FIELD_LABELS,
  CUSTOMER_FIELD_LABELS,
  QUOTATION_FIELD_LABELS,
};
