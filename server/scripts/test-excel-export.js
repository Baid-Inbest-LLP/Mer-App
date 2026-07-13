/**
 * Smoke test for MER styled Excel export (no DB required).
 * Run: node scripts/test-excel-export.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import {
  buildMerStyledSheet,
  buildDetailTitle,
  createMerWorkbook,
} from '../src/utils/excelGenerator.js';
import { readAssetBuffer, readWatermarkBuffer } from '../src/utils/assetLoader.js';
import { amountToWordsINR } from '../src/utils/amountToWords.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../tmp');
const MIN_MONEY_COL_WIDTH = 20;
const MIN_MER_NO_COL_WIDTH = 36;
const LONG_MER_NO = 'EXP/BSIBPL/26-27/Jun/001';

const companyCtx = {
  companyCode: 'BILLP',
  companyName: 'Baid Inbest Llp',
  taxId: '19AALFB4917G1ZB',
  phone: '8981541333',
  address: '6th Floor, Suite No 608 And 609, Ashoka House, 3a, Hare St, B.b.d. Bagh, Kolkata, West Bengal, 700001, India',
};

const query = {
  financialYear: '2025-2026',
  month: 'June',
  company: 'Baid Inbest Llp',
  location: 'HQ',
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const assets = ['Shree_black.png', 'Inbest_Logo(Blue).png', 'inbest-water-mark.png'];
assets.forEach((name) => {
  const buf = readAssetBuffer(name);
  assert(buf && buf.length > 0, `Missing asset: ${name}`);
  console.log(`✓ asset loaded: ${name} (${buf.length} bytes)`);
});

assert(amountToWordsINR(125000).includes('Rupees'), 'amountToWordsINR failed');
console.log(`✓ amountToWordsINR: ${amountToWordsINR(125000)}`);

const watermarkBuf = readWatermarkBuffer();
assert(watermarkBuf && watermarkBuf.length > 0, 'Watermark buffer missing');
console.log(`✓ watermark processed: ${watermarkBuf.length} bytes`);

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const largeNet = 9876543;
const largeGst = 1777777;
const largeTds = 123456;
const largeGross = largeNet + largeGst - largeTds;

const wb = createMerWorkbook();
buildMerStyledSheet(wb, {
  sheetName: 'June',
  title: buildDetailTitle(query),
  reportNo: 'MER/BILLP/HQ/25-26/Jun',
  headers: [
    'S.No', 'Expense No', 'Invoice Date', 'Month', 'Company', 'Co Name',
    'Head of Expense', 'Particulars', 'Expense Type', 'Net Amount',
    'Total GST', 'TDS', 'Gross Amount', 'Payment Method', 'Approval Status',
  ],
  rows: [
    [1, LONG_MER_NO, '15-06-2025', 'June', 'Baid Inbest Llp', 'Test Co',
      'Office Supplies', 'Printer paper and toner cartridges', 'Revenue',
      largeNet, largeGst, largeTds, largeGross, 'Bank', 'Completed'],
    [2, 'EXP/BSIBPL/26-27/Jun/002', '20-06-2025', 'June', 'Baid Inbest Llp', 'Test Co 2',
      'Travel', 'Cab fare', 'Revenue', 5000, 0, 100, 4900, 'UPI', 'Completed'],
  ],
  totalsRow: [
    '', 'Totals', '', '', '', '', '', '', '2 entries',
    largeNet + 5000, largeGst, largeTds + 100, largeGross + 4900, '', '',
  ],
  grandTotal: largeGross + 4900,
  footerAddress: companyCtx.address,
  companyCtx,
  moneyColIndices: [9, 10, 11, 12],
  gstColIndex: 10,
  tdsColIndex: 11,
  totalColIndex: 12,
});

buildMerStyledSheet(wb, {
  sheetName: 'Summary',
  title: 'MER Summary Report',
  reportNo: '',
  headers: ['Metric', 'Value'],
  rows: [
    ['Total Net', largeNet + 5000],
    ['Gross Amount', largeGross + 4900],
    ['Entries', 2],
  ],
  totalsRow: null,
  grandTotal: largeGross + 4900,
  footerAddress: companyCtx.address,
  companyCtx,
  moneyColIndices: [],
});

const detailPath = path.join(outDir, 'mer-detail-test.xlsx');
await wb.xlsx.writeFile(detailPath);
assert(fs.existsSync(detailPath), 'Excel file was not written');
assert(fs.statSync(detailPath).size > 5000, 'Excel file too small — likely missing images');
console.log(`✓ wrote ${detailPath} (${fs.statSync(detailPath).size} bytes)`);

const verifyWb = new ExcelJS.Workbook();
await verifyWb.xlsx.readFile(detailPath);
const detailSheet = verifyWb.getWorksheet('June');
assert(detailSheet, 'June sheet missing');

const moneyCols = [11, 12, 13, 14, 16];
moneyCols.forEach((colNum) => {
  const width = detailSheet.getColumn(colNum).width || 0;
  assert(width >= MIN_MONEY_COL_WIDTH, `Column ${colNum} width ${width} < ${MIN_MONEY_COL_WIDTH}`);
  console.log(`✓ column ${colNum} width: ${width}`);
});

let grossCell = null;
let grandTotalCell = null;
let merNoCell = null;

detailSheet.eachRow((row) => {
  const merNo = row.getCell(3).value;
  if (merNo === LONG_MER_NO) {
    grossCell = row.getCell(14);
    merNoCell = row.getCell(3);
  }
  if (row.getCell(2).value === 'TOTAL AMOUNT') {
    grandTotalCell = row.getCell(16);
  }
});

assert(merNoCell, 'Expense No data row not found');
assert(merNoCell.value === LONG_MER_NO, `Expense No value mismatch: ${merNoCell.value}`);
assert(merNoCell.numFmt === '@', `Expense No should use text format, got ${merNoCell.numFmt}`);
assert((detailSheet.getColumn(3).width || 0) >= MIN_MER_NO_COL_WIDTH, 'Expense No column too narrow');
console.log(`✓ Expense No cell: ${merNoCell.value} (width: ${detailSheet.getColumn(3).width})`);

assert(grossCell, 'Gross amount data row not found');
assert(typeof grossCell.value === 'number', `Gross cell should be numeric, got ${typeof grossCell.value}`);
assert(grossCell.value === largeGross, `Gross amount mismatch: ${grossCell.value} !== ${largeGross}`);
assert(grossCell.numFmt?.includes('₹'), 'Gross cell missing INR number format');
console.log(`✓ gross amount cell value: ${grossCell.value} (format: ${grossCell.numFmt})`);

assert(grandTotalCell, 'Grand total row not found');
assert(typeof grandTotalCell.value === 'number', 'Grand total cell should be numeric');
assert(grandTotalCell.value === largeGross + 4900, `Grand total mismatch: ${grandTotalCell.value}`);
assert((detailSheet.getColumn(16).width || 0) >= MIN_MONEY_COL_WIDTH, 'Grand total column too narrow');
console.log(`✓ grand total cell value: ${grandTotalCell.value}`);

let footerCell = null;
detailSheet.eachRow((row) => {
  const val = row.getCell(2).value;
  if (typeof val === 'string' && val.includes('Ashoka House')) footerCell = row.getCell(2);
});
assert(footerCell, 'Footer row not found');
assert(!String(footerCell.value).includes('\n'), 'Footer address should be one line');
console.log(`✓ footer one line: ${footerCell.value}`);

console.log('\nAll Excel export smoke tests passed.');
