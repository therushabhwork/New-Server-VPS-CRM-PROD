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

const mapDealDoc = (doc) => {
  const rawNo = doc.dealNumber || doc.id || '-';
  const rawName = doc.dealName || doc.name || doc.title || '-';
  const rawOwner = doc.dealOwnerName || doc.dealOwner || doc.ownerName || doc.owner || '-';
  const rawDate = formatDate(doc.dealDate || doc.quotationDate || doc.createdAt);
  const rawValue = doc.dealValue || doc.value || doc.amount || '-';

  return {
    ...doc,
    dealNumber: rawNo,
    id: rawNo,
    dealName: rawName,
    name: rawName,
    title: rawName,
    dealDate: rawDate,
    date: rawDate,
    dealOwner: rawOwner,
    dealOwnerName: rawOwner,
    owner: rawOwner,
    dealType: doc.dealType || doc.stage || '-',
    stage: doc.stage || doc.dealType || '-',
    status: doc.status || doc.stage || '-',
    dealStatus: doc.status || doc.stage || '-',
    dealValue: rawValue,
    value: rawValue,
    amount: rawValue,
    customerName: doc.customerName || doc.name || '-',
    projectName: doc.projectName || doc.project || '-',
    project: doc.projectName || doc.project || '-',
    consultantName: doc.consultantName || '-',
    expectedCloseDate: formatDate(doc.expectedCloseDate),
    expectedClosureDate: formatDate(doc.expectedClosureDate || doc.expectedCloseDate),
    poValue: doc.poValue || '-',
    addedOn: formatDate(doc.addedOn),
    createdAt: formatDate(doc.createdAt),
  };
};

const mapCustomerDoc = (doc) => {
  const rawNo = doc.customerNumber || doc.customerNo || doc.id || '-';
  const rawName = doc.customerName || doc.name || '-';
  const rawOwner = doc.assignedToName || doc.ownerName || doc.owner || doc.customerOwner || '-';

  return {
    ...doc,
    customerNumber: rawNo,
    customerNo: rawNo,
    id: rawNo,
    customerName: rawName,
    name: rawName,
    company: doc.company || doc.companyName || '-',
    companyName: doc.company || doc.companyName || '-',
    city: doc.city || doc.location || '-',
    location: doc.city || doc.location || '-',
    phone: doc.phone || doc.mobile || '-',
    mobile: doc.phone || doc.mobile || '-',
    email: doc.email || '-',
    status: doc.status || '-',
    customerStatus: doc.status || '-',
    customerCategory: doc.customerCategory || doc.category || '-',
    customerType: doc.customerType || '-',
    assignedTo: rawOwner,
    assignedToName: rawOwner,
    customerOwner: rawOwner,
    owner: rawOwner,
    contactPerson: doc.contactPerson || '-',
    state: doc.state || '-',
    industryType: doc.industryType || '-',
    createdAt: formatDate(doc.createdAt),
  };
};

const mapQuotationDoc = (doc) => {
  const rawNo = doc.quotationNo || doc.quotationNumber || doc.id || '-';
  const rawDate = formatDate(doc.date || doc.quotationDate || doc.createdAt);
  const rawAccount = doc.accountName || doc.customerName || doc.name || '-';
  const rawDeal = doc.dealName || doc.title || '-';
  const rawTotal = doc.grandTotal || doc.total || doc.amount || '-';

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
    status: doc.status || '-',
    quotationStatus: doc.status || '-',
    quotationOwner: doc.quotationOwner || doc.owner || '-',
    projectName: doc.projectName || doc.project || '-',
    validUntil: formatDate(doc.validUntil),
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
  try {
    const col = mongoose.connection.db.collection('users');
    const users = await col.find({}, {
      projection: { name: 1, username: 1, ownerCode: 1, owner_code: 1, email: 1, employeeId: 1, legacyId: 1 }
    }).toArray();
    users.forEach(u => {
      const displayName = u.name || u.username || u.email;
      if (!displayName) return;
      if (u._id) map[String(u._id).toLowerCase()] = displayName;
      if (u.legacyId) map[String(u.legacyId).toLowerCase()] = displayName;
      if (u.username) map[String(u.username).toLowerCase()] = displayName;
      if (u.name) map[String(u.name).toLowerCase()] = displayName;
      if (u.email) map[String(u.email).toLowerCase()] = displayName;
      if (u.ownerCode) map[String(u.ownerCode).toLowerCase()] = displayName;
      if (u.owner_code) map[String(u.owner_code).toLowerCase()] = displayName;
      if (u.employeeId) map[String(u.employeeId).toLowerCase()] = displayName;
    });
  } catch (_) {}
  return map;
}

