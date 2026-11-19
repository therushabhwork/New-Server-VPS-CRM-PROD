const { connectDatabase } = require('../config/db');
const mongoose = require('mongoose');
const { executeTemplateReport } = require('../services/customReportEngine');

// Check excel cell formatting in excelExport
const parseNumericLike = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/[ ,]/g, '').replace(/[^\d.\-+eE]/g, '');
    if (trimmed === '' || trimmed === '-' || trimmed === '+') return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toExcelSerialDate = (input, withTime) => {
  let date = null;
  if (input instanceof Date) {
    date = input;
  } else if (typeof input === 'string' && input.trim()) {
    // If DD/MM/YYYY
    const ddmmyyyy = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (ddmmyyyy) {
      date = new Date(parseInt(ddmmyyyy[3], 10), parseInt(ddmmyyyy[2], 10) - 1, parseInt(ddmmyyyy[1], 10));
    } else {
      const parsed = new Date(input);
      if (!Number.isNaN(parsed.getTime())) date = parsed;
    }
  }
  if (!date) return null;
  const epoch = Date.UTC(1899, 11, 30);
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds());
  return (utc - epoch) / (24 * 60 * 60 * 1000);
};

console.log('Testing "17/09/2026":', toExcelSerialDate('17/09/2026'));
console.log('Testing "2026-09-17":', toExcelSerialDate('2026-09-17'));

// In excelExport.js:
// const toExcelSerialDate in excelExport.js:
// let date = null
// if (input instanceof Date) date = input
// else if (typeof input === 'string' && input.trim()) {
//   const parsed = new Date(input)
//   if (!Number.isNaN(parsed.getTime())) date = parsed
// }
// What does new Date('17/09/2026') evaluate to in V8 / Node / Chrome?
const d1 = new Date('17/09/2026');
console.log('new Date("17/09/2026") in JS is:', d1.toString(), 'isNaN?', isNaN(d1.getTime()));
