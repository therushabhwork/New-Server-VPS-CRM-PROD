const mongoose = require('mongoose');
const reportFieldDefinitions = require('../config/reportFieldDefinitions');
const emailService = require('./emailService');

const { getMongoModel: getDbModel } = require('../models/mongoModels');

const MODEL_MAP = {
  account: 'Lead',
  lead: 'Lead',
  deal: 'Deal',
  customer: 'Customer',
  quotation: 'Quotation',
};

const COLLECTION_NAME_MAP = {
  account: 'leads',
  lead: 'leads',
  deal: 'deals',
  customer: 'customers',
  quotation: 'quotations',
  remark: 'leads',
};

const getMongoModel = (entityType) => {
  const colName = COLLECTION_NAME_MAP[entityType] || 'leads';
  return getDbModel(colName);
};

const formatDateDisplay = (dateInput, includeTime = false) => {
  if (!dateInput) return '-';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    const [yyyy, mm, dd] = dateInput.trim().split('-');
    return `${dd}-${mm}-${yyyy}`;
  }
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return String(dateInput);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  if (includeTime) {
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day}-${month}-${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  }
  return `${day}-${month}-${year}`;
};

const parseUniversalDate = (val, isEnd = false) => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const s = String(val).trim();
  if (!s) return null;

  // 1. Check DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10) - 1;
    const year = parseInt(ddmmyyyy[3], 10);
    return isEnd
      ? new Date(Date.UTC(year, month, day, 23, 59, 59, 999))
      : new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  }

  // 2. Check YYYY-MM-DD
  const yyyymmdd = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (yyyymmdd) {
    const year = parseInt(yyyymmdd[1], 10);
    const month = parseInt(yyyymmdd[2], 10) - 1;
    const day = parseInt(yyyymmdd[3], 10);
    return isEnd
      ? new Date(Date.UTC(year, month, day, 23, 59, 59, 999))
      : new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  }

  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const formatCurrencyDisplay = (num) => {
  if (num === null || num === undefined || num === '' || Number.isNaN(Number(num))) return '-';
  const val = Number(num);
  return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getDateRangeBounds = (period, dateRange = {}) => {
  // 1. Explicit fromDate or toDate ALWAYS takes priority
  if (dateRange && (dateRange.fromDate || dateRange.toDate)) {
    const fromDate = parseUniversalDate(dateRange.fromDate, false);
    const toDate = parseUniversalDate(dateRange.toDate, true);
    return { fromDate, toDate };
  }

  const now = new Date();
  let fromDate = null;
  let toDate = null;

  if (period === 'daily') {
    const target = parseUniversalDate(dateRange.date, false) || now;
    fromDate = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0, 0);
    toDate = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 23, 59, 59, 999);
  } else if (period === 'monthly' && (dateRange.month !== undefined || dateRange.year)) {
    const year = dateRange.year ? Number(dateRange.year) : now.getFullYear();
    const month = dateRange.month !== undefined && dateRange.month !== '' ? Number(dateRange.month) : now.getMonth();
    fromDate = new Date(year, month, 1, 0, 0, 0, 0);
    toDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
  } else if (period === 'yearly' && dateRange.year) {
    const year = dateRange.year ? Number(dateRange.year) : now.getFullYear();
    fromDate = new Date(year, 0, 1, 0, 0, 0, 0);
    toDate = new Date(year, 11, 31, 23, 59, 59, 999);
  }

  return { fromDate, toDate };
};

