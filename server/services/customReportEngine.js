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
  updatedAt: 'Last Updated',
  lastUpdated: 'Last Updated',
  lastUpdate: 'Last Updated',
  accountState: 'Account State',
  state: 'Account State',
};

const DEAL_FIELD_LABELS = {
  dealNumber: 'Deal No.',
  id: 'Deal No.',
  accountName: 'Account Name',
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
  updatedAt: 'Last Updated',
  lastUpdated: 'Last Updated',
  lastUpdate: 'Last Updated',
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
  updatedAt: 'Last Updated',
  lastUpdated: 'Last Updated',
  lastUpdate: 'Last Updated',
};

const QUOTATION_FIELD_LABELS = {
  quotationNo: 'Quotation No.',
  quotationNumber: 'Quotation No.',
  q_quotation_number: 'Quotation No.',
  id: 'Quotation No.',
  date: 'Quotation Date',
  quotationDate: 'Quotation Date',
  q_quotation_date: 'Quotation Date',
  accountName: 'Account Name',
  customerName: 'Customer Name',
  company: 'Company Name',
  companyName: 'Company Name',
  q_company_name: 'Company Name',
  dealName: 'Deal Name',
  q_deal_name: 'Deal Name',
  title: 'Quotation Title',
  quotationTitle: 'Quotation Title',
  grandTotal: 'Grand Total',
  total: 'Grand Total',
  q_quotation_total: 'Grand Total',
  amount: 'Quotation Amount',
  status: 'Status',
  quotationStatus: 'Status',
  q_status: 'Status',
  revisionCode: 'Revision',
  revisionNo: 'Revision',
  revision: 'Revision',
  q_revision: 'Revision',
  quotationOwner: 'Quotation Owner',
  ownerCode: 'Owner Code',
  projectName: 'Project Name',
  validUntil: 'Valid Until',
  contactPerson: 'Contact Person',
  q_contact_person: 'Contact Person',
  createdAt: 'Created At',
  updatedAt: 'Last Updated',
  lastUpdated: 'Last Updated',
  lastUpdate: 'Last Updated',
};

const DEFAULT_FIELDS = {
  account: ['accountNumber', 'accountDate', 'name', 'accountOwner', 'status', 'projectName', 'phone', 'email', 'updatedAt'],
  deal: ['dealNumber', 'accountName', 'dealName', 'dealDate', 'dealOwner', 'dealType', 'status', 'dealValue', 'projectName', 'updatedAt'],
  customer: ['customerNumber', 'customerName', 'companyName', 'city', 'phone', 'email', 'status', 'updatedAt'],
  quotation: ['quotationNo', 'date', 'accountName', 'dealName', 'grandTotal', 'status', 'updatedAt'],
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
  if (typeof value === 'object') {
    if (value.$date) {
      if (typeof value.$date === 'object' && value.$date.$numberLong) {
        const ms = parseInt(value.$date.$numberLong, 10);
        return Number.isNaN(ms) ? null : ms;
      }
      const t = new Date(value.$date).getTime();
      return Number.isNaN(t) ? null : t;
    }
    if (value.$numberLong) {
      const ms = parseInt(value.$numberLong, 10);
      return Number.isNaN(ms) ? null : ms;
    }
  }
  const str = String(value).trim();
  if (!str) return null;

  // 1. DD-MM-YYYY or DD/MM/YYYY (e.g. 06-10-2026 or 06/10/2026)
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10) - 1;
    let y = parseInt(dmyMatch[3], 10);
    if (y < 100) y += 2000;
    const dateObj = new Date(y, m, d, 0, 0, 0, 0);
    return Number.isNaN(dateObj.getTime()) ? null : dateObj.getTime();
  }

  // 2. Strict YYYY-MM-DD or YYYY/MM/DD (e.g. 2026-10-06)
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
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
  const rawDate = formatDate(doc.accountDate || doc.formData?.accountDate || doc.formData?.formData?.accountDate || doc.dealDate || doc.date || doc.createdAt);
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
    projectName: doc.projectName || doc.formData?.projectName || doc.project || doc.formData?.project || doc.data?.projectName || (Array.isArray(doc.formData?.projects) && doc.formData.projects[0]?.projectName) || doc.dealName || doc.formData?.dealName || '-',
    project: doc.projectName || doc.formData?.projectName || doc.project || doc.formData?.project || doc.data?.projectName || (Array.isArray(doc.formData?.projects) && doc.formData.projects[0]?.projectName) || doc.dealName || doc.formData?.dealName || '-',
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

const resolveQuotationDisplayDate = (doc) => {
  if (!doc || typeof doc !== 'object') return '-';
  const revs = doc.data?.revisions || doc.revisions;
  const activeCode = doc.revisionCode || doc.data?.revisionCode;
  if (Array.isArray(revs) && activeCode) {
    const match = revs.find((r) => r.revisionCode === activeCode);
    if (match && match.date) return formatDate(match.date);
  }
  if (doc.data?.quotationDate) return formatDate(doc.data.quotationDate);
  if (doc.data?.customerReference?.date) return formatDate(doc.data.customerReference.date);
  const bestDate = doc.quotationDate || doc.date || doc.createdAt;
  return formatDate(bestDate);
};

const resolveQuotationRevisionCode = (doc) => {
  if (!doc || typeof doc !== 'object') return 'R0';
  return doc.revisionCode || doc.data?.revisionCode || (Array.isArray(doc.revisions) && doc.revisions.length > 0 ? doc.revisions[doc.revisions.length - 1]?.revisionCode : 'R0') || 'R0';
};