async function executeTemplateReport({ template, templateId, filters = [], companyId }) {
  let tpl = template;
  if (!tpl && templateId) {
    try {
      const templateCol = mongoose.connection.db.collection('reporttemplates');
      tpl = await templateCol.findOne({
        $or: [
          ...(mongoose.Types.ObjectId.isValid(templateId) ? [{ _id: new mongoose.Types.ObjectId(String(templateId)) }] : []),
          { id: String(templateId) },
        ],
      }).catch(() => null);

      if (!tpl) {
        const reportsCol = mongoose.connection.db.collection('reports');
        tpl = await reportsCol.findOne({
          $or: [
            ...(mongoose.Types.ObjectId.isValid(templateId) ? [{ _id: new mongoose.Types.ObjectId(String(templateId)) }] : []),
            { id: String(templateId) },
          ],
        }).catch(() => null);
      }
    } catch (_) {}
  }

  let rawEntity = String(
    tpl?.entityType ||
    tpl?.categoryKey ||
    tpl?.reportContext ||
    'account'
  ).toLowerCase().trim();

  if (rawEntity === 'accounts' || rawEntity === 'lead' || rawEntity === 'leads') rawEntity = 'account';
  if (rawEntity === 'deals') rawEntity = 'deal';
  if (rawEntity === 'customers') rawEntity = 'customer';
  if (rawEntity === 'quotations') rawEntity = 'quotation';
  if (rawEntity === 'users') rawEntity = 'user';

  const entityType = rawEntity;
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
  const query = {};
  if (companyId) {
    query.companyId = companyId;
  }
  const rawDocs = await col.find(query).sort({ createdAt: -1 }).toArray();

  const templateFilters = Array.isArray(tpl?.filters) ? tpl.filters : (Array.isArray(filters) ? filters : []);
  let filteredDocs = rawDocs;

  if (templateFilters.length > 0) {
    filteredDocs = filteredDocs.filter(doc => {
      return templateFilters.every(flt => {
        if (!flt.field) return true;
        const docVal = resolveDocumentField(doc, flt.field, usersMap);
        const op = flt.operator || 'equals';
        const targetVal = String(flt.value || '').trim().toLowerCase();
        const testStr = String(docVal || '').trim().toLowerCase();

        if (op === 'equals' || op === 'equal') return testStr === targetVal;
        if (op === 'not_equals' || op === 'not_equal') return testStr !== targetVal;
        if (op === 'contains') return testStr.includes(targetVal);
        if (op === 'not_contains') return !testStr.includes(targetVal);
        if (op === 'starts_with') return testStr.startsWith(targetVal);
        if (op === 'ends_with') return testStr.endsWith(targetVal);
        if (op === 'is_empty') return docVal === '-' || docVal === '' || docVal === null || docVal === undefined;
        if (op === 'is_not_empty') return docVal !== '-' && docVal !== '' && docVal !== null && docVal !== undefined;
        return true;
      });
    });
  }

  // Universal Date Range Filtering (Dual Mode: string YYYY-MM-DD + ISO UTC Date bounds)
  const rawFrom = tpl?.recordDateFrom || tpl?.dateRange?.fromDate || tpl?.fromDate || '';
  const rawTo = tpl?.recordDateTo || tpl?.dateRange?.toDate || tpl?.toDate || '';
  if (rawFrom || rawTo) {
    const fromStr = rawFrom ? String(rawFrom).slice(0, 10) : '';
    const toStr = rawTo ? String(rawTo).slice(0, 10) : '';
    let fromDate = null;
    let toDate = null;
    if (fromStr) {
      fromDate = new Date(fromStr);
      fromDate.setUTCHours(0, 0, 0, 0);
    }
    if (toStr) {
      toDate = new Date(toStr);
      toDate.setUTCHours(23, 59, 59, 999);
    }

    filteredDocs = filteredDocs.filter((doc) => {
      let rawDateVal = null;
      if (entityType === 'account') {
        rawDateVal = doc.accountDate || doc.formData?.accountDate || doc.date || doc.createdAt;
      } else if (entityType === 'deal') {
        rawDateVal = doc.dealDate || doc.data?.dealDate || doc.quotationDate || doc.createdAt;
      } else if (entityType === 'customer') {
        rawDateVal = doc.createdAt || doc.addedDate;
      } else if (entityType === 'quotation') {
        rawDateVal = doc.quotationDate || doc.data?.quotationDate || doc.date || doc.createdAt;
      } else {
        rawDateVal = doc.date || doc.createdAt;
      }

      if (!rawDateVal) return false;
      const strVal = String(rawDateVal).slice(0, 10);
      const dateObj = new Date(rawDateVal);
      const hasValidDate = !Number.isNaN(dateObj.getTime());

      if (fromStr && toStr) {
        const inStrRange = strVal >= fromStr && strVal <= toStr;
        const inDateRange = hasValidDate && dateObj >= fromDate && dateObj <= toDate;
        return inStrRange || inDateRange;
      } else if (fromStr) {
        const afterStr = strVal >= fromStr;
        const afterDate = hasValidDate && dateObj >= fromDate;
        return afterStr || afterDate;
      } else if (toStr) {
        const beforeStr = strVal <= toStr;
        const beforeDate = hasValidDate && dateObj <= toDate;
        return beforeStr || beforeDate;
      }
      return true;
    });
  }

  // Universal Owner Filter
  const ownerFilter = String(tpl?.accountOwner || tpl?.owner || 'all').trim().toLowerCase();
  if (ownerFilter && ownerFilter !== 'all') {
    filteredDocs = filteredDocs.filter((doc) => {
      const ownerVal = resolveDocumentField(doc, 'owner', usersMap);
      const docOwners = [
        ownerVal,
        doc.accountOwnerName,
        doc.accountOwner,
        doc.ownerName,
        doc.owner,
        doc.formData?.accountOwner,
        doc.formData?.owner,
        doc.formData?.accountOwnerName,
        doc.dealOwnerName,
        doc.dealOwner,
        doc.assignedToName,
        doc.assignedTo,
        doc.customerOwner,
        doc.quotationOwner,
        doc.ownerCode,
        doc.formData?.ownerCode,
      ].filter(Boolean).map((o) => String(o).trim().toLowerCase());

      return docOwners.some((o) => o === ownerFilter || o.includes(ownerFilter) || ownerFilter.includes(o));
    });
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
  };
}

function generateTemplateExcelBuffer({ reportTitle, fieldLabels, rows }) {
  const workbook = XLSX.utils.book_new();
  const rowsForSheet = rows.length > 0 ? rows : [{ 'Report Status': 'No records found matching report criteria' }];
  const worksheet = XLSX.utils.json_to_sheet(rowsForSheet);

  const keys = fieldLabels && fieldLabels.length > 0 ? fieldLabels : Object.keys(rowsForSheet[0] || {});
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