const executeReportPayload = async ({
  dataSource = 'account',
  selectedFields = [],
  reportType = 'detail',
  period = 'all',
  dateRange = {},
  dateFilterField = 'accountDate',
  ownerFilter = 'all',
  quotesGeneratedRange = {},
  filters = [],
  page = 1,
  limit = 50,
  companyId,
}) => {
  const entityDefs = reportFieldDefinitions[dataSource] || reportFieldDefinitions.account;
  const Model = getMongoModel(dataSource);
  const andClauses = [];

  if (companyId) {
    andClauses.push({ companyId });
  }

  // Date Filtering (Record primary business date)
  const { fromDate, toDate } = getDateRangeBounds(period, dateRange);

  if (fromDate || toDate) {
    const fromStr = fromDate ? fromDate.toISOString().slice(0, 10) : '';
    const toStr = toDate ? toDate.toISOString().slice(0, 10) : '';
    const fromIso = fromDate ? fromDate.toISOString() : '';
    const toIso = toDate ? toDate.toISOString() : '';

    if (dataSource === 'account') {
      // 1st Priority: accountDate in formData or root. 2nd Priority fallback: createdAt
      const dateBranches = [];
      if (fromStr && toStr) {
        dateBranches.push(
          { accountDate: { $gte: fromStr, $lte: toStr } },
          { 'formData.accountDate': { $gte: fromStr, $lte: toStr } },
          { accountDate: { $gte: fromDate, $lte: toDate } },
          { 'formData.accountDate': { $gte: fromDate, $lte: toDate } },
          {
            $and: [
              { accountDate: { $in: [null, undefined, ''] } },
              { 'formData.accountDate': { $in: [null, undefined, ''] } },
              { createdAt: { $gte: fromDate, $lte: toDate } }
            ]
          }
        );
      } else if (fromStr) {
        dateBranches.push(
          { accountDate: { $gte: fromStr } },
          { 'formData.accountDate': { $gte: fromStr } },
          { accountDate: { $gte: fromDate } },
          { 'formData.accountDate': { $gte: fromDate } },
          {
            $and: [
              { accountDate: { $in: [null, undefined, ''] } },
              { 'formData.accountDate': { $in: [null, undefined, ''] } },
              { createdAt: { $gte: fromDate } }
            ]
          }
        );
      } else if (toStr) {
        dateBranches.push(
          { accountDate: { $lte: toStr } },
          { 'formData.accountDate': { $lte: toStr } },
          { accountDate: { $lte: toDate } },
          { 'formData.accountDate': { $lte: toDate } },
          {
            $and: [
              { accountDate: { $in: [null, undefined, ''] } },
              { 'formData.accountDate': { $in: [null, undefined, ''] } },
              { createdAt: { $lte: toDate } }
            ]
          }
        );
      }
      if (dateBranches.length > 0) {
        andClauses.push({ $or: dateBranches });
      }
    } else if (dataSource === 'deal') {
      // 1st Priority: dealDate (root/data). 2nd Priority: data.convertedAt. 3rd Priority fallback: createdAt
      const dateBranches = [];
      if (fromStr && toStr) {
        dateBranches.push(
          { dealDate: { $gte: fromStr, $lte: toStr } },
          { 'data.dealDate': { $gte: fromStr, $lte: toStr } },
          { 'data.data.dealDate': { $gte: fromStr, $lte: toStr } },
          { 'formData.dealDate': { $gte: fromStr, $lte: toStr } },
          { dealDate: { $gte: fromDate, $lte: toDate } },
          { 'data.dealDate': { $gte: fromDate, $lte: toDate } },
          { 'formData.dealDate': { $gte: fromDate, $lte: toDate } },
          { 'data.convertedAt': { $gte: fromIso, $lte: toIso } },
          { 'data.convertedAt': { $gte: fromStr, $lte: toStr } },
          {
            $and: [
              { dealDate: { $in: [null, undefined, ''] } },
              { 'data.dealDate': { $in: [null, undefined, ''] } },
              { 'data.convertedAt': { $in: [null, undefined, ''] } },
              { createdAt: { $gte: fromDate, $lte: toDate } }
            ]
          }
        );
      } else if (fromStr) {
        dateBranches.push(
          { dealDate: { $gte: fromStr } },
          { 'data.dealDate': { $gte: fromStr } },
          { 'data.data.dealDate': { $gte: fromStr } },
          { 'formData.dealDate': { $gte: fromStr } },
          { dealDate: { $gte: fromDate } },
          { 'data.dealDate': { $gte: fromDate } },
          { 'formData.dealDate': { $gte: fromDate } },
          { 'data.convertedAt': { $gte: fromIso } },
          { 'data.convertedAt': { $gte: fromStr } },
          {
            $and: [
              { dealDate: { $in: [null, undefined, ''] } },
              { 'data.dealDate': { $in: [null, undefined, ''] } },
              { 'data.convertedAt': { $in: [null, undefined, ''] } },
              { createdAt: { $gte: fromDate } }
            ]
          }
        );
      } else if (toStr) {
        dateBranches.push(
          { dealDate: { $lte: toStr } },
          { 'data.dealDate': { $lte: toStr } },
          { 'data.data.dealDate': { $lte: toStr } },
          { 'formData.dealDate': { $lte: toStr } },
          { dealDate: { $lte: toDate } },
          { 'data.dealDate': { $lte: toDate } },
          { 'formData.dealDate': { $lte: toDate } },
          { 'data.convertedAt': { $lte: toIso } },
          { 'data.convertedAt': { $lte: toStr } },
          {
            $and: [
              { dealDate: { $in: [null, undefined, ''] } },
              { 'data.dealDate': { $in: [null, undefined, ''] } },
              { 'data.convertedAt': { $in: [null, undefined, ''] } },
              { createdAt: { $lte: toDate } }
            ]
          }
        );
      }
      if (dateBranches.length > 0) {
        andClauses.push({ $or: dateBranches });
      }
    } else if (dataSource === 'customer') {
      const dateBranches = [];
      if (fromStr && toStr) {
        dateBranches.push(
          { addedDate: { $gte: fromStr, $lte: toStr } },
          { 'formData.addedDate': { $gte: fromStr, $lte: toStr } },
          { createdAt: { $gte: fromDate, $lte: toDate } },
          { createdAt: { $gte: fromIso, $lte: toIso } }
        );
      } else if (fromStr) {
        dateBranches.push(
          { addedDate: { $gte: fromStr } },
          { 'formData.addedDate': { $gte: fromStr } },
          { createdAt: { $gte: fromDate } }
        );
      } else if (toStr) {
        dateBranches.push(
          { addedDate: { $lte: toStr } },
          { 'formData.addedDate': { $lte: toStr } },
          { createdAt: { $lte: toDate } }
        );
      }
      if (dateBranches.length > 0) {
        andClauses.push({ $or: dateBranches });
      }
    } else if (dataSource === 'quotation') {
      // 1st Priority: data.quotationDate, quoteDate, quotationDate. 2nd Priority fallback: createdAt
      const dateBranches = [];
      if (fromStr && toStr) {
        dateBranches.push(
          { quoteDate: { $gte: fromStr, $lte: toStr } },
          { quotationDate: { $gte: fromStr, $lte: toStr } },
          { 'data.quotationDate': { $gte: fromStr, $lte: toStr } },
          { 'data.quoteDate': { $gte: fromStr, $lte: toStr } },
          { date: { $gte: fromStr, $lte: toStr } },
          {
            $and: [
              { quoteDate: { $in: [null, undefined, ''] } },
              { quotationDate: { $in: [null, undefined, ''] } },
              { 'data.quotationDate': { $in: [null, undefined, ''] } },
              { createdAt: { $gte: fromDate, $lte: toDate } }
            ]
          }
        );
      } else if (fromStr) {
        dateBranches.push(
          { quoteDate: { $gte: fromStr } },
          { quotationDate: { $gte: fromStr } },
          { 'data.quotationDate': { $gte: fromStr } },
          { 'data.quoteDate': { $gte: fromStr } },
          { date: { $gte: fromStr } },
          {
            $and: [
              { quoteDate: { $in: [null, undefined, ''] } },
              { quotationDate: { $in: [null, undefined, ''] } },
              { 'data.quotationDate': { $in: [null, undefined, ''] } },
              { createdAt: { $gte: fromDate } }
            ]
          }
        );
      } else if (toStr) {
        dateBranches.push(
          { quoteDate: { $lte: toStr } },
          { quotationDate: { $lte: toStr } },
          { 'data.quotationDate': { $lte: toStr } },
          { 'data.quoteDate': { $lte: toStr } },
          { date: { $lte: toStr } },
          {
            $and: [
              { quoteDate: { $in: [null, undefined, ''] } },
              { quotationDate: { $in: [null, undefined, ''] } },
              { 'data.quotationDate': { $in: [null, undefined, ''] } },
              { createdAt: { $lte: toDate } }
            ]
          }
        );
      }
      if (dateBranches.length > 0) {
        andClauses.push({ $or: dateBranches });
      }
    }
  }

  // "Quotes Generated Between" activity filter
  const qFromRaw = quotesGeneratedRange.generatedFrom || '';
  const qToRaw = quotesGeneratedRange.generatedTo || '';
  if (qFromRaw || qToRaw) {
    const qFrom = parseUniversalDate(qFromRaw, false);
    const qTo = parseUniversalDate(qToRaw, true);
    const qDateCond = {};
    if (qFrom && qTo) {
      qDateCond.$gte = qFrom;
      qDateCond.$lte = qTo;
    } else if (qFrom) {
      qDateCond.$gte = qFrom;
    } else if (qTo) {
      qDateCond.$lte = qTo;
    }

    if (dataSource === 'quotation') {
      andClauses.push({ createdAt: qDateCond });
    } else if (dataSource === 'account' || dataSource === 'deal') {
      try {
        const QuotationModel = getMongoModel('quotation');
        const qDocs = await QuotationModel.find(
          { createdAt: qDateCond, ...(companyId ? { companyId } : {}) },
          {
            accountId: 1,
            accountNumber: 1,
            accountNo: 1,
            dealId: 1,
            dealNumber: 1,
            dealName: 1,
            customerName: 1,
            'data.selectedAccountId': 1,
            'data.clientAccountNumber': 1,
            'data.customerName': 1,
            'data.clientName': 1,
            'data.companyName': 1,
            'data.dealNumber': 1,
            'data.dealName': 1,
          }
        ).lean();

        if (dataSource === 'account') {
          const accKeys = new Set();
          const accNames = new Set();

          qDocs.forEach((q) => {
            if (q.accountNumber) accKeys.add(String(q.accountNumber).trim());
            if (q.accountNo) accKeys.add(String(q.accountNo).trim());
            if (q.accountId) accKeys.add(String(q.accountId).trim());
            if (q.data?.clientAccountNumber) accKeys.add(String(q.data.clientAccountNumber).trim());
            if (q.data?.selectedAccountId) accKeys.add(String(q.data.selectedAccountId).trim());

            if (q.customerName) accNames.add(String(q.customerName).trim());
            if (q.data?.customerName) accNames.add(String(q.data.customerName).trim());
            if (q.data?.clientName) accNames.add(String(q.data.clientName).trim());
            if (q.data?.companyName) accNames.add(String(q.data.companyName).trim());
          });

          const accKeysArr = Array.from(accKeys).filter(Boolean);
          const accNamesArr = Array.from(accNames).filter(Boolean);

          const quoteOrBranches = [];
          if (accKeysArr.length > 0) {
            quoteOrBranches.push(
              { accountNumber: { $in: accKeysArr } },
              { accountNo: { $in: accKeysArr } },
              { 'formData.accountNumber': { $in: accKeysArr } },
              { 'formData.accountNo': { $in: accKeysArr } }
            );
          }
          if (accNamesArr.length > 0) {
            quoteOrBranches.push(
              { customerName: { $in: accNamesArr } },
              { company: { $in: accNamesArr } },
              { companyName: { $in: accNamesArr } },
              { 'formData.accountName': { $in: accNamesArr } },
              { 'formData.customerName': { $in: accNamesArr } },
              { 'formData.company': { $in: accNamesArr } }
            );
          }

          if (quoteOrBranches.length > 0) {
            andClauses.push({ $or: quoteOrBranches });
          } else {
            andClauses.push({ _id: new mongoose.Types.ObjectId() });
          }
        } else if (dataSource === 'deal') {
          const dealKeys = new Set();
          qDocs.forEach((q) => {
            if (q.dealNumber) dealKeys.add(String(q.dealNumber).trim());
            if (q.dealId) dealKeys.add(String(q.dealId).trim());
            if (q.dealName) dealKeys.add(String(q.dealName).trim());
            if (q.data?.dealNumber) dealKeys.add(String(q.data.dealNumber).trim());
            if (q.data?.dealName) dealKeys.add(String(q.data.dealName).trim());
          });
          const dealKeysArr = Array.from(dealKeys).filter(Boolean);
          if (dealKeysArr.length > 0) {
            andClauses.push({
              $or: [
                { dealNumber: { $in: dealKeysArr } },
                { 'data.dealNumber': { $in: dealKeysArr } },
                { name: { $in: dealKeysArr } },
              ],
            });
          } else {
            andClauses.push({ _id: new mongoose.Types.ObjectId() });
          }
        }
      } catch (_qErr) {}
    }
  }

  // Owner Filtering strictly by owner name / code
  if (ownerFilter && ownerFilter !== 'all') {
    const ownerCodeStr = String(ownerFilter).trim();
    andClauses.push({
      $or: [
        { ownerCode: ownerCodeStr },
        { accountOwnerCode: ownerCodeStr },
        { dealOwnerCode: ownerCodeStr },
        { customerOwnerCode: ownerCodeStr },
        { quotationOwnerCode: ownerCodeStr },
        { accountOwner: new RegExp(ownerCodeStr, 'i') },
        { dealOwner: new RegExp(ownerCodeStr, 'i') },
        { customerOwner: new RegExp(ownerCodeStr, 'i') },
        { quotationOwner: new RegExp(ownerCodeStr, 'i') },
        { 'formData.accountOwner': new RegExp(ownerCodeStr, 'i') },
        { 'formData.ownerName': new RegExp(ownerCodeStr, 'i') },
      ],
    });
  }

  const matchQuery = andClauses.length > 1 ? { $and: andClauses } : (andClauses[0] || {});

  // Build MongoDB projection object
  const projection = { createdAt: 1, _id: 1 };
  const requestedKeys = selectedFields.length > 0 ? selectedFields : Object.keys(entityDefs);

  requestedKeys.forEach((key) => {
    const def = entityDefs[key];
    if (def && def.dbField) {
      projection[def.dbField] = 1;
    }
  });

  // Always include nested and identification fields for deep extraction and normalization
  projection.formData = 1;
  projection.data = 1;
  projection.customerName = 1;
  projection.company = 1;
  projection.companyName = 1;
  projection.name = 1;
  projection.status = 1;
  projection.stage = 1;
  projection.ownerName = 1;
  projection.ownerCode = 1;
  projection.accountOwnerCode = 1;
  projection.dealOwnerCode = 1;
  projection.customerOwnerCode = 1;
  projection.quotationOwnerCode = 1;
  projection.accountOwner = 1;
  projection.dealOwner = 1;
  projection.customerOwner = 1;
  projection.quotationOwner = 1;
  projection.accountNumber = 1;
  projection.accountNo = 1;
  projection.accountDate = 1;
  projection.updatedAt = 1;
  projection.dealNumber = 1;
  projection.customerNumber = 1;
  projection.quotationNumber = 1;

  const totalCount = await Model.countDocuments(matchQuery);
  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = limit !== undefined && limit !== null ? Number(limit) : 50;

  let queryBuilder = Model.find(matchQuery, projection).sort({ createdAt: -1 });
  if (pageSize > 0) {
    queryBuilder = queryBuilder.skip((pageNum - 1) * pageSize).limit(pageSize);
  }
  const rawDocs = await queryBuilder.lean();

  // Context-specific deduplication to eliminate cross-entity collisions
  const seenIds = new Set();
  const formattedRows = [];

  rawDocs.forEach((doc) => {
    let uniqueKey = '';
    if (dataSource === 'account') {
      uniqueKey = String(doc._id || doc.accountNumber || doc.accountNo || '').trim();
    } else if (dataSource === 'deal') {
      uniqueKey = String(doc._id || doc.dealNumber || doc.data?.dealNumber || '').trim();
    } else if (dataSource === 'customer') {
      uniqueKey = String(doc._id || doc.customerNumber || doc.customerNo || '').trim();
    } else if (dataSource === 'quotation') {
      uniqueKey = String(doc._id || doc.quotationNumber || doc.quoteNumber || '').trim();
    } else {
      uniqueKey = String(doc._id || '').trim();
    }

    if (uniqueKey && seenIds.has(uniqueKey)) {
      return;
    }
    if (uniqueKey) {
      seenIds.add(uniqueKey);
    }

    const row = {};
    requestedKeys.forEach((key) => {
      const def = entityDefs[key];
      if (!def) return;

      // Deep value resolution across root and nested objects
      let rawVal = doc[def.dbField];
      if (rawVal === undefined || rawVal === null || rawVal === '') {
        if (doc.formData && doc.formData[def.dbField] !== undefined) {
          rawVal = doc.formData[def.dbField];
        } else if (doc.formData && doc.formData[key] !== undefined) {
          rawVal = doc.formData[key];
        } else if (doc.data && doc.data[def.dbField] !== undefined) {
          rawVal = doc.data[def.dbField];
        } else if (doc[key] !== undefined) {
          rawVal = doc[key];
        }
      }

      // Context-aware deep fallbacks with exact 1st Priority vs Fallback logic
      if (key === 'name' || key === 'accountName') {
        rawVal = rawVal || doc.formData?.accountName || doc.customerName || doc.company || doc.name || doc.companyName || doc.title;
      } else if (key === 'accountDate') {
        rawVal = rawVal || doc.formData?.accountDate || doc.accountDate || doc.createdAt;
      } else if (key === 'updatedAt') {
        rawVal = rawVal || doc.updatedAt || doc.createdAt;
      } else if (key === 'accountNo' || key === 'accountNumber') {
        rawVal = rawVal || doc.accountNumber || doc.accountNo || doc.formData?.accountNumber || doc.formData?.accountNo || doc.data?.accountNumber || doc.data?.accountOwnerCode;
      } else if (key === 'accountOwner') {
        rawVal = rawVal || doc.formData?.accountOwner || doc.formData?.ownerName || doc.ownerName || doc.accountOwner;
      } else if (key === 'status' || key === 'accountStatus' || key === 'dealStatus') {
        rawVal = rawVal || doc.formData?.accountStatus || doc.formData?.status || doc.status || doc.stage || doc.data?.stage || doc.data?.status;
      } else if (key === 'projectName') {
        rawVal = rawVal || doc.formData?.projectName || doc.projectName || doc.formData?.project || doc.project || doc.data?.projectName;
      } else if (key === 'contactPerson') {
        rawVal = rawVal || doc.formData?.contactPerson || doc.contactPerson || doc.contactName || doc.data?.contactPerson;
      } else if (key === 'phone' || key === 'mobile' || key === 'contactMobile' || key === 'contactPhone') {
        rawVal = rawVal || doc.formData?.phone || doc.formData?.mobile || doc.phone || doc.mobile || doc.contactMobile || doc.contactPhone || doc.data?.contactMobile;
      } else if (key === 'email' || key === 'contactEmail') {
        rawVal = rawVal || doc.formData?.email || doc.email || doc.contactEmail || doc.data?.contactEmail;
      } else if (key === 'accountCategory') {
        rawVal = rawVal || doc.formData?.accountCategory || doc.accountCategory;
      } else if (key === 'accountSource') {
        rawVal = rawVal || doc.formData?.accountSource || doc.accountSource || doc.source;
      } else if (key === 'addedBy') {
        rawVal = rawVal || doc.formData?.addedBy || doc.addedBy || doc.creatorName || doc.createdBy;
      } else if (key === 'customerName') {
        rawVal = rawVal || doc.customerName || doc.formData?.customerName || doc.data?.customerName || doc.data?.clientName || doc.title;
      } else if (key === 'customerNumber') {
        rawVal = rawVal || doc.customerNumber || doc.customerNo || doc.formData?.customerNumber;
      } else if (key === 'dealNumber') {
        rawVal = rawVal || doc.dealNumber || doc.data?.dealNumber;
      } else if (key === 'dealName') {
        rawVal = rawVal || doc.dealName || doc.title || doc.data?.dealName || doc.data?.name || doc.data?.title;
      } else if (key === 'dealDate') {
        rawVal = rawVal || doc.dealDate || doc.data?.dealDate || doc.data?.data?.dealDate || doc.formData?.dealDate || doc.data?.convertedAt || doc.createdAt;
      } else if (key === 'dealOwner') {
        rawVal = rawVal || doc.data?.dealOwner || doc.data?.ownerName || doc.data?.accountOwner || doc.ownerName || doc.dealOwner;
      } else if (key === 'dealType') {
        rawVal = rawVal || doc.dealType || doc.data?.dealType;
      } else if (key === 'dealSource') {
        rawVal = rawVal || doc.dealSource || doc.source || doc.data?.dealSource || doc.data?.source;
      } else if (key === 'quotationNumber' || key === 'quoteNumber') {
        rawVal = rawVal || doc.data?.quotationNumber || doc.quotationNumber || doc.quoteNumber;
      } else if (key === 'quotationDate' || key === 'quoteDate') {
        rawVal = rawVal || doc.data?.quotationDate || doc.quoteDate || doc.quotationDate || doc.createdAt;
      } else if (key === 'quotationOwner') {
        rawVal = rawVal || doc.data?.selectedAccountOwner || doc.quotationOwner || doc.assignedTo || doc.createdBy;
      } else if (key === 'amount' || key === 'dealValue' || key === 'grandTotal' || key === 'value') {
        rawVal = rawVal !== undefined && rawVal !== null && rawVal !== '' ? rawVal : (doc.data?.dealValue || doc.data?.amount || doc.dealValue || doc.amount || doc.totalAmount || 0);
      } else if (key === 'expectedClosureDate' || key === 'expectedCloseDate') {
        rawVal = rawVal || doc.expectedCloseDate || doc.expectedClosureDate || doc.closeDate || doc.data?.expectedClosureDate;
      }

      if (def.type === 'currency') {
        row[def.label] = formatCurrencyDisplay(rawVal);
      } else if (def.type === 'date' || def.type === 'datetime') {
        const isTimeField = key === 'updatedAt' || key === 'createdAt' || def.type === 'datetime';
        row[def.label] = formatDateDisplay(rawVal, isTimeField);
      } else {
        row[def.label] = rawVal !== undefined && rawVal !== null && rawVal !== '' ? String(rawVal) : '-';
      }
    });

    // Attach metadata for isolation processing
    row._ownerCode = String(
      doc.ownerCode || doc.accountOwnerCode || doc.dealOwnerCode || doc.customerOwnerCode || doc.quotationOwnerCode || ''
    ).trim();
    row._ownerName = String(
      doc.accountOwner || doc.formData?.accountOwner || doc.formData?.ownerName || doc.ownerName || doc.dealOwner || doc.customerOwner || doc.quotationOwner || doc._ownerCode || 'Unassigned'
    ).trim();
    row._id = doc._id ? String(doc._id) : undefined;

    formattedRows.push(row);
  });

  return {
    dataSource,
    selectedFields: requestedKeys,
    fieldLabels: requestedKeys.map((key) => entityDefs[key]?.label || key),
    rows: formattedRows,
    totalRecords: totalCount,
    page: pageNum,
    limit: pageSize,
    totalPages: pageSize > 0 ? Math.ceil(totalCount / pageSize) : 1,
    period,
    dateBounds: { fromDate, toDate },
  };
};