const mapQuotationDoc = (doc, usersMap = {}, fromMs = null, toMs = null) => {
  const rawNo = doc.quotationNo || doc.quotationNumber || doc.id || doc.data?.quotationNumber || '-';
  const rawDate = resolveQuotationDisplayDate(doc);
  const rawRev = resolveQuotationRevisionCode(doc);
  const rawCompany = doc.companyName || doc.data?.companyName || doc.company || doc.data?.company || doc.accountName || doc.data?.customerReference?.accountName || doc.customerName || doc.name || '-';
  const rawAccount = rawCompany;
  const rawDeal = doc.dealName || doc.data?.dealName || doc.title || doc.data?.title || '-';
  const rawTotal = doc.grandTotal || doc.data?.grandTotal || doc.total || doc.data?.total || doc.amount || '-';
  const rawOwner = doc.quotationOwner || doc.data?.quotationOwner || doc.owner || doc.ownerName || doc.assignedTo || doc.data?.owner || '-';
  const resolvedOwner = (usersMap && usersMap[String(rawOwner).trim().toLowerCase()]) || rawOwner;
  const ownerEmail = (usersMap._emails && usersMap._emails[String(resolvedOwner).trim().toLowerCase()]) ||
    (usersMap._emails && usersMap._emails[String(rawOwner).trim().toLowerCase()]) || '-';

  return {
    ...doc,
    quotationNo: rawNo,
    quotationNumber: rawNo,
    q_quotation_number: rawNo,
    id: rawNo,
    date: rawDate,
    quotationDate: rawDate,
    q_quotation_date: rawDate,
    revision: rawRev,
    revisionCode: rawRev,
    revisionNo: rawRev,
    q_revision: rawRev,
    'Revision': rawRev,
    companyName: rawCompany,
    company: rawCompany,
    'Company Name': rawCompany,
    q_company_name: rawCompany,
    accountName: rawAccount,
    customerName: rawAccount,
    'Account Name': rawAccount,
    dealName: rawDeal,
    q_deal_name: rawDeal,
    title: rawDeal,
    quotationTitle: rawDeal,
    grandTotal: rawTotal,
    total: rawTotal,
    amount: rawTotal,
    q_quotation_total: rawTotal,
    status: doc.status || doc.data?.status || '-',
    quotationStatus: doc.status || doc.data?.status || '-',
    q_status: doc.status || doc.data?.status || '-',
    quotationOwner: resolvedOwner,
    owner: resolvedOwner,
    ownerName: resolvedOwner,
    email: ownerEmail,
    ownerEmail: ownerEmail,
    projectName: doc.projectName || doc.project || doc.data?.projectName || '-',
    validUntil: formatDate(doc.validUntil || doc.data?.validUntil),
    contactPerson: doc.contactPerson || doc.data?.contactPerson || '-',
    q_contact_person: doc.contactPerson || doc.data?.contactPerson || '-',
    createdAt: formatDate(doc.createdAt),
    updatedAt: formatDate(doc.updatedAt),
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
    // 1. Primary ground-truth unique key: MongoDB ObjectId
    const id = String(row._id || row.id || '').trim();
    if (id && id !== '-' && id !== 'UNDEFINED' && id !== 'NULL') return `ID:${id}`;

    // 2. Fallbacks if _id is missing
    if (entityType === 'deal') {
      const dealNo = String(row['Deal No.'] || row['Deal No'] || row.dealNumber || '').trim().toUpperCase();
      const pName = String(row['Project Name'] || row.projectName || row['Deal Name'] || row.dealName || row.name || '').trim().toUpperCase();
      if (dealNo && dealNo !== '-' && dealNo !== 'UNDEFINED' && dealNo !== 'NULL') {
        return pName ? `DEAL:${dealNo}:${pName}` : `DEAL:${dealNo}`;
      }
    } else if (entityType === 'quotation') {
      const qNo = String(row['Quotation No.'] || row['Quotation No'] || row.quotationNumber || row.quoteNumber || '').trim().toUpperCase();
      const compName = String(row['Company Name'] || row.companyName || row.accountName || '').trim().toUpperCase();
      if (qNo && qNo !== '-' && qNo !== 'UNDEFINED' && qNo !== 'NULL') {
        return compName ? `QUOTE:${qNo}:${compName}` : `QUOTE:${qNo}`;
      }
    } else if (entityType === 'customer') {
      const custNo = String(row['Customer No.'] || row['Customer No'] || row.customerNumber || '').trim().toUpperCase();
      if (custNo && custNo !== '-' && custNo !== 'UNDEFINED' && custNo !== 'NULL') return `CUST:${custNo}`;
    } else if (entityType === 'account') {
      const accNo = String(
        row['Account No.'] || row['Account No'] || row.accountNumber || row.accountNo || ''
      ).trim().toUpperCase();
      if (accNo && accNo !== '-' && accNo !== 'UNDEFINED' && accNo !== 'NULL' && !/^\d{3,5}$/.test(accNo)) return `ACC:${accNo}`;
    } else {
      const dealNo = String(row['Deal No.'] || row['Deal No'] || row.dealNumber || '').trim().toUpperCase();
      const pName = String(row['Project Name'] || row.projectName || row['Deal Name'] || row.dealName || row.name || '').trim().toUpperCase();
      if (dealNo && dealNo !== '-' && dealNo !== 'UNDEFINED' && dealNo !== 'NULL') {
        return pName ? `DEAL:${dealNo}:${pName}` : `DEAL:${dealNo}`;
      }
      const qNo = String(row['Quotation No.'] || row['Quotation No'] || row.quotationNumber || row.quoteNumber || '').trim().toUpperCase();
      if (qNo && qNo !== '-' && qNo !== 'UNDEFINED' && qNo !== 'NULL') return `QUOTE:${qNo}`;
      const custNo = String(row['Customer No.'] || row['Customer No'] || row.customerNumber || '').trim().toUpperCase();
      if (custNo && custNo !== '-' && custNo !== 'UNDEFINED' && custNo !== 'NULL') return `CUST:${custNo}`;
      const accNo = String(
        row['Account No.'] || row['Account No'] || row.accountNumber || row.accountNo || ''
      ).trim().toUpperCase();
      if (accNo && accNo !== '-' && accNo !== 'UNDEFINED' && accNo !== 'NULL' && !/^\d{3,5}$/.test(accNo)) return `ACC:${accNo}`;
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
  const primaryTargetOwner = targetOwner && targetOwner !== 'all' ? targetOwner : '';

  const reportGroups = (
    Array.isArray(fullTemplate.userGroups) && fullTemplate.userGroups.length > 0
      ? fullTemplate.userGroups
      : (Array.isArray(fullTemplate.selectedUserGroups) ? fullTemplate.selectedUserGroups : [])
  ).filter(Boolean);

  const ownerGroups = {};
  dedupedDataSets.forEach((r) => {
    const o = resolveRowOwner(r);
    // If single owner report is requested, enforce strict owner scoping:
    if (primaryTargetOwner && reportGroups.length === 0) {
      const oLower = o.toLowerCase();
      const isMatch = oLower === primaryTargetOwner ||
        (fullTemplate.accountOwnerEmail && String(r.accountOwnerEmail || r.ownerEmail || '').toLowerCase() === String(fullTemplate.accountOwnerEmail).toLowerCase());
      if (!isMatch) {
        return;
      }
    }
    if (!ownerGroups[o]) ownerGroups[o] = [];
    ownerGroups[o].push(r);
  });

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

  const checkIsReassigned = (ownerName) => {
    const lower = String(ownerName || '').toLowerCase().trim();
    if (reportGroups.length > 0 && groupMemberNamesLower.size > 0) {
      return !groupMemberNamesLower.has(lower);
    }
    return Boolean(primaryTargetOwner && primaryTargetOwner !== 'all' && lower !== primaryTargetOwner);
  };

  const isRowReassigned = (row, ownerName) => {
    if (!row) return false;
    if (row.reassignDate || row.reassignedDate || row.lastReassignedAt || row.formData?.reassignDate || row.formData?.reassignedDate) {
      return true;
    }
    if (Array.isArray(row.ownershipHistory) && row.ownershipHistory.length > 0) {
      return true;
    }
    const remark = String(row.latestRemark || row.formData?.latestRemark || row.remark || '').trim();
    if (/re-?assign/i.test(remark)) {
      return true;
    }
    const creator = String(row._createdByUserName || row.createdByUserName || row.formData?.createdByUserName || row.addedBy || row.formData?.addedBy || '').trim().toLowerCase();
    const owner = String(ownerName || row['Account Owner'] || row.accountOwner || row.formData?.accountOwner || '').trim().toLowerCase();
    if (creator && creator !== '-' && creator !== 'system administrator' && creator !== 'admin' && creator !== '3' && creator !== owner) {
      return true;
    }
    return false;
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
      const allRowsForOwner = (ownerGroups[ownerName] || []).slice();
      const ownerLevelReassigned = checkIsReassigned(ownerName);

      const directRows = [];
      const reassignedRows = [];
      allRowsForOwner.forEach((row) => {
        if (ownerLevelReassigned || isRowReassigned(row, ownerName)) {
          reassignedRows.push(row);
        } else {
          directRows.push(row);
        }
      });

      const sectionsToRender = [];
      // 1. FIRST: Owner's own direct accounts
      if (directRows.length > 0) {
        sectionsToRender.push({
          isReassigned: false,
          rows: directRows,
          title: `${entityName} Owner: ${ownerName} (${directRows.length} ${entityPlural})`,
        });
      }
      // 2. AFTER: Re-assigned accounts (only if reassignedRows exist)
      if (reassignedRows.length > 0) {
        const distinctFromNames = Array.from(
          new Set(
            reassignedRows
              .map((r) => resolveRowCreator(r))
              .filter((n) => n && n !== '-' && n !== 'System Administrator' && n !== 'admin' && n !== '3' && n.toLowerCase() !== ownerName.toLowerCase())
          )
        );
        const fromSuffix = distinctFromNames.length > 0
          ? ` From ${distinctFromNames.join(', ')}`
          : (primaryTargetOwner && primaryTargetOwner !== 'all' && primaryTargetOwner !== ownerName.toLowerCase()
            ? ` From ${formatTitleCase(primaryTargetOwner)}`
            : '');

        sectionsToRender.push({
          isReassigned: true,
          rows: reassignedRows,
          title: `Re-assigned ${entityName} Owner: ${ownerName} (${reassignedRows.length} ${entityPlural})${fromSuffix}`,
        });
      }

      sectionsToRender.forEach((sec) => {
        if (currentY > 185) {
          doc.addPage();
          currentY = 16;
        }

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        if (sec.isReassigned) {
          doc.setTextColor(180, 83, 9);
        } else {
          doc.setTextColor(198, 0, 22);
        }
        doc.text(sec.title, 14, currentY);
        currentY += 4;

        const tableHead = [columns.map((c) => c.label)];
        const tableBody = sec.rows.map((row) =>
          columns.map((c) => resolveExportCell(row, c))
        );

        autoTable(doc, {
          head: tableHead,
          body: tableBody,
          startY: currentY,
          theme: 'grid',
          styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
          headStyles: {
            fillColor: sec.isReassigned ? [71, 85, 105] : [45, 55, 72],
            textColor: 255,
            fontStyle: 'bold',
          },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: 14, right: 14 },
        });

        currentY = (doc.lastAutoTable?.finalY || currentY + 25) + 8;
      });
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
  const getRecordTimestamp = (r) => {
    const raw = r.updatedAt || r.formData?.updatedAt || r.accountDate || r.formData?.accountDate || r.dealDate || r.quotationDate || r.date || r.createdAt;
    return parseDateTimestamp(raw) || 0;
  };

  const excelRows = [];
  sortedOwnerNames.forEach((ownerName) => {
    const allRowsForOwner = (ownerGroups[ownerName] || []).slice();
    // Enforce LIFO (Last-In, First-Out) sorting: most recent records first
    allRowsForOwner.sort((a, b) => getRecordTimestamp(b) - getRecordTimestamp(a));
    const ownerLevelReassigned = checkIsReassigned(ownerName);

    const directRows = [];
    const reassignedRows = [];
    allRowsForOwner.forEach((row) => {
      if (ownerLevelReassigned || isRowReassigned(row, ownerName)) {
        reassignedRows.push(row);
      } else {
        directRows.push(row);
      }
    });

    const sectionsToRender = [];
    // 1. FIRST: Owner's own direct accounts
    if (directRows.length > 0) {
      sectionsToRender.push({
        isReassigned: false,
        rows: directRows,
        headerText: `▶ ${entityName} Owner: ${ownerName} (${directRows.length} ${entityPlural})`,
      });
    }
    // 2. AFTER: Re-assigned accounts (only if reassignedRows exist)
    if (reassignedRows.length > 0) {
      const distinctFromNames = Array.from(
        new Set(
          reassignedRows
            .map((r) => resolveRowCreator(r))
            .filter((n) => n && n !== '-' && n !== 'System Administrator' && n !== 'admin' && n !== '3' && n.toLowerCase() !== ownerName.toLowerCase())
        )
      );
      const fromSuffix = distinctFromNames.length > 0
        ? ` From ${distinctFromNames.join(', ')}`
        : (primaryTargetOwner && primaryTargetOwner !== 'all' && primaryTargetOwner !== ownerName.toLowerCase()
          ? ` From ${formatTitleCase(primaryTargetOwner)}`
          : '');

      sectionsToRender.push({
        isReassigned: true,
        rows: reassignedRows,
        headerText: `▶ Re-assigned ${entityName} Owner: ${ownerName} (${reassignedRows.length} ${entityPlural})${fromSuffix}`,
      });
    }

    sectionsToRender.forEach((sec) => {
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
          ownerHeaderRow[c.key] = sec.headerText;
          ownerHeaderRow[c.label] = ownerHeaderRow[c.key];
        } else {
          ownerHeaderRow[c.key] = '';
          ownerHeaderRow[c.label] = '';
        }
      });
      excelRows.push(ownerHeaderRow);

      sec.rows.forEach((r) => {
        const excelRow = { ...r };
        columns.forEach((c) => {
          excelRow[c.key] = resolveExportCell(r, c);
          excelRow[c.label] = excelRow[c.key];
        });
        excelRows.push(excelRow);
      });
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


let _cachedUsersLookup = null;
let _cachedUsersLookupExpiry = 0;

async function getUsersLookupMap(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && _cachedUsersLookup && now < _cachedUsersLookupExpiry) {
    return _cachedUsersLookup;
  }

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

      // Support natural name variations for all users dynamically
      if (/naim(\s+vh?ora)?/i.test(displayName) || /naim(\s+vh?ora)?/i.test(username)) {
        registerKey('naim vhora');
        registerKey('naim vora');
        registerKey('naim vohra');
        registerKey('naim');
      }
      if (/krunal(\s+patel)?/i.test(displayName) || /krunal(\s+patel)?/i.test(username)) {
        registerKey('krunal patel');
        registerKey('krunal');
      }
      if (/jagruti|jagurti/i.test(displayName)) {
        registerKey('jagruti parmar');
        registerKey('jagurti parmar');
        registerKey('jagruti');
        registerKey('jagurti');
      }
      if (/kanu|kanubhai/i.test(displayName)) {
        registerKey('kanu shah');
        registerKey('kanubhai shah');
      }
    });

    // Dynamically retrieve true owner codes from MongoDB leads and deals collections for ALL owners
    try {
      const leadsCol = mongoose.connection.db.collection('leads');
      if (leadsCol) {
        const leadGroups = await leadsCol.aggregate([
          {
            $group: {
              _id: {
                ownerName: '$ownerName',
                accountOwner: '$accountOwner',
                formAccountOwner: '$formData.accountOwner'
              },
              ownerCodes: { $addToSet: '$ownerCode' },
              accountCodes: { $addToSet: '$accountOwnerCode' },
              formCodes: { $addToSet: '$formData.ownerCode' },
              formAccountCodes: { $addToSet: '$formData.accountOwnerCode' }
            }
          }
        ]).toArray();

        leadGroups.forEach((grp) => {
          const candidateNames = [
            grp._id?.ownerName,
            grp._id?.accountOwner,
            grp._id?.formAccountOwner
          ].filter(Boolean).map(n => String(n).trim());

          const collectedCodes = [
            ...(grp.ownerCodes || []),
            ...(grp.accountCodes || []),
            ...(grp.formCodes || []),
            ...(grp.formAccountCodes || [])
          ].filter(c => c != null && String(c).trim() !== '').map(c => String(c).trim());

          candidateNames.forEach((candName) => {
            const lowerName = candName.toLowerCase();
            const matchedProfile = _profiles[lowerName];
            if (matchedProfile) {
              collectedCodes.forEach((code) => {
                const lowerCode = code.toLowerCase();
                _codes[lowerCode] = code;
                _profiles[lowerCode] = matchedProfile;
                if (matchedProfile.email) _emails[lowerCode] = matchedProfile.email;
                map[lowerCode] = matchedProfile.name;
              });
            }
          });
        });
      }
    } catch (_) {}
  } catch (_) {}

  map._emails = _emails;
  map._names = _names;
  map._codes = _codes;
  map._profiles = _profiles;

  return map;
}

