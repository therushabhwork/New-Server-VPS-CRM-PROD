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
  // Check for BSON date objects or MongoDB extended JSON representations
  if (typeof val === 'object') {
    if (val.$date) {
      if (typeof val.$date === 'object' && val.$date.$numberLong) {
        const num = parseInt(val.$date.$numberLong, 10);
        const d = new Date(num);
        return isNaN(d.getTime()) ? null : d;
      }
      return parseUniversalDate(val.$date);
    }
    if (val.$numberLong) {
      const num = parseInt(val.$numberLong, 10);
      const d = new Date(num);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  const str = String(val).trim();
  if (!str || str === '[object Object]') return null;

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (dmy) {
    const d = parseInt(dmy[1], 10);
    const m = parseInt(dmy[2], 10) - 1;
    let y = parseInt(dmy[3], 10);
    if (y < 100) y += 2000;
    const dt = new Date(y, m, d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // YYYY-MM-DD
  const ymd = str.match(/^(\d{2,4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) {
    let y = parseInt(ymd[1], 10);
    if (y < 100) y += 2000;
    const m = parseInt(ymd[2], 10) - 1;
    const d = parseInt(ymd[3], 10);
    if (str.includes('T') || str.includes(':')) {
      const parsedIso = new Date(str);
      if (!isNaN(parsedIso.getTime())) return parsedIso;
    }
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

  const strippedKey = typeof requestedKey === 'string' && requestedKey.startsWith('q_') ? requestedKey.slice(2) : null;
  const strippedCanon = strippedKey ? canonicalizeKey(strippedKey) : null;

  const containers = [
    doc,
    doc.formData,
    doc.formData && doc.formData.formData,
    doc.data,
    doc.data && doc.data.data,
    doc.raw,
  ].filter(c => c && typeof c === 'object');

  for (const container of containers) {
    if (container[requestedKey] !== undefined && container[requestedKey] !== null && container[requestedKey] !== '') {
      return container[requestedKey];
    }
    if (strippedKey && container[strippedKey] !== undefined && container[strippedKey] !== null && container[strippedKey] !== '') {
      return container[strippedKey];
    }
    for (const [key, value] of Object.entries(container)) {
      const cKey = canonicalizeKey(key);
      if (cKey === targetCanon || (strippedCanon && cKey === strippedCanon)) {
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

  if (canon.includes('accountname') || canon.includes('customername') || canon.includes('company') || canon === 'name') {
    const pName = doc.projectName || doc.formData?.projectName || doc.data?.projectName || (doc.formData && doc.formData['Project Name']);
    const accCandidate = doc.companyName || doc.data?.companyName || doc.formData?.companyName || doc.accountName || doc.data?.customerReference?.accountName || doc.formData?.accountName || (doc.formData && doc.formData['Account Name']) || doc.customerName || doc.formData?.customerName;
    if (accCandidate && pName && String(rawVal || doc.name || '').trim().toLowerCase() === String(pName).trim().toLowerCase()) {
      rawVal = accCandidate;
    } else if (rawVal === undefined || rawVal === null || rawVal === '') {
      rawVal = accCandidate || findDeepFieldValue(doc, 'name') || findDeepFieldValue(doc, 'company') || findDeepFieldValue(doc, 'title');
    }
  } else if (canon.includes('revision')) {
    rawVal = doc.revisionCode || doc.data?.revisionCode || (Array.isArray(doc.revisions) && doc.revisions.length > 0 ? doc.revisions[doc.revisions.length - 1]?.revisionCode : 'R0') || 'R0';
  } else if (canon.includes('quotationdate') || canon === 'qdate' || (canon.includes('date') && (doc.data?.quotationDate || doc.quotationNumber))) {
    const revs = doc.data?.revisions || doc.revisions;
    const activeCode = doc.revisionCode || doc.data?.revisionCode;
    let revMatchDate = null;
    if (Array.isArray(revs) && activeCode) {
      const match = revs.find((r) => r.revisionCode === activeCode);
      if (match && match.date) revMatchDate = match.date;
    }
    const revisedQuoteDate = revMatchDate || doc.data?.quotationDate || doc.data?.customerReference?.date || doc.quotationDate || doc.date || doc.createdAt;
    if (revisedQuoteDate) {
      rawVal = revisedQuoteDate;
    }
  } else if (canon.includes('createdat') || canon.includes('creationdate') || canon.includes('createdon')) {
    rawVal = doc.createdAt || doc.data?.createdAt || findDeepFieldValue(doc, 'createdAt') || '-';
  } else if (canon.includes('updated') || canon.includes('lastupdate') || canon.includes('modified')) {
    rawVal = doc.updatedAt || doc.data?.updatedAt || findDeepFieldValue(doc, 'updatedAt') || findDeepFieldValue(doc, 'lastUpdated') || '-';
  } else if (canon.includes('project')) {
    rawVal = findDeepFieldValue(doc, 'projectName') ||
      findDeepFieldValue(doc, 'project') ||
      doc.projectName ||
      doc.formData?.projectName ||
      (doc.formData && doc.formData['Project Name']) ||
      doc.data?.projectName ||
      (Array.isArray(doc.formData?.projects) && doc.formData.projects[0]?.projectName) ||
      findDeepFieldValue(doc, 'dealName') ||
      doc.dealName ||
      doc.formData?.dealName;
    if (!rawVal || rawVal === '-') {
      const accName = doc.accountName || doc.formData?.accountName;
      if (doc.name && accName && String(doc.name).trim().toLowerCase() !== String(accName).trim().toLowerCase()) {
        rawVal = doc.name;
      }
    }
  } else if (rawVal === undefined || rawVal === null || rawVal === '') {
    if (canon.includes('accountno') || canon.includes('accountnumber') || canon === 'id') {
      rawVal = findDeepFieldValue(doc, 'accountNumber') || findDeepFieldValue(doc, 'accountNo') || findDeepFieldValue(doc, 'id') || doc._id;
    } else if (canon.includes('dealno') || canon.includes('dealnumber')) {
      rawVal = findDeepFieldValue(doc, 'dealNumber') || findDeepFieldValue(doc, 'id') || doc._id;
    } else if (canon.includes('quotationno') || canon.includes('quotationnumber') || canon.includes('quotenumber')) {
      rawVal = findDeepFieldValue(doc, 'quotationNumber') || findDeepFieldValue(doc, 'quoteNumber') || findDeepFieldValue(doc, 'quotationNo') || doc._id;
    } else if (canon.includes('customerno') || canon.includes('customernumber')) {
      rawVal = findDeepFieldValue(doc, 'customerNumber') || findDeepFieldValue(doc, 'customerNo') || doc._id;
    } else if (canon.includes('project')) {
      rawVal = findDeepFieldValue(doc, 'projectName') ||
        findDeepFieldValue(doc, 'project') ||
        doc.projectName ||
        doc.formData?.projectName ||
        doc.data?.projectName ||
        (Array.isArray(doc.formData?.projects) && doc.formData.projects[0]?.projectName) ||
        findDeepFieldValue(doc, 'dealName') ||
        doc.dealName ||
        doc.formData?.dealName;
    } else if (canon.includes('date')) {
      rawVal = findDeepFieldValue(doc, 'accountDate') || findDeepFieldValue(doc, 'dealDate') || findDeepFieldValue(doc, 'quotationDate') || findDeepFieldValue(doc, 'quoteDate') || findDeepFieldValue(doc, 'convertedAt') || findDeepFieldValue(doc, 'date') || doc.createdAt;
    } else if (canon.includes('updated') || canon.includes('lastupdate') || canon.includes('modified')) {
      rawVal = findDeepFieldValue(doc, 'updatedAt') || findDeepFieldValue(doc, 'lastUpdated') || findDeepFieldValue(doc, 'lastUpdate') || doc.updatedAt || doc.createdAt;
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

  if (canon.includes('email') || canon.includes('mail')) {
    if (rawVal && String(rawVal).trim() !== '' && String(rawVal).trim() !== '-') {
      return String(rawVal).trim();
    }
    // Fallback: resolve owner email dynamically from usersLookupMap._emails
    const ownerCandidate = findDeepFieldValue(doc, 'dealOwner') ||
      findDeepFieldValue(doc, 'accountOwner') ||
      findDeepFieldValue(doc, 'customerOwner') ||
      findDeepFieldValue(doc, 'quotationOwner') ||
      findDeepFieldValue(doc, 'ownerName') ||
      findDeepFieldValue(doc, 'owner') ||
      findDeepFieldValue(doc, 'ownerCode') ||
      findDeepFieldValue(doc, 'assignedTo');

    if (ownerCandidate && usersLookupMap && usersLookupMap._emails) {
      const ownerKey = String(ownerCandidate).trim().toLowerCase();
      if (usersLookupMap._emails[ownerKey]) {
        return usersLookupMap._emails[ownerKey];
      }
      if (usersLookupMap[ownerKey] && usersLookupMap._emails[String(usersLookupMap[ownerKey]).toLowerCase()]) {
        return usersLookupMap._emails[String(usersLookupMap[ownerKey]).toLowerCase()];
      }
    }
    return rawVal ? String(rawVal) : '-';
  }

  if (canon.includes('date') || canon.includes('createdat') || canon.includes('updated') || canon.includes('lastupdate') || canon.includes('modified') || canon.includes('addedon') || canon.includes('validuntil') || canon.includes('closure')) {
    const isTime = canon.includes('createdat') || canon.includes('updated') || canon.includes('lastupdate') || canon.includes('time') || canon.includes('modified');
    return formatDateDisplay(rawVal, isTime);
  }

  if (canon.includes('status') || canon.includes('stage')) {
    const str = String(rawVal || '').replace(/_/g, ' ').trim();
    if (str && str !== '-') {
      return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
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