// Generate CSV string representation of report dataset
const generateCsvBuffer = (fieldLabels, rows) => {
  const escapeCsv = (val) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = fieldLabels.map(escapeCsv).join(',');
  const dataRows = rows.map((row) => fieldLabels.map((label) => escapeCsv(row[label])).join(','));
  return Buffer.from([headerRow, ...dataRows].join('\r\n'), 'utf-8');
};

const sendOwnerWiseReportEmails = async ({
  dataSource = 'account',
  selectedFields = [],
  reportType = 'detail',
  period = 'monthly',
  dateRange = {},
  ownerFilter = 'all',
  sendCopyToAdmin = true,
  customSubject = '',
  customMessage = '',
  companyId,
  actor = {},
}) => {
  const result = await executeReportPayload({
    dataSource,
    selectedFields,
    reportType,
    period,
    dateRange,
    ownerFilter,
    companyId,
  });

  const { rows, fieldLabels } = result;
  if (!rows || rows.length === 0) {
    return {
      success: true,
      message: 'No matching records found for email dispatch.',
      dispatchMatrix: [],
    };
  }

  // Group records by ownerCode
  const ownerGroups = {};
  rows.forEach((row) => {
    const ownerCodeKey = row._ownerCode || row._ownerName || 'default';
    if (!ownerGroups[ownerCodeKey]) {
      ownerGroups[ownerCodeKey] = {
        ownerCode: row._ownerCode,
        ownerName: row._ownerName,
        rows: [],
      };
    }
    ownerGroups[ownerCodeKey].rows.push(row);
  });

  const dispatchMatrix = [];
  const dbUsers = await mongoose.connection.db.collection('users').find({}).toArray();

  const findUserByOwnerCode = (code, name) => {
    const codeStr = String(code || '').trim();
    const nameStr = String(name || '').trim().toLowerCase();

    return dbUsers.find((u) => {
      const uCode = String(u.ownerCode || u.owner_code || u.employeeId || '').trim();
      const uName = String(u.name || u.username || '').trim().toLowerCase();
      if (codeStr && uCode === codeStr) return true;
      if (nameStr && uName === nameStr) return true;
      return false;
    });
  };

  // Dispatch Owner-Isolated Emails
  for (const groupKey of Object.keys(ownerGroups)) {
    const group = ownerGroups[groupKey];
    const userMatch = findUserByOwnerCode(group.ownerCode, group.ownerName);
    const targetEmail = userMatch?.email || '';

    if (!targetEmail) {
      dispatchMatrix.push({
        ownerName: group.ownerName,
        ownerCode: group.ownerCode || '-',
        recordCount: group.rows.length,
        entitySource: dataSource.toUpperCase(),
        targetEmail: 'Not Found in DB users',
        status: 'Failed (Email Missing)',
      });
      continue;
    }

    const csvContent = generateCsvBuffer(fieldLabels, group.rows);
    const filename = `${dataSource}_report_${group.ownerName.replace(/\s+/g, '_')}_${Date.now()}.csv`;
    const subject = customSubject || `CRM Custom Report (${dataSource.toUpperCase()}) - ${group.ownerName}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
        <p>Dear <strong>${group.ownerName}</strong>,</p>
        <p>${customMessage || `Please find attached your personalized CRM ${dataSource.toUpperCase()} report.`}</p>
        <ul>
          <li><strong>Data Source:</strong> ${dataSource.toUpperCase()}</li>
          <li><strong>Total Records:</strong> ${group.rows.length}</li>
          <li><strong>Period:</strong> ${period.toUpperCase()}</li>
          <li><strong>Generated On:</strong> ${formatDateDisplay(new Date())}</li>
        </ul>
        <p>Best regards,<br/>SWATI SWITCHGEARS INDIA PVT LTD</p>
      </div>
    `;

    try {
      await emailService.sendEmail({
        to: targetEmail,
        subject,
        html: htmlBody,
      });

      dispatchMatrix.push({
        ownerName: group.ownerName,
        ownerCode: group.ownerCode || '-',
        recordCount: group.rows.length,
        entitySource: dataSource.toUpperCase(),
        targetEmail,
        status: 'Sent ✅',
      });
    } catch (err) {
      dispatchMatrix.push({
        ownerName: group.ownerName,
        ownerCode: group.ownerCode || '-',
        recordCount: group.rows.length,
        entitySource: dataSource.toUpperCase(),
        targetEmail,
        status: `Failed ⚠️ (${err.message})`,
      });
    }
  }

  // Send Consolidated Copy to Admin if Enabled
  if (sendCopyToAdmin && actor.email) {
    try {
      const adminCsv = generateCsvBuffer(fieldLabels, rows);
      const adminSubject = `[ADMIN COPY] Consolidated CRM Custom Report (${dataSource.toUpperCase()})`;
      const adminBody = `
        <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
          <p>Dear Admin (${actor.name || 'Admin'}),</p>
          <p>Attached is the consolidated custom report for all owners.</p>
          <ul>
            <li><strong>Total Records:</strong> ${rows.length}</li>
            <li><strong>Owners Included:</strong> ${Object.keys(ownerGroups).length}</li>
          </ul>
        </div>
      `;
      await emailService.sendEmail({
        to: actor.email,
        subject: adminSubject,
        html: adminBody,
      });

      dispatchMatrix.push({
        ownerName: `ADMIN (${actor.name || 'Admin'})`,
        ownerCode: 'ADMIN',
        recordCount: rows.length,
        entitySource: dataSource.toUpperCase(),
        targetEmail: actor.email,
        status: 'Sent (Consolidated Copy) ✅',
      });
    } catch (_adminErr) {
      // Ignored non-blocking admin email error
    }
  }

  return {
    success: true,
    message: `Dispatched reports to ${dispatchMatrix.filter((m) => m.status.includes('Sent')).length} recipient(s).`,
    dispatchMatrix,
  };
};

module.exports = {
  executeReportPayload,
  sendOwnerWiseReportEmails,
  getDateRangeBounds,
};