const detectTemplateEntityType = (tpl) => {
  let raw = String(tpl?.entityType || tpl?.categoryKey || tpl?.reportContext || '').toLowerCase().trim();
  if (raw === 'account' || raw === 'accounts' || raw === 'lead' || raw === 'leads') return 'account';
  if (raw === 'deals' || raw === 'deal') return 'deal';
  if (raw === 'quotations' || raw === 'quotation' || raw === 'quote') return 'quotation';
  if (raw === 'customers' || raw === 'customer') return 'customer';

  // Dynamic signature inspection from selectedFields & displayFields
  const allFields = [...(tpl?.selectedFields || []), ...(tpl?.displayFields || [])]
    .map((f) => (typeof f === 'object' ? (f.key || f.label) : String(f)))
    .map((f) => f.toLowerCase());

  if (allFields.some((f) => f === 'dealname' || f === 'dealnumber' || f === 'dealvalue' || f === 'stage')) return 'deal';
  if (allFields.some((f) => f === 'quotationnumber' || f === 'quotationno' || f === 'quotationdate')) return 'quotation';
  if (allFields.some((f) => f === 'customernumber' || f === 'customerno')) return 'customer';

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
  if (entityType === 'deal' && !fields.includes('accountName') && !fields.includes('customerName')) {
    fields = ['accountName', ...fields];
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
        let targetVal = String(flt.value !== undefined && flt.value !== null ? flt.value : '').trim().toLowerCase();
        let testStr = String(docVal !== undefined && docVal !== null ? docVal : '').trim().toLowerCase();

        const canonField = canonicalizeKey(flt.field);
        if (canonField.includes('date') || canonField.includes('createdat') || canonField.includes('updatedat') || canonField.includes('addedon')) {
          const dtFormatted = formatDateDisplay(flt.value);
          if (dtFormatted && dtFormatted !== '-') {
            targetVal = dtFormatted.toLowerCase();
          }
        }

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

  // Decompose parenthetical format: e.g. "Naim Vhora (sales1@swatiswitchgears.com)" or "Krunal Patel (1002)"
  let extractedName = rawOwnerInput;
  let extractedEmail = '';
  let extractedCode = '';
  const inParens = rawOwnerInput.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (inParens) {
    extractedName = inParens[1].trim();
    const inside = inParens[2].trim();
    if (inside.includes('@')) extractedEmail = inside.toLowerCase();
    else if (/^\d+$/.test(inside)) extractedCode = inside;
  }

  const ownerFilter = extractedName.toLowerCase();
  let targetOwnerEmail = extractedEmail;
  let targetOwnerName = extractedName;

  if (ownerFilter && ownerFilter !== 'all') {
    // 1. Resolve canonical email directly from usersMap (from users collection)
    if (usersMap._emails && usersMap._emails[ownerFilter]) {
      targetOwnerEmail = usersMap._emails[ownerFilter].toLowerCase().trim();
    } else if (ownerFilter.includes('@')) {
      targetOwnerEmail = ownerFilter;
    } else if (extractedEmail) {
      targetOwnerEmail = extractedEmail;
    }

    if (usersMap[ownerFilter]) {
      targetOwnerName = usersMap[ownerFilter];
      if (!targetOwnerEmail && usersMap._emails && usersMap._emails[String(targetOwnerName).toLowerCase().trim()]) {
        targetOwnerEmail = usersMap._emails[String(targetOwnerName).toLowerCase().trim()].toLowerCase().trim();
      }
    } else if (usersMap._names && usersMap._names[ownerFilter]) {
      targetOwnerName = usersMap._names[ownerFilter];
    } else {
      targetOwnerName = extractedName;
    }

    if (usersMap._profiles && usersMap._profiles[ownerFilter]) {
      const prof = usersMap._profiles[ownerFilter];
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

    // Build owner identities for exact code or exact name if doc stores owner name/code
    const targetOwnerExactIdentities = new Set([ownerFilter, rawOwnerInput.toLowerCase()]);
    if (extractedName) targetOwnerExactIdentities.add(extractedName.toLowerCase().trim());
    if (targetOwnerName) targetOwnerExactIdentities.add(targetOwnerName.toLowerCase().trim());
    if (targetOwnerEmail) targetOwnerExactIdentities.add(targetOwnerEmail);
    if (extractedEmail) targetOwnerExactIdentities.add(extractedEmail);
    if (extractedCode) targetOwnerExactIdentities.add(extractedCode.toLowerCase());
    if (usersMap._codes && usersMap._codes[ownerFilter]) {
      targetOwnerExactIdentities.add(String(usersMap._codes[ownerFilter]).toLowerCase().trim());
    }
    if (targetOwnerName && usersMap._codes && usersMap._codes[targetOwnerName.toLowerCase().trim()]) {
      targetOwnerExactIdentities.add(String(usersMap._codes[targetOwnerName.toLowerCase().trim()]).toLowerCase().trim());
    }

    const targetProfile = (usersMap._profiles && (usersMap._profiles[ownerFilter] || usersMap._profiles[targetOwnerName?.toLowerCase()?.trim()])) || null;
    const targetLegacyId = targetProfile?.legacyId ? String(targetProfile.legacyId).trim() : null;
    const targetOwnerCode = targetProfile?.ownerCode ? String(targetProfile.ownerCode).trim().toLowerCase() : (extractedCode || (usersMap._codes && usersMap._codes[targetOwnerName?.toLowerCase()?.trim()] ? String(usersMap._codes[targetOwnerName?.toLowerCase()?.trim()]).toLowerCase().trim() : null));

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
        doc.data?.userEmail,
        doc.data?.createdUserBy,
        doc.data?.accountOwnerEmail,
        doc.data?.ownerEmail,
      ].filter(Boolean).map(e => String(e).trim().toLowerCase());

      if (targetOwnerEmails.size > 0 && docEmailCandidates.some(e => targetOwnerEmails.has(e))) {
        return true;
      }

      // Check if doc matches target owner through re-assignment (as creator, original owner, or transfer participant)
      const isReassignedMatch = (function() {
        if (entityType === 'deal' || entityType === 'quotation') {
          // A. Creator ID match (e.g. createdBy: 3 for Naim Vhora)
          const creatorId = String(doc.createdBy || doc.data?.createdBy || '').trim();
          if (targetLegacyId && creatorId === targetLegacyId) return true;

          // B. Owner Code match (e.g. 1003 in doc.ownerCode or quotationNumber)
          const docCodes = [doc.ownerCode, doc.data?.ownerCode].filter(Boolean).map(c => String(c).trim().toLowerCase());
          if (targetOwnerCode && docCodes.includes(targetOwnerCode)) return true;

          // For quotation, check quotationNumber for -<ownerCode>- (e.g. -1003-)
          const qNum = String(doc.quotationNumber || doc.data?.quotationNumber || '');
          if (targetOwnerCode && qNum.includes(`-${targetOwnerCode}-`)) return true;
        } else if (entityType === 'account') {
          const topCode = String(doc.accountOwnerCode || doc.ownerCode || '').trim().toLowerCase();
          if (targetOwnerCode && topCode === targetOwnerCode) return true;
        }

        // C. Creator Email / Name match
        const cEmail = String(doc.userEmail || doc.createdUserBy || doc.formData?.userEmail || doc.formData?.createdUserBy || doc.data?.userEmail || '').trim().toLowerCase();
        if (cEmail && targetOwnerEmails.has(cEmail)) return true;

        const cName = String(doc.createdByUserName || doc.formData?.createdByUserName || doc.addedBy || doc.formData?.addedBy || '').trim().toLowerCase();
        if (cName && (cName === targetOwnerName.toLowerCase() || targetOwnerExactIdentities.has(cName))) return true;

        // D. Ownership history check
        const history = doc.ownershipHistory || doc.data?.ownershipHistory || doc.formData?.ownershipHistory || [];
        if (Array.isArray(history)) {
          const matched = history.some(h => {
            const f = String(h.fromOwner || h.from || '').toLowerCase().trim();
            const t = String(h.toOwner || h.to || '').toLowerCase().trim();
            return targetOwnerExactIdentities.has(f) || targetOwnerExactIdentities.has(t) ||
                   f === targetOwnerName.toLowerCase() || t === targetOwnerName.toLowerCase();
          });
          if (matched) return true;
        }

        // E. Latest remark check for "Re-assign ... from/to [targetOwner]"
        const remark = String(doc.latestRemark || doc.data?.latestRemark || doc.formData?.latestRemark || '').toLowerCase();
        if (/re-?assign/i.test(remark) && (remark.includes(targetOwnerName.toLowerCase()) || (targetOwnerCode && remark.includes(targetOwnerCode)))) {
          return true;
        }

        return false;
      })();

      // 2. Strict Explicit Owner Match (Current active owner has highest authority)
      const effectiveDealOwner = (doc.dealOwner && String(doc.dealOwner).trim() !== '')
        ? doc.dealOwner
        : (doc.data?.dealOwner || null);

      const currentDocOwner = String(
        entityType === 'deal'
          ? (effectiveDealOwner || doc.dealOwnerName || doc.ownerName || doc.owner || '')
          : entityType === 'quotation'
            ? (doc.quotationOwner || doc.data?.quotationOwner || doc.ownerName || doc.owner || '')
            : entityType === 'customer'
              ? (doc.customerOwner || doc.assignedTo || doc.assignedToName || doc.ownerName || doc.owner || '')
              : (doc.accountOwner || doc.formData?.accountOwner || doc.ownerName || doc.formData?.ownerName || doc.owner || doc.raw?.accountOwner || '')
      ).trim();

      if (currentDocOwner && currentDocOwner !== '-' && currentDocOwner !== 'unassigned' && currentDocOwner !== 'undefined' && currentDocOwner !== 'null') {
        const lowerCurrent = currentDocOwner.toLowerCase();
        if (targetOwnerExactIdentities.has(lowerCurrent) || lowerCurrent === targetOwnerName.toLowerCase()) {
          return true;
        }
        if (usersMap._emails && usersMap._emails[lowerCurrent]) {
          const resolvedDocEmail = String(usersMap._emails[lowerCurrent]).toLowerCase().trim();
          if (targetOwnerEmails.has(resolvedDocEmail)) return true;
        }
        // If current explicit owner belongs to another colleague, but record matches target owner through re-assignment, KEEP IT!
        if (isReassignedMatch) {
          return true;
        }
        // If current explicit owner belongs to another recognized colleague in usersMap, REJECT!
        if (usersMap[lowerCurrent] || usersMap._names?.[lowerCurrent] || usersMap._profiles?.[lowerCurrent] || (usersMap._emails && usersMap._emails[lowerCurrent])) {
          return false;
        }
      }

      if (isReassignedMatch) {
        return true;
      }

      // 3. Resolve document's owner code via users collection lookup to obtain canonical mail (ONLY if no conflicting explicit owner)
      const docCodes = [
        doc.ownerCode,
        doc.formData?.ownerCode,
        doc.accountOwnerCode,
        doc.formData?.accountOwnerCode,
        doc.data?.ownerCode,
        doc.data?.accountOwnerCode,
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

  // Universal Date Range Filtering (Using parseDateTimestamp for ISO, YYYY-MM-DD, and DD/MM/YYYY)
  const rawFrom = tpl?.recordDateFrom || tpl?.dateRange?.fromDate || tpl?.fromDate || tpl?.dateFrom || tpl?.customStartDate || tpl?.startDate || '';
  const rawTo = tpl?.recordDateTo || tpl?.dateRange?.toDate || tpl?.toDate || tpl?.dateTo || tpl?.customEndDate || tpl?.endDate || '';
  let fromTime = null;
  let toTime = null;
  if (rawFrom || rawTo) {
    fromTime = rawFrom ? parseDateTimestamp(rawFrom) : null;
    if (fromTime !== null) {
      const fromObj = new Date(fromTime);
      fromObj.setHours(0, 0, 0, 0);
      fromTime = fromObj.getTime();
    }
    toTime = rawTo ? parseDateTimestamp(rawTo) : null;
    if (toTime !== null) {
      const toObj = new Date(toTime);
      toObj.setHours(23, 59, 59, 999);
      toTime = toObj.getTime();
    }

    const targetDateField = String(tpl?.dateFilterField || tpl?.dateRange?.dateFilterField || '').trim();

    const dateFiltered = filteredDocs.filter((doc) => {
      let dateCandidates = [];
      if (entityType === 'account') {
        if (targetDateField === 'updatedAt') {
          dateCandidates = [doc.updatedAt, doc.formData?.updatedAt, doc.createdAt];
        } else if (targetDateField === 'createdAt') {
          dateCandidates = [doc.createdAt, doc.formData?.createdAt];
        } else {
          const accDate = doc.accountDate || doc.formData?.accountDate || doc.formData?.formData?.accountDate || doc.dealDate || doc.date;
          dateCandidates = accDate ? [accDate, doc.createdAt, doc.updatedAt] : [doc.createdAt, doc.updatedAt];
        }
      } else if (entityType === 'deal') {
        dateCandidates = [
          doc.dealDate,
          doc.data?.dealDate,
          doc.data?.data?.dealDate,
          doc.data?.convertedAt,
          doc.formData?.dealDate,
          doc.date,
          doc.dateOfDeal,
          doc.dealNumber,
          doc.quotationDate,
          doc.createdAt,
          doc.updatedAt,
          doc.lastUpdated,
        ];
      } else if (entityType === 'customer') {
        dateCandidates = [doc.createdAt, doc.addedDate, doc.date, doc.updatedAt, doc.lastUpdated];
      } else if (entityType === 'quotation') {
        const revDates = (Array.isArray(doc.data?.revisions) ? doc.data.revisions : (Array.isArray(doc.revisions) ? doc.revisions : [])).map((r) => r.date).filter(Boolean);
        dateCandidates = [
          ...revDates,
          doc.quotationDate,
          doc.data?.quotationDate,
          doc.data?.customerReference?.date,
          doc.date,
          doc.createdAt,
          doc.updatedAt,
          doc.lastUpdated,
          doc.lastUpdate,
          doc.formData?.quotationDate,
          doc.formData?.date,
          doc.formData?.updatedAt,
          doc.formData?.createdAt
        ];
      } else {
        dateCandidates = [doc.date, doc.createdAt, doc.updatedAt, doc.lastUpdated];
      }

      return dateCandidates.filter(Boolean).some((rawDateVal) => {
        const docTime = parseDateTimestamp(rawDateVal);
        if (docTime === null) return false;
        if (fromTime !== null && docTime < fromTime) return false;
        if (toTime !== null && docTime > toTime) return false;
        return true;
      });
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
    if (Array.isArray(tpl?.layoutOrder) && tpl.layoutOrder.length === fields.length && tpl.layoutOrder[idx]) {
      return tpl.layoutOrder[idx];
    }
    return labelDict[strKey] || strKey;
  });

  // LIFO sorting (Last-In, First-Out: newest records at the top)
  filteredDocs.sort((a, b) => {
    const rawA = a.updatedAt || a.formData?.updatedAt || a.accountDate || a.formData?.accountDate || a.dealDate || a.quotationDate || a.date || a.createdAt;
    const rawB = b.updatedAt || b.formData?.updatedAt || b.accountDate || b.formData?.accountDate || b.dealDate || b.quotationDate || b.date || b.createdAt;
    const tA = parseDateTimestamp(rawA) || 0;
    const tB = parseDateTimestamp(rawB) || 0;
    return tB - tA;
  });

  const rows = filteredDocs.map((doc) => {
    const rowObj = {};
    fields.forEach((fieldIdentifier, idx) => {
      const rawKey = typeof fieldIdentifier === 'object' ? (fieldIdentifier.key || fieldIdentifier.label) : String(fieldIdentifier);
      const displayLabel = fieldLabels[idx] || rawKey;
      let resolvedVal = resolveDocumentField(doc, fieldIdentifier, usersMap);
      if (entityType === 'quotation' && (String(rawKey).toLowerCase().includes('date') || String(displayLabel).toLowerCase().includes('date'))) {
        if (String(rawKey).toLowerCase().includes('created') || String(displayLabel).toLowerCase().includes('created')) {
          resolvedVal = formatDate(doc.createdAt);
        } else if (String(rawKey).toLowerCase().includes('updated') || String(displayLabel).toLowerCase().includes('updated')) {
          resolvedVal = formatDate(doc.updatedAt);
        } else {
          resolvedVal = resolveQuotationDisplayDate(doc);
        }
      }
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
    rowObj['Company Name'] = rowObj['Company Name'] || rowObj['q_company_name'] || doc.companyName || doc.data?.companyName || doc.accountName || doc.data?.customerReference?.accountName;
    rowObj['Customer No.'] = rowObj['Customer No.'] || rowObj['Customer No'] || doc.customerNumber || doc.formData?.customerNumber;
    const rawRev = resolveQuotationRevisionCode(doc);
    rowObj['Revision'] = rowObj['Revision'] || rawRev;
    rowObj.revisionCode = rowObj.revisionCode || rawRev;
    rowObj.revision = rowObj.revision || rawRev;
    rowObj['Created At'] = rowObj['Created At'] || formatDate(doc.createdAt);
    rowObj['Last Updated'] = rowObj['Last Updated'] || formatDate(doc.updatedAt);

    // Always attach resolved owner metadata to rowObj for grouping in Excel and PDF exports
    const resolvedDocOwner = (function() {
      const oVal = resolveDocumentField(doc, 'accountOwner', usersMap);
      if (oVal && oVal !== '-') return oVal;
      const rawO = doc.accountOwner || doc.formData?.accountOwner || doc.ownerName || doc.owner || doc.dealOwner || doc.quotationOwner;
      if (rawO && rawO !== '-') return rawO;
      return tpl?.owner || tpl?.accountOwner || tpl?.ownerFilter || 'Unassigned';
    })();

    rowObj.accountOwner = rowObj.accountOwner || resolvedDocOwner;
    rowObj['Account Owner'] = rowObj['Account Owner'] || resolvedDocOwner;
    rowObj.owner = rowObj.owner || resolvedDocOwner;
    rowObj.ownerName = rowObj.ownerName || resolvedDocOwner;

    // Dynamic creator / original owner for Reassigned Accounts, Deals, Quotations
    const rawCreatorId = String(doc.createdBy || doc.data?.createdBy || '').trim();
    const resolvedFromId = rawCreatorId && usersMap[rawCreatorId] ? usersMap[rawCreatorId] : '';
    const rawCreatorName = doc.createdByUserName || doc.formData?.createdByUserName || doc.addedBy || doc.formData?.addedBy || doc.formData?.formData?.addedBy || resolvedFromId || '';
    const rawCreatorEmail = String(doc.createdUserBy || doc.formData?.createdUserBy || doc.userEmail || doc.data?.userEmail || '').trim().toLowerCase();
    const resolvedCreatorName = rawCreatorName || (rawCreatorEmail && usersMap._emails && Object.keys(usersMap._emails).find(n => usersMap._emails[n] === rawCreatorEmail)) || '';
    rowObj._createdByUserName = resolvedCreatorName
      ? String(resolvedCreatorName).toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      : '';
    rowObj._createdUserBy = rawCreatorEmail;

    // Preserve re-assignment and remark metadata for strict frontend & backend export parity
    rowObj.reassignDate = doc.reassignDate || doc.data?.reassignDate || doc.formData?.reassignDate || doc.formData?.formData?.reassignDate || null;
    rowObj.reassignedDate = doc.reassignedDate || doc.data?.reassignedDate || doc.formData?.reassignedDate || doc.formData?.formData?.reassignedDate || null;
    rowObj.lastReassignedAt = doc.lastReassignedAt || doc.data?.lastReassignedAt || doc.formData?.lastReassignedAt || doc.formData?.formData?.lastReassignedAt || null;
    rowObj.ownershipHistory = doc.ownershipHistory || doc.data?.ownershipHistory || doc.formData?.ownershipHistory || doc.formData?.formData?.ownershipHistory || null;
    rowObj.latestRemark = doc.latestRemark || doc.data?.latestRemark || doc.formData?.latestRemark || doc.formData?.formData?.latestRemark || null;
    rowObj.accountOwnerEmail = doc.accountOwnerEmail || doc.data?.accountOwnerEmail || doc.formData?.accountOwnerEmail || doc.ownerEmail || null;

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

function resolveReassignmentDetails(row, currentOwner) {
  if (!row) return { isReassigned: false };
  const normCurrentOwner = String(currentOwner || row['Account Owner'] || row.accountOwner || row['Deal Owner'] || row.dealOwner || row['Quotation Owner'] || row.quotationOwner || row.ownerName || row.owner || '').trim();
  const lowerOwner = normCurrentOwner.toLowerCase();

  const creator = String(
    row._createdByUserName ||
    row.createdByUserName ||
    row.formData?.createdByUserName ||
    row.addedBy ||
    row.formData?.addedBy ||
    row.createdUserBy ||
    row.formData?.createdUserBy ||
    ''
  ).trim();
  const lowerCreator = creator.toLowerCase();

  const activeRowOwner = String(
    row['Account Owner'] || row.accountOwner ||
    row['Deal Owner'] || row.dealOwner ||
    row['Quotation Owner'] || row.quotationOwner ||
    row.ownerName || row.owner || ''
  ).trim();
  const lowerActiveRowOwner = activeRowOwner.toLowerCase();

  let fromOwner = null;
  let toOwner = normCurrentOwner;

  // 1. Check explicit ownershipHistory for transfer from or to current owner
  if (Array.isArray(row.ownershipHistory) && row.ownershipHistory.length > 0) {
    const lastTransfer = [...row.ownershipHistory].reverse().find(h => {
      const f = String(h.fromOwner || h.from || '').trim();
      const t = String(h.toOwner || h.to || '').trim();
      return (t.toLowerCase() === lowerOwner && f && f.toLowerCase() !== lowerOwner) ||
             (f.toLowerCase() === lowerOwner && t && t.toLowerCase() !== lowerOwner);
    });
    if (lastTransfer) {
      fromOwner = lastTransfer.fromOwner || lastTransfer.from;
      toOwner = lastTransfer.toOwner || lastTransfer.to;
    }
  }

  // 2. Fallback from latestRemark: "Re-assign ... from [From] to [To]"
  if (!fromOwner && (row.latestRemark || row.formData?.latestRemark)) {
    const remark = String(row.latestRemark || row.formData?.latestRemark || '').trim();
    const match = remark.match(/Re-?assign.*?from ([^to]+) to (.+?)(?:\.|$)/i);
    if (match) {
      fromOwner = match[1].trim();
      toOwner = match[2].trim();
    }
  }

  // 3. If active row owner differs from the target report owner
  if (!fromOwner && lowerActiveRowOwner && lowerActiveRowOwner !== lowerOwner) {
    fromOwner = normCurrentOwner;
    toOwner = activeRowOwner;
  }

  // 4. Fallback from creator if creator differs from currentOwner
  if (!fromOwner && creator && lowerCreator !== lowerOwner && !['admin', 'system', 'system administrator', '3', '-'].includes(lowerCreator)) {
    fromOwner = creator;
    toOwner = normCurrentOwner;
  }

  // 5. Check reassign timestamp if creator differs
  if (!fromOwner && (row.reassignDate || row.reassignedDate || row.lastReassignedAt) && lowerCreator !== lowerOwner && creator) {
    fromOwner = creator;
    toOwner = normCurrentOwner;
  }

  // 6. If fromOwner and toOwner are identical, it is NOT reassigned
  if (fromOwner && toOwner && fromOwner.toLowerCase() === toOwner.toLowerCase()) {
    return { isReassigned: false };
  }

  if (fromOwner && toOwner) {
    return {
      isReassigned: true,
      fromOwner,
      toOwner,
      pairKey: `${fromOwner} to ${toOwner}`
    };
  }

  return { isReassigned: false };
}

function generateTemplateExcelBuffer({ reportTitle, fieldLabels, rows }) {
  const workbook = XLSX.utils.book_new();
  const rowsForSheet = rows.length > 0 ? rows : [{ 'Report Status': 'No records found matching report criteria' }];
  let keys = fieldLabels && fieldLabels.length > 0 ? fieldLabels : Object.keys(rowsForSheet[0] || {});
  keys = keys.filter(k => k && !String(k).startsWith('_'));

  const isDeal = Boolean(keys.some(k => /deal/i.test(k)) || String(reportTitle).toLowerCase().includes('deal'));
  const isQuotation = Boolean(keys.some(k => /quotation|quote/i.test(k)) || String(reportTitle).toLowerCase().includes('quotation'));
  const isCustomer = Boolean(keys.some(k => /customer/i.test(k)) && !keys.some(k => /account/i.test(k)));
  const entityLabel = isDeal ? 'Deal' : isQuotation ? 'Quotation' : isCustomer ? 'Customer' : 'Account';
  const entityPlural = isDeal ? 'Deals' : isQuotation ? 'Quotations' : isCustomer ? 'Customers' : 'Accounts';

  // Group rows by Owner if owner field exists
  const ownerGroups = {};
  rowsForSheet.forEach((r) => {
    const oName = String(
      r['Account Owner'] || r.accountOwner ||
      r['Deal Owner'] || r.dealOwner ||
      r['Quotation Owner'] || r.quotationOwner ||
      r.ownerName || r.owner || 'All Records'
    ).trim();
    if (!ownerGroups[oName]) ownerGroups[oName] = [];
    ownerGroups[oName].push(r);
  });

  const formattedRows = [];
  const ownerNames = Object.keys(ownerGroups);

  if (ownerNames.length > 0 && rows.length > 0) {
    ownerNames.forEach((ownerName) => {
      const ownerRows = ownerGroups[ownerName];
      const directRows = [];
      const reassignedByPair = {};

      ownerRows.forEach((r) => {
        const details = resolveReassignmentDetails(r, ownerName);
        if (details.isReassigned) {
          const pair = details.pairKey || `${details.fromOwner} to ${details.toOwner}`;
          if (!reassignedByPair[pair]) reassignedByPair[pair] = [];
          reassignedByPair[pair].push(r);
        } else {
          directRows.push(r);
        }
      });

      const sections = [];
      // 1. FIRST: Owner's own direct records
      if (directRows.length > 0) {
        sections.push({
          headerText: `▶ ${entityLabel} Owner: ${ownerName} (${directRows.length} ${entityPlural})`,
          rows: directRows,
        });
      }
      // 2. AFTER: Re-assigned records grouped strictly by "From Who to Whom"
      Object.keys(reassignedByPair).forEach((pairKey) => {
        const pRows = reassignedByPair[pairKey];
        sections.push({
          headerText: `▶ Re-assigned ${entityLabel}: ${pairKey} (${pRows.length} ${entityPlural})`,
          rows: pRows,
        });
      });

      sections.forEach((sec) => {
        if (formattedRows.length > 0) {
          const spacerRow = {};
          keys.forEach(k => { spacerRow[k] = ''; });
          formattedRows.push(spacerRow);
        }

        const headerRow = {};
        keys.forEach((k, idx) => {
          headerRow[k] = idx === 0 ? sec.headerText : '';
        });
        formattedRows.push(headerRow);

        sec.rows.forEach((r) => {
          const cleanRow = {};
          keys.forEach((k) => {
            cleanRow[k] = r[k] !== undefined && r[k] !== null ? r[k] : (r[String(k).toLowerCase()] ?? '-');
          });
          formattedRows.push(cleanRow);
        });
      });
    });
  } else {
    rowsForSheet.forEach((r) => {
      const cleanRow = {};
      keys.forEach((k) => {
        cleanRow[k] = r[k] !== undefined && r[k] !== null ? r[k] : (r[String(k).toLowerCase()] ?? '-');
      });
      formattedRows.push(cleanRow);
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(formattedRows, { header: keys });

  worksheet['!cols'] = keys.map(key => {
    let maxLen = key.length;
    formattedRows.slice(0, 100).forEach(r => {
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
