/**
 * Universal Document Field Resolver & Central Type Converter
 * Dynamically resolves any requested field (human label, camelCase, snake_case)
 * across MongoDB collections ('leads', 'deals', 'customers', 'quotations', 'users')
 * without hardcoding.
 */

function canonicalizeKey(key) {
  if (!key) return '';
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseUniversalDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  const str = String(val).trim();
  if (!str) return null;

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    const d = parseInt(dmy[1], 10);
    const m = parseInt(dmy[2], 10) - 1;
    const y = parseInt(dmy[3], 10);
    const dt = new Date(y, m, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // YYYY-MM-DD
  const ymd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) {
    const y = parseInt(ymd[1], 10);
    const m = parseInt(ymd[2], 10) - 1;
    const d = parseInt(ymd[3], 10);
    const dt = new Date(y, m, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateDisplay(val, includeTime = false) {
  const d = parseUniversalDate(val);
  if (!d) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  if (includeTime) {
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${day}/${month}/${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  }
  return `${day}/${month}/${year}`;
}

function formatNumberOrCurrency(val, isCurrency = false) {
  if (val === undefined || val === null || val === '') return '-';
  const cleanStr = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleanStr);
  if (isNaN(num)) return String(val);
  if (isCurrency) {
    return `${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return num;
}

function findDeepFieldValue(doc, requestedKey) {
  if (!doc || typeof doc !== 'object') return undefined;
  const targetCanon = canonicalizeKey(requestedKey);
  if (!targetCanon) return undefined;

  const containers = [
    doc,
    doc.formData,
    doc.data,
    doc.data && doc.data.data,
    doc.raw,
  ].filter(c => c && typeof c === 'object');

  for (const container of containers) {
    if (container[requestedKey] !== undefined && container[requestedKey] !== null && container[requestedKey] !== '') {
      return container[requestedKey];
    }
    for (const [key, value] of Object.entries(container)) {
      if (canonicalizeKey(key) === targetCanon) {
        if (value !== undefined && value !== null && value !== '') {
          return value;
        }
      }
    }
  }

  return undefined;
}

function resolveDocumentField(doc, fieldIdentifier, usersLookupMap = {}) {
  const canon = canonicalizeKey(fieldIdentifier);

  let rawVal = findDeepFieldValue(doc, fieldIdentifier);

  if (rawVal === undefined || rawVal === null || rawVal === '') {
    if (canon.includes('accountname') || canon === 'name' || canon === 'company' || canon === 'companyname') {
      rawVal = findDeepFieldValue(doc, 'accountName') || findDeepFieldValue(doc, 'name') || findDeepFieldValue(doc, 'companyName') || findDeepFieldValue(doc, 'company') || findDeepFieldValue(doc, 'customerName') || findDeepFieldValue(doc, 'title');
    } else if (canon.includes('accountno') || canon.includes('accountnumber') || canon === 'id') {
      rawVal = findDeepFieldValue(doc, 'accountNumber') || findDeepFieldValue(doc, 'accountNo') || findDeepFieldValue(doc, 'id') || doc._id;
    } else if (canon.includes('dealno') || canon.includes('dealnumber')) {
      rawVal = findDeepFieldValue(doc, 'dealNumber') || findDeepFieldValue(doc, 'id') || doc._id;
    } else if (canon.includes('quotationno') || canon.includes('quotationnumber') || canon.includes('quotenumber')) {
      rawVal = findDeepFieldValue(doc, 'quotationNumber') || findDeepFieldValue(doc, 'quoteNumber') || findDeepFieldValue(doc, 'quotationNo') || doc._id;
    } else if (canon.includes('customerno') || canon.includes('customernumber')) {
      rawVal = findDeepFieldValue(doc, 'customerNumber') || findDeepFieldValue(doc, 'customerNo') || doc._id;
    } else if (canon.includes('date')) {
      rawVal = findDeepFieldValue(doc, 'accountDate') || findDeepFieldValue(doc, 'dealDate') || findDeepFieldValue(doc, 'quotationDate') || findDeepFieldValue(doc, 'quoteDate') || findDeepFieldValue(doc, 'date') || doc.createdAt;
    } else if (canon.includes('owner')) {
      rawVal = findDeepFieldValue(doc, 'accountOwner') || findDeepFieldValue(doc, 'dealOwner') || findDeepFieldValue(doc, 'quotationOwner') || findDeepFieldValue(doc, 'customerOwner') || findDeepFieldValue(doc, 'ownerName') || findDeepFieldValue(doc, 'owner') || findDeepFieldValue(doc, 'assignedTo') || findDeepFieldValue(doc, 'ownerCode');
    } else if (canon.includes('status') || canon.includes('stage')) {
      rawVal = findDeepFieldValue(doc, 'accountStatus') || findDeepFieldValue(doc, 'dealStatus') || findDeepFieldValue(doc, 'status') || findDeepFieldValue(doc, 'stage');
    } else if (canon.includes('value') || canon.includes('amount') || canon.includes('total')) {
      rawVal = findDeepFieldValue(doc, 'poValue') || findDeepFieldValue(doc, 'dealValue') || findDeepFieldValue(doc, 'grandTotal') || findDeepFieldValue(doc, 'amount') || findDeepFieldValue(doc, 'total') || findDeepFieldValue(doc, 'value');
    }
  }

  // Type conversion
  if (canon.includes('owner') || canon.includes('user') || canon.includes('assignedto')) {
    if (rawVal) {
      const rawStr = String(rawVal).trim().toLowerCase();
      if (usersLookupMap && usersLookupMap[rawStr]) {
        return usersLookupMap[rawStr];
      }
    }
    return rawVal ? String(rawVal) : '-';
  }

  if (canon.includes('date') || canon.includes('createdat') || canon.includes('updatedat') || canon.includes('addedon')) {
    const isTime = canon.includes('createdat') || canon.includes('updatedat') || canon.includes('time');
    return formatDateDisplay(rawVal, isTime);
  }

  if (canon.includes('povalue') || canon.includes('dealvalue') || canon.includes('grandtotal') || canon.includes('amount')) {
    return formatNumberOrCurrency(rawVal, true);
  }

  if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
    if (typeof rawVal === 'object') {
      if (rawVal instanceof Date) return formatDateDisplay(rawVal);
      if (rawVal.name) return String(rawVal.name);
      if (rawVal.label) return String(rawVal.label);
      if (rawVal.value) return String(rawVal.value);
    }
    return String(rawVal);
  }

  return '-';
}

module.exports = {
  canonicalizeKey,
  parseUniversalDate,
  formatDateDisplay,
  formatNumberOrCurrency,
  findDeepFieldValue,
  resolveDocumentField,
};
