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
const path = require('path');
const fs = require('fs');
const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable').default || require('jspdf-autotable').autoTable || require('jspdf-autotable');
const { buildXlsxBytes } = require('../utils/excelExportHelper');

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
  if (typeof val === 'string') {
    const trimmed = val.trim();
    const ddmmyyyy = trimmed.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (ddmmyyyy) {
      return `${ddmmyyyy[1]}-${ddmmyyyy[2]}-${ddmmyyyy[3]}`;
    }
    const yyyymmdd = trimmed.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (yyyymmdd) {
      return `${yyyymmdd[3]}-${yyyymmdd[2]}-${yyyymmdd[1]}`;
    }
  }
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

const formatAccountStatus = (status) => {
  if (!status || status === '-') return '-';
  const s = String(status).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (s === 'priority_1') return 'Priority 1';
  if (s === 'priority_2') return 'Priority 2';
  if (s === 'priority_3') return 'Priority 3';
  if (s === 'technical_offer') return 'Technical Offer';
  if (s === 'commercial_offer') return 'Commercial Offer';
  if (s === 'quotation_sent') return 'Quotation Sent';
  if (s === 'quote_revision') return 'Quotation Revision';
  if (s === 'convert_to_po' || s === 'po_converted') return 'Convert To PO';
  if (s === 'order_won') return 'Order Won';
  if (s === 'order_lost') return 'Order Lost';
  if (s === 'not_quoted') return 'Not Quoted';
  if (s === 'pending') return 'Pending';
  if (s === 'new') return 'New';
  if (s === 'rejected') return 'Rejected';
  return String(status);
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

  // DD-MM-YYYY or DD/MM/YYYY (with optional time) - Indian standard CRM date
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    const y = parseInt(dmyMatch[3], 10);
    const hr = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const dateObj = new Date(y, m, d, hr, min, sec, 0);
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
  const rawOwner = doc.accountOwnerName
    || doc.accountOwner
    || doc.ownerName
    || doc.owner
    || doc.formData?.['Account Owner']
    || doc.formData?.accountOwner
    || doc.ownerCode
    || '-';
  const rawDate = formatDate(doc.accountDate || doc.date || doc.createdAt);
  const rawStatus = formatAccountStatus(doc.stage || doc.status || doc.accountStatus || doc.formData?.accountStatus || doc.formData?.status || '-');
  const rawProject = doc.projectName
    || doc.project
    || doc.formData?.['Project Name']
    || doc.formData?.projectName
    || doc.formData?.['Project']
    || doc.formData?.project
    || doc.data?.projectName
    || doc.data?.project
    || '-';

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
    stage: doc.stage || rawStatus,
    projectName: rawProject,
    project: rawProject,
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
      const orConditions = [{ id: String(config.templateId) }];
      if (mongoose.Types.ObjectId.isValid(String(config.templateId))) {
        orConditions.unshift({ _id: new mongoose.Types.ObjectId(String(config.templateId)) });
      }
      template = await templateCol.findOne({ $or: orConditions }).catch(() => null);

      if (!template) {
        // Fallback to generated reports collection
        const reportsCol = mongoose.connection.db.collection('reports');
        template = await reportsCol.findOne({ $or: orConditions }).catch(() => null);
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
  if (entityType === 'deal') labelDict = DEAL_FIELD_LABELS;
  else if (entityType === 'customer') labelDict = CUSTOMER_FIELD_LABELS;
  else if (entityType === 'quotation') labelDict = QUOTATION_FIELD_LABELS;

  // 5. Construct fullTemplate combining template and schedule config
  const reportTitle = template?.reportName || template?.name || config.reportName || scheduledReport.name || 'Report';
  const fullTemplate = {
    ...template,
    ...config,
    entityType,
    reportName: reportTitle,
    userGroups: (Array.isArray(config.userGroups) && config.userGroups.length > 0)
      ? config.userGroups
      : (Array.isArray(template?.userGroups) ? template.userGroups : (template?.selectedUserGroups || [])),
    selectedUserGroups: (Array.isArray(config.selectedUserGroups) && config.selectedUserGroups.length > 0)
      ? config.selectedUserGroups
      : (Array.isArray(template?.selectedUserGroups) ? template.selectedUserGroups : (template?.userGroups || [])),
    userGroupMembers: (Array.isArray(config.userGroupMembers) && config.userGroupMembers.length > 0)
      ? config.userGroupMembers
      : (Array.isArray(template?.userGroupMembers) ? template.userGroupMembers : []),
    accountOwner: config.accountOwner || template?.accountOwner || 'all',
    recordDateFrom: config.recordDateFrom || template?.recordDateFrom || config.customStartDate || '',
    recordDateTo: config.recordDateTo || template?.recordDateTo || config.customEndDate || '',
    displayFields: fields,
    selectedFields: fields,
  };

  // 6. Execute report using executeTemplateReport for 100% parity with /admin/reports/custom
  let reportResult = null;
  try {
    reportResult = await executeTemplateReport({ template: fullTemplate });
  } catch (err) {
    console.error('[customReportEngine] executeTemplateReport error in schedule:', err);
  }

  const rawRows = reportResult?.rows || [];
  const fieldLabels = reportResult?.fieldLabels || labelDict;
  const selectedFields = (reportResult?.selectedFields && reportResult.selectedFields.length > 0)
    ? reportResult.selectedFields
    : fields;

  const formatTitleCase = (str) => {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const columns = selectedFields.map((k) => ({
    key: k,
    label: fieldLabels[k] || labelDict[k] || k,
    rawKey: k,
  }));

  // Canonical deduplication ensuring 100% zero repeated rows matching CustomReportsPage.jsx
  const getCanonicalRecordKey = (row) => {
    if (entityType === 'deal') {
      const dealNo = String(row['Deal No.'] || row['Deal No'] || row.dealNumber || '').trim().toUpperCase();
      if (dealNo && dealNo !== '-' && dealNo !== 'UNDEFINED' && dealNo !== 'NULL') return `DEAL:${dealNo}`;
      const id = String(row._id || row.id || '').trim();
      if (id && id !== '-' && id !== 'UNDEFINED') return `ID:${id}`;
    } else if (entityType === 'quotation') {
      const qNo = String(row['Quotation No.'] || row['Quotation No'] || row.quotationNumber || row.quoteNumber || '').trim().toUpperCase();
      if (qNo && qNo !== '-' && qNo !== 'UNDEFINED' && qNo !== 'NULL') return `QUOTE:${qNo}`;
      const id = String(row._id || row.id || '').trim();
      if (id && id !== '-' && id !== 'UNDEFINED') return `ID:${id}`;
    } else if (entityType === 'customer') {
      const custNo = String(row['Customer No.'] || row['Customer No'] || row.customerNumber || '').trim().toUpperCase();
      if (custNo && custNo !== '-' && custNo !== 'UNDEFINED' && custNo !== 'NULL') return `CUST:${custNo}`;
      const id = String(row._id || row.id || '').trim();
      if (id && id !== '-' && id !== 'UNDEFINED') return `ID:${id}`;
    } else if (entityType === 'account') {
      const id = String(row._id || row.id || row.legacyId || '').trim();
      if (id && id !== '-' && id !== 'UNDEFINED' && id !== 'NULL') return `ACC_ID:${id}`;
      const accNo = String(
        row['Account No.'] || row['Account No'] || row.accountNumber || row.accountNo || ''
      ).trim().toUpperCase();
      const projName = String(row['Project Name'] || row.projectName || row.project || '').trim();
      const rawDate = row['Account Date'] || row.accountDate || row.date || row.createdAt || '';
      const stage = String(row.stage || row.status || row.accountStatus || '').trim().toLowerCase();
      if (accNo && accNo !== '-' && accNo !== 'UNDEFINED' && accNo !== 'NULL') {
        return `ACC:${accNo}|PROJ:${projName}|DATE:${rawDate}|STAGE:${stage}`;
      }
      return `ACC_PROJ:${projName}|DATE:${rawDate}|STAGE:${stage}`;
    } else {
      const dealNo = String(row['Deal No.'] || row['Deal No'] || row.dealNumber || '').trim().toUpperCase();
      if (dealNo && dealNo !== '-' && dealNo !== 'UNDEFINED' && dealNo !== 'NULL') return `DEAL:${dealNo}`;
      const qNo = String(row['Quotation No.'] || row['Quotation No'] || row.quotationNumber || row.quoteNumber || '').trim().toUpperCase();
      if (qNo && qNo !== '-' && qNo !== 'UNDEFINED' && qNo !== 'NULL') return `QUOTE:${qNo}`;
      const custNo = String(row['Customer No.'] || row['Customer No'] || row.customerNumber || '').trim().toUpperCase();
      if (custNo && custNo !== '-' && custNo !== 'UNDEFINED' && custNo !== 'NULL') return `CUST:${custNo}`;
      const accNo = String(
        row['Account No.'] || row['Account No'] || row.accountNumber || row.accountNo || ''
      ).trim().toUpperCase();
      if (accNo && accNo !== '-' && accNo !== 'UNDEFINED' && accNo !== 'NULL') return `ACC:${accNo}`;
      const id = String(row._id || row.id || '').trim();
      if (id && id !== '-' && id !== 'UNDEFINED') return `ID:${id}`;
    }
    return JSON.stringify(row);
  };

  const seenRowKeys = new Set();
  const dedupedDataSets = [];
  rawRows.forEach((row, idx) => {
    const rowKey = getCanonicalRecordKey(row) || `row-idx-${idx}`;
    if (!seenRowKeys.has(rowKey)) {
      seenRowKeys.add(rowKey);
      dedupedDataSets.push(row);
    }
  });

  // Resolve row owner across all entity types (Deals, Quotations, Customers, Accounts)
  const resolveRowOwner = (row) => {
    const val = row['Account Owner'] || row.accountOwner || row.ownerName || row.owner || row._ownerName ||
      row['Deal Owner'] || row.dealOwner || row['Quotation Owner'] || row.quotationOwner ||
      row['Customer Owner'] || row.customerOwner || '';
    const trimmed = String(val || 'Unassigned').trim() || 'Unassigned';
    return trimmed.toLowerCase() === 'unassigned' ? 'Unassigned' : formatTitleCase(trimmed);
  };

  // 7. Group rows owner-wise
  const targetOwner = String(fullTemplate.accountOwner || 'all').trim().toLowerCase();
  const ownerGroups = {};
  dedupedDataSets.forEach((r) => {
    const o = resolveRowOwner(r);
    if (!ownerGroups[o]) ownerGroups[o] = [];
    ownerGroups[o].push(r);
  });

  const reportGroups = (
    Array.isArray(fullTemplate.userGroups) && fullTemplate.userGroups.length > 0
      ? fullTemplate.userGroups
      : (Array.isArray(fullTemplate.selectedUserGroups) ? fullTemplate.selectedUserGroups : [])
  ).filter(Boolean);

  let groupMemberNamesLower = new Set();
  if (reportGroups.length > 0) {
    try {
      const { listMembersByGroupIds } = require('../repositories/userGroupRepository');
      const groupMembers = await listMembersByGroupIds(reportGroups);
      const embeddedMembers = Array.isArray(fullTemplate.userGroupMembers) ? fullTemplate.userGroupMembers : [];
      const allMembers = [...(groupMembers || []), ...embeddedMembers];
      groupMemberNamesLower = new Set(
        allMembers.map(m => String(m.name || m.member?.name || '').toLowerCase().trim()).filter(Boolean)
      );
    } catch (_) {}
  }

  const primaryTargetOwner = targetOwner && targetOwner !== 'all' ? targetOwner : '';

  const checkIsReassigned = (ownerName) => {
    const lower = String(ownerName || '').toLowerCase().trim();
    if (reportGroups.length > 0 && groupMemberNamesLower.size > 0) {
      return !groupMemberNamesLower.has(lower);
    }
    return Boolean(primaryTargetOwner && primaryTargetOwner !== 'all' && lower !== primaryTargetOwner);
  };

  let usersLookup = null;
  try {
    usersLookup = await getUsersLookupMap();
  } catch (_) {}

  // Resolve creator/original owner across Accounts, Deals, Quotations, and Customers strictly within scheduler
  const resolveRowCreator = (row) => {
    let cand = row._createdByUserName || row.createdByUserName || row.createdByName || row.creatorName ||
      row.addedBy || row['Added By'] || row['Created By'] || row.preparedBy || row['Prepared By'] || '';
    if (!cand && row.createdBy && usersLookup) {
      const idOrEmail = String(row.createdBy).trim();
      cand = usersLookup[idOrEmail] || usersLookup._codes?.[idOrEmail] ||
        (usersLookup._emails && Object.keys(usersLookup._emails).find(n => usersLookup._emails[n] === idOrEmail.toLowerCase())) || '';
    }
    if (!cand && (row._createdUserBy || row.createdUserBy || row.userEmail) && usersLookup?._emails) {
      const email = String(row._createdUserBy || row.createdUserBy || row.userEmail).trim().toLowerCase();
      cand = Object.keys(usersLookup._emails).find(n => usersLookup._emails[n] === email) || '';
    }
    if (cand && typeof cand === 'string' && cand.trim() && cand !== '-') {
      return formatTitleCase(cand.trim());
    }
    return '';
  };

  const sortedOwnerNames = Object.keys(ownerGroups).sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();

    const aIsReassigned = checkIsReassigned(a);
    const bIsReassigned = checkIsReassigned(b);

    if (!aIsReassigned && bIsReassigned) return -1;
    if (aIsReassigned && !bIsReassigned) return 1;

    if (primaryTargetOwner && primaryTargetOwner !== 'all') {
      if (aLower === primaryTargetOwner) return -1;
      if (bLower === primaryTargetOwner) return 1;
    }
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });

  const entityName = formatTitleCase(entityType || 'Account');
  const entityPlural = entityName === 'Customer' ? 'Customers' : entityName === 'Deal' ? 'Deals' : entityName === 'Quotation' ? 'Quotations' : 'Accounts';

  const filterSummary = `Total Unique Records: ${dedupedDataSets.length} | Generated: ${new Date().toLocaleDateString('en-IN')}`;

  // Helper to resolve cell values case-insensitively and normalize dates matching CustomReportsPage.jsx
  const resolveExportCell = (row, col) => {
    if (!row || !col) return '-';
    const candidates = [
      row[col.label],
      row[col.key],
      col.rawKey ? row[col.rawKey] : undefined,
      col.label ? row[String(col.label).toLowerCase()] : undefined,
      col.key ? row[String(col.key).toLowerCase()] : undefined,
      col.rawKey ? row[String(col.rawKey).toLowerCase()] : undefined,
      col.label ? row[String(col.label).toLowerCase().replace(/[^a-z0-9]/g, '')] : undefined,
      col.key ? row[String(col.key).toLowerCase().replace(/[^a-z0-9]/g, '')] : undefined,
      col.rawKey ? row[String(col.rawKey).toLowerCase().replace(/[^a-z0-9]/g, '')] : undefined,
    ];
    const isOwnerCol = /owner|assigned|createdby|addedby/i.test(String(col.label || col.key || col.rawKey || ''));
    for (const cand of candidates) {
      if (cand !== undefined && cand !== null && cand !== '') {
        if (typeof cand === 'string' && /^\d{4}-\d{2}-\d{2}/.test(cand)) {
          const parts = cand.slice(0, 10).split('-');
          if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        const strVal = String(cand).trim();
        if (isOwnerCol && strVal && strVal !== '-' && strVal.toLowerCase() !== 'unassigned') {
          return formatTitleCase(strVal);
        }
        return strVal;
      }
    }
    return '-';
  };

  // 8. Generate PDF Buffer with Centered Swati Logo and Grouped Tables
  let pdfBuffer = null;
  try {
    const doc = new jsPDF('landscape');
    let logoPath = path.resolve(__dirname, '../../src/assets/swati-logo.png');
    if (!fs.existsSync(logoPath)) {
      logoPath = path.resolve(__dirname, '../../public/swati-logo.png');
    }

    let logoRendered = false;
    let logoBottomY = 8;
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      let naturalWidth = 412;
      let naturalHeight = 413;
      if (logoBuffer.length >= 24 && logoBuffer.toString('ascii', 12, 16) === 'IHDR') {
        naturalWidth = logoBuffer.readUInt32BE(16) || 412;
        naturalHeight = logoBuffer.readUInt32BE(20) || 413;
      }
      const aspectRatio = naturalHeight > 0 ? (naturalWidth / naturalHeight) : 1;
      const logoHeight = 22;
      const logoWidth = Number((logoHeight * aspectRatio).toFixed(2));
      const logoX = (297 - logoWidth) / 2;
      const logoY = 6.0;
      doc.addImage('data:image/png;base64,' + logoBuffer.toString('base64'), 'PNG', logoX, logoY, logoWidth, logoHeight);
      logoRendered = true;
      logoBottomY = logoY + logoHeight;
    }

    const titleY = logoRendered ? (logoBottomY + 4.5) : 14;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(reportTitle, 148.5, titleY, { align: 'center' });

    const subY = titleY + 4.5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(filterSummary, 148.5, subY, { align: 'center' });

    const dividerY = subY + 4.0;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, dividerY, 283, dividerY);

    let currentY = dividerY + 5.5;
    const colKeys = columns.map(c => c.key);
    const colLabels = columns.map(c => c.label);

    sortedOwnerNames.forEach((ownerName) => {
      const groupRows = ownerGroups[ownerName] || [];
      const isReassigned = checkIsReassigned(ownerName);

      const distinctFromNames = Array.from(
        new Set(
          groupRows
            .map((r) => resolveRowCreator(r))
            .filter((n) => n && n.toLowerCase() !== ownerName.toLowerCase())
        )
      );

      const fromSuffix = isReassigned
        ? (distinctFromNames.length > 0
          ? ` From ${distinctFromNames.join(', ')}`
          : (primaryTargetOwner && primaryTargetOwner !== 'all' && primaryTargetOwner !== ownerName.toLowerCase()
            ? ` From ${formatTitleCase(primaryTargetOwner)}`
            : ''))
        : '';

      const headerLabel = isReassigned
        ? `Re-assigned ${entityName} Owner: ${ownerName} (${groupRows.length} ${entityPlural})${fromSuffix}`
        : `${entityName} Owner: ${ownerName} (${groupRows.length} ${entityPlural})`;

      if (currentY > 185) {
        doc.addPage();
        currentY = 16;
      }

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      if (isReassigned) {
        doc.setTextColor(180, 83, 9);
      } else {
        doc.setTextColor(198, 0, 22);
      }
      doc.text(headerLabel, 14, currentY);
      currentY += 4;

      const tableHead = [columns.map((c) => c.label)];
      const tableBody = groupRows.map((row) =>
        columns.map((c) => resolveExportCell(row, c))
      );

      autoTable(doc, {
        head: tableHead,
        body: tableBody,
        startY: currentY,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
        headStyles: {
          fillColor: isReassigned ? [71, 85, 105] : [45, 55, 72],
          textColor: 255,
          fontStyle: 'bold',
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 },
      });

      currentY = (doc.lastAutoTable?.finalY || currentY + 25) + 8;
    });

    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('Swati Switchgears CRM — Confidential & Proprietary Report', 14, 203);
      doc.text(`Page ${i} of ${totalPages}`, 283, 203, { align: 'right' });
    }

    pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  } catch (pdfErr) {
    console.error('[customReportEngine] PDF generation error:', pdfErr);
  }

  // 9. Generate Excel Workbook Buffer with Top Bar & Spaced Owner Headers matching CustomReportsPage.jsx
  const excelRows = [];
  sortedOwnerNames.forEach((ownerName) => {
    const groupRows = ownerGroups[ownerName] || [];
    const isReassigned = checkIsReassigned(ownerName);

    const distinctFromNames = Array.from(
      new Set(
        groupRows
          .map((r) => resolveRowCreator(r))
          .filter((n) => n && n.toLowerCase() !== ownerName.toLowerCase())
      )
    );

    const fromSuffix = isReassigned
      ? (distinctFromNames.length > 0
        ? ` From ${distinctFromNames.join(', ')}`
        : (primaryTargetOwner && primaryTargetOwner !== 'all' && primaryTargetOwner !== ownerName.toLowerCase()
          ? ` From ${formatTitleCase(primaryTargetOwner)}`
          : ''))
      : '';

    // Insert empty spacer row before subsequent owner sections
    if (excelRows.length > 0) {
      const spacerRow = {};
      columns.forEach((c) => {
        spacerRow[c.key] = '';
        spacerRow[c.label] = '';
      });
      excelRows.push(spacerRow);
    }

    const ownerHeaderRow = {};
    columns.forEach((c, idx) => {
      if (idx === 0) {
        ownerHeaderRow[c.key] = isReassigned
          ? `▶ Re-assigned ${entityName} Owner: ${ownerName} (${groupRows.length} ${entityPlural})${fromSuffix}`
          : `▶ ${entityName} Owner: ${ownerName} (${groupRows.length} ${entityPlural})`;
        ownerHeaderRow[c.label] = ownerHeaderRow[c.key];
      } else {
        ownerHeaderRow[c.key] = '';
        ownerHeaderRow[c.label] = '';
      }
    });
    excelRows.push(ownerHeaderRow);

    groupRows.forEach((r) => {
      const excelRow = { ...r };
      columns.forEach((c) => {
        excelRow[c.key] = resolveExportCell(r, c);
        excelRow[c.label] = excelRow[c.key];
      });
      excelRows.push(excelRow);
    });
  });

  let logoBytes = null;
  let logoFile = path.resolve(__dirname, '../../src/assets/swati-logo.png');
  if (!fs.existsSync(logoFile)) {
    logoFile = path.resolve(__dirname, '../../public/swati-logo.png');
  }
  if (fs.existsSync(logoFile)) {
    logoBytes = fs.readFileSync(logoFile);
  }

  const excelBytes = buildXlsxBytes({
    title: reportTitle,
    subtitle: `${filterSummary} | Generated: ${new Date().toLocaleDateString('en-IN')}`,
    companyName: 'SWATI SWITCHGEARS INDIA PVT. LTD.',
    logoBytes,
    sheetName: 'Report Data',
    columns: columns.map((c) => ({
      key: c.key,
      label: c.label || c.key,
    })),
    rows: excelRows,
  });

  const excelBuffer = Buffer.from(excelBytes);
  const sanitizedTitle = reportTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const excelFileName = `${sanitizedTitle}_${dateStr}.xlsx`;
  const pdfFileName = `${sanitizedTitle}_${dateStr}.pdf`;

  return {
    buffer: excelBuffer,
    excelBuffer,
    fileName: excelFileName,
    excelFileName,
    pdfBuffer,
    pdfFileName,
    recordCount: dedupedDataSets.length,
    reportTitle,
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
    // Extract email and clean name if combined string like "Krunal Patel (mkt.brd@swatiswitchgears.com)" is provided
    const emailInParensMatch = rawOwnerInput.match(/[\(<]([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})[\)>]/)
      || rawOwnerInput.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const extractedEmail = emailInParensMatch ? emailInParensMatch[1].toLowerCase().trim() : '';
    const cleanName = rawOwnerInput.replace(/[\(<].*?[\)>]/g, '').trim();

    // 1. Resolve canonical email directly from usersMap (from users collection)
    if (usersMap._emails && usersMap._emails[ownerFilter]) {
      targetOwnerEmail = usersMap._emails[ownerFilter].toLowerCase().trim();
    } else if (extractedEmail) {
      targetOwnerEmail = extractedEmail;
    } else if (ownerFilter.includes('@') && !ownerFilter.includes(' ')) {
      targetOwnerEmail = ownerFilter;
    }

    if (usersMap[ownerFilter]) {
      targetOwnerName = usersMap[ownerFilter];
      if (!targetOwnerEmail && usersMap._emails && usersMap._emails[String(targetOwnerName).toLowerCase().trim()]) {
        targetOwnerEmail = usersMap._emails[String(targetOwnerName).toLowerCase().trim()].toLowerCase().trim();
      }
    } else if (cleanName && usersMap[cleanName.toLowerCase()]) {
      targetOwnerName = usersMap[cleanName.toLowerCase()];
    } else if (usersMap._names && usersMap._names[ownerFilter]) {
      targetOwnerName = usersMap._names[ownerFilter];
    } else if (cleanName && usersMap._names && usersMap._names[cleanName.toLowerCase()]) {
      targetOwnerName = usersMap._names[cleanName.toLowerCase()];
    } else {
      targetOwnerName = cleanName || rawOwnerInput;
    }

    if (usersMap._profiles && usersMap._profiles[ownerFilter]) {
      const prof = usersMap._profiles[ownerFilter];
      if (prof.email) targetOwnerEmail = prof.email.toLowerCase().trim();
      if (prof.name) targetOwnerName = prof.name;
    } else if (cleanName && usersMap._profiles && usersMap._profiles[cleanName.toLowerCase()]) {
      const prof = usersMap._profiles[cleanName.toLowerCase()];
      if (prof.email) targetOwnerEmail = prof.email.toLowerCase().trim();
      if (prof.name) targetOwnerName = prof.name;
    }

    // Build the set of target owner emails (exact mail-wise identification)
    const targetOwnerEmails = new Set();
    if (targetOwnerEmail) targetOwnerEmails.add(targetOwnerEmail);
    if (extractedEmail) targetOwnerEmails.add(extractedEmail);
    if (targetOwnerName && usersMap._emails && usersMap._emails[targetOwnerName.toLowerCase().trim()]) {
      targetOwnerEmails.add(usersMap._emails[targetOwnerName.toLowerCase().trim()].toLowerCase().trim());
    }
    if (cleanName && usersMap._emails && usersMap._emails[cleanName.toLowerCase().trim()]) {
      targetOwnerEmails.add(usersMap._emails[cleanName.toLowerCase().trim()].toLowerCase().trim());
    }

    // Build owner identities for exact code or exact name if doc stores owner name/code
    const targetOwnerExactIdentities = new Set([ownerFilter]);
    if (targetOwnerName) targetOwnerExactIdentities.add(targetOwnerName.toLowerCase().trim());
    if (cleanName) targetOwnerExactIdentities.add(cleanName.toLowerCase().trim());
    if (targetOwnerEmail) targetOwnerExactIdentities.add(targetOwnerEmail);
    if (extractedEmail) targetOwnerExactIdentities.add(extractedEmail);
    if (usersMap._codes && usersMap._codes[ownerFilter]) {
      targetOwnerExactIdentities.add(String(usersMap._codes[ownerFilter]).toLowerCase().trim());
    }
    if (cleanName && usersMap._codes && usersMap._codes[cleanName.toLowerCase()]) {
      targetOwnerExactIdentities.add(String(usersMap._codes[cleanName.toLowerCase()]).toLowerCase().trim());
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
        doc.data?.data?.dealOwner,
        doc.quotationOwner,
        doc.data?.quotationOwner,
        doc.data?.selectedAccountOwner,
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
  } else {
    // If ownerFilter is 'all' or empty, check if report template has User Group(s) configured
    const tplUserGroups = (
      Array.isArray(tpl?.userGroups) && tpl.userGroups.length > 0
        ? tpl.userGroups
        : (Array.isArray(tpl?.selectedUserGroups) ? tpl.selectedUserGroups : [])
    ).filter(Boolean);

    if (tplUserGroups.length > 0) {
      try {
        const { listMembersByGroupIds } = require('../repositories/userGroupRepository');
        const groupMembers = await listMembersByGroupIds(tplUserGroups);
        const embeddedMembers = Array.isArray(tpl?.userGroupMembers) ? tpl.userGroupMembers : [];
        const allMembers = [...(groupMembers || []), ...embeddedMembers];

        if (allMembers.length > 0) {
          const groupMemberEmails = new Set(
            allMembers.map(m => String(m.email || m.member?.email || '').toLowerCase().trim()).filter(Boolean)
          );
          const groupMemberNames = new Set(
            allMembers.map(m => String(m.name || m.member?.name || '').toLowerCase().trim()).filter(Boolean)
          );
          const groupMemberUserIds = new Set(
            allMembers.map(m => String(m.userId || m.id || '').trim()).filter(Boolean)
          );
          const groupMemberCodes = new Set();
          allMembers.forEach(m => {
            const email = String(m.email || '').toLowerCase().trim();
            const name = String(m.name || '').toLowerCase().trim();
            const uid = String(m.userId || '').trim();
            if (usersMap._codes && usersMap._codes[email]) groupMemberCodes.add(String(usersMap._codes[email]).toLowerCase().trim());
            if (usersMap._codes && usersMap._codes[name]) groupMemberCodes.add(String(usersMap._codes[name]).toLowerCase().trim());
            if (usersMap._codes && usersMap._codes[uid]) groupMemberCodes.add(String(usersMap._codes[uid]).toLowerCase().trim());
          });

          filteredDocs = filteredDocs.filter((doc) => {
            // Check extracted owner identities across all entities (deal, quotation, customer, account)
            const docIdentities = extractAllDocOwnerIdentities(doc, usersMap, entityType);
            for (const id of docIdentities) {
              if (groupMemberNames.has(id)) return true;
              if (groupMemberEmails.has(id)) return true;
              if (groupMemberCodes.has(id)) return true;
              if (groupMemberUserIds.has(id)) return true;
            }

            const docOwnerName = String(
              doc.accountOwner || doc.formData?.accountOwner || doc.formData?.formData?.accountOwner ||
              doc.ownerName || doc.formData?.ownerName || doc.owner || doc.formData?.owner || ''
            ).trim().toLowerCase();

            const docOwnerEmail = String(
              doc.accountOwnerEmail || doc.formData?.accountOwnerEmail || doc.ownerEmail || doc.formData?.ownerEmail ||
              (usersMap._emails && usersMap._emails[docOwnerName]) || ''
            ).trim().toLowerCase();

            const docOwnerCode = String(
              doc.accountOwnerCode || doc.formData?.accountOwnerCode || doc.ownerCode || doc.formData?.ownerCode || ''
            ).trim().toLowerCase();

            // 1. Primary Match: Account Owner belongs to the User Group
            if (docOwnerName && groupMemberNames.has(docOwnerName)) return true;
            if (docOwnerEmail && groupMemberEmails.has(docOwnerEmail)) return true;
            if (docOwnerCode && groupMemberCodes.has(docOwnerCode)) return true;

            // 2. Re-assigned Match: Account was created by a User Group member, but current Account Owner is outside the group
            const docCreatorEmail = String(
              doc.userEmail || doc.createdUserBy || doc.formData?.userEmail || doc.formData?.createdUserBy ||
              doc.createdBy || doc.data?.createdBy || ''
            ).trim().toLowerCase();

            const docCreatorUserId = String(
              doc.createdByUserId || doc.formData?.createdByUserId || doc.userId || doc.data?.userId || ''
            ).trim();

            if (docCreatorEmail && groupMemberEmails.has(docCreatorEmail)) return true;
            if (docCreatorUserId && groupMemberUserIds.has(docCreatorUserId)) return true;

            return false;
          });
        }
      } catch (grpErr) {
        console.warn('[customReportEngine] Error resolving user group members:', grpErr);
      }
    }
  }

  // Keep reference of records that matched owner and filters before applying date window
  const docsBeforeDateFilter = [...filteredDocs];
  let dateFilterFellBack = false;
  let dateMatchedCount = null;

  // Universal Date Range Filtering (Using calendar day string normalization & timestamp fallback)
  const rawFrom = tpl?.recordDateFrom || tpl?.dateRange?.fromDate || tpl?.fromDate || '';
  const rawTo = tpl?.recordDateTo || tpl?.dateRange?.toDate || tpl?.toDate || '';

  const getCalendarDateStr = (val) => {
    if (!val || val === 'undefined' || val === 'null' || val === '-') return null;
    if (val instanceof Date && !isNaN(val.getTime())) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const s = String(val).trim();
    if (!s || s === 'undefined' || s === 'null') return null;

    // 1. Check DD-MM-YYYY or DD/MM/YYYY FIRST (Standard Indian CRM format, with or without time)
    const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmy) {
      return `${dmy[3]}-${String(dmy[2]).padStart(2, '0')}-${String(dmy[1]).padStart(2, '0')}`;
    }

    // 2. Check ISO YYYY-MM-DD or YYYY/MM/DD
    const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (iso) {
      return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
    }

    // 3. If string has ISO timestamp with T or Z, parse as Date
    if (s.includes('T') || s.includes('Z')) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    }

    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return null;
  };

  if (rawFrom || rawTo) {
    const fromStr = getCalendarDateStr(rawFrom);
    const toStr = getCalendarDateStr(rawTo);
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
        const candidates = [
          doc.accountDate,
          doc.addedDate,
          doc.formData?.accountDate,
          doc.formData?.addedDate,
          doc.formData?.['Added Date'],
          doc.formData?.['Account Date'],
          doc.formData?.formData?.accountDate,
          doc.formData?.formData?.addedDate,
          doc.data?.accountDate,
          doc.data?.addedDate,
          doc.raw?.accountDate,
          doc.raw?.addedDate,
          doc.date,
          doc.createdAt,
        ];
        rawDateVal = candidates.find(v => v !== undefined && v !== null && v !== 'undefined' && v !== 'null' && v !== '' && v !== '-');
      } else if (entityType === 'deal') {
        const candidates = [
          doc.dealDate,
          doc.data?.dealDate,
          doc.data?.data?.dealDate,
          doc.data?.convertedAt,
          doc.formData?.dealDate,
          doc.quotationDate,
          doc.createdAt,
        ];
        rawDateVal = candidates.find(v => v !== undefined && v !== null && v !== 'undefined' && v !== 'null' && v !== '' && v !== '-');
      } else if (entityType === 'customer') {
        const candidates = [
          doc.createdAt,
          doc.addedDate,
          doc.date,
        ];
        rawDateVal = candidates.find(v => v !== undefined && v !== null && v !== 'undefined' && v !== 'null' && v !== '' && v !== '-');
      } else if (entityType === 'quotation') {
        const candidates = [
          doc.quotationDate,
          doc.data?.quotationDate,
          doc.data?.customerReference?.date,
          doc.date,
          doc.createdAt,
        ];
        rawDateVal = candidates.find(v => v !== undefined && v !== null && v !== 'undefined' && v !== 'null' && v !== '' && v !== '-');
      } else {
        const candidates = [doc.date, doc.createdAt];
        rawDateVal = candidates.find(v => v !== undefined && v !== null && v !== 'undefined' && v !== 'null' && v !== '' && v !== '-');
      }

      if (!rawDateVal) return false;

      // Primary check: Calendar Day String Normalization (100% immune to timezone clipping)
      const docDateStr = getCalendarDateStr(rawDateVal);
      if (docDateStr) {
        if (fromStr && docDateStr < fromStr) return false;
        if (toStr && docDateStr > toStr) return false;
        return true;
      }

      // Fallback timestamp check
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

    // Dynamic creator / original owner for Reassigned Accounts
    const rawCreatorName = doc.createdByUserName || doc.formData?.createdByUserName || doc.addedBy || doc.formData?.addedBy || doc.formData?.formData?.addedBy || '';
    const rawCreatorEmail = String(doc.createdUserBy || doc.formData?.createdUserBy || doc.userEmail || '').trim().toLowerCase();
    const resolvedCreatorName = rawCreatorName || (rawCreatorEmail && usersMap._emails && Object.keys(usersMap._emails).find(n => usersMap._emails[n] === rawCreatorEmail)) || '';
    rowObj._createdByUserName = resolvedCreatorName
      ? String(resolvedCreatorName).toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : '';
    rowObj._createdUserBy = rawCreatorEmail;

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
