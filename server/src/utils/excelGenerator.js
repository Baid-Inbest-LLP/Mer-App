import ExcelJS from 'exceljs';
import { readAssetBuffer } from './assetLoader.js';
import { amountToWordsINR } from './amountToWords.js';

const DATA_FIRST_COL = 2; // B
const DATA_LAST_COL = 22; // V (21 data columns)
const DATA_COL_COUNT = DATA_LAST_COL - DATA_FIRST_COL + 1;
const INR_FMT = '"₹" #,##0';
const TEXT_FMT = '@';
const MIN_MONEY_COL_WIDTH = 16;
const MIN_MER_NO_COL_WIDTH = 36;
const LEFT_ALIGN_HEADERS = new Set(['Co\nName', 'Particulars']);

/** Column widths for A–W (gap + 21 data cols + gap). */
const SHEET_COLUMN_WIDTHS = [
  2,  // A gap
  8,  // B S.No
  10, // C Exp Type
  10, // D Month
  22, // E Co Name
  10, // F Location
  12, // G Invoice Date
  22, // H Invoice No
  18, // I Head of Exp
  36, // J Particulars
  12, // K Net Amt
  10, // L CGST
  10, // M SGST
  10, // N IGST
  12, // O Total GST
  10, // P TDS
  12, // Q Gross Amt
  10, // R Paid By
  16, // S Payment From
  14, // T Payment Method
  22, // U Payment Ref No
  12, // V Payment Date
  12, // W right margin (space for Inbest logo)
];

const HEADER_MIN_WIDTHS = {
  'Exp\nType': 10,
  'Co\nName': 18,
  'Invoice\nDate': 12,
  'Invoice\nNo': 22,
  'Head of\nExp': 18,
  Particulars: 36,
  'Net\nAmt': 12,
  'Total\nGST': 12,
  'Gross\nAmt': 12,
  'Paid\nBy': 10,
  'Payment\nFrom': 16,
  'Payment\nMethod': 14,
  'Payment\nRef No': 22,
  'Payment\nDate': 12,
};

const fmtDateDMY = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};

const colLetter = (n) => {
  let s = '';
  let num = n;
  while (num > 0) {
    const rem = (num - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    num = Math.floor((num - 1) / 26);
  }
  return s;
};

const border = (cell, color = 'FF000000') => {
  const edge = { style: 'thin', color: { argb: color } };
  cell.border = { top: edge, left: edge, bottom: edge, right: edge };
};

const formatAddressOneLine = (value) =>
  String(value || '')
    .trim()
    .replace(/[\r\n]+/g, ', ')
    .replace(/\s+/g, ' ');

const panelSplit = () => {
  const third = Math.floor(DATA_COL_COUNT / 3);
  const rem = DATA_COL_COUNT % 3;
  const leftSpan = third + (rem > 0 ? 1 : 0);
  const centerSpan = third + (rem > 1 ? 1 : 0);
  const rightSpan = third;
  const leftStart = DATA_FIRST_COL;
  const leftEnd = leftStart + leftSpan - 1;
  const centerStart = leftEnd + 1;
  const centerEnd = centerStart + centerSpan - 1;
  const rightStart = centerEnd + 1;
  const rightEnd = DATA_LAST_COL;
  return { leftStart, leftEnd, centerStart, centerEnd, rightStart, rightEnd };
};

const setupColumns = (ws) => {
  SHEET_COLUMN_WIDTHS.forEach((width, index) => {
    ws.getColumn(index + 1).width = width;
  });
};

const toNumericAmount = (value) => {
  if (value == null || value === '') return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
};

const toTextCell = (value) => {
  if (value == null || value === '') return '';
  return String(value);
};

const ensureMerNoColumnWidths = (ws, textColIndices = []) => {
  textColIndices.forEach((idx) => {
    const col = ws.getColumn(DATA_FIRST_COL + idx);
    col.width = Math.max(col.width || 0, MIN_MER_NO_COL_WIDTH);
  });
};

const resolveTextColIndices = (headers, textColIndices = []) => {
  const cols = new Set(textColIndices);
  const expenseNoIdx = headers.indexOf('Expense No');
  const reportNoIdx = headers.indexOf('Report No');
  if (expenseNoIdx >= 0) cols.add(expenseNoIdx);
  if (reportNoIdx >= 0) cols.add(reportNoIdx);
  return [...cols];
};

const resolveLeftAlignColIndices = (headers) =>
  headers.map((header, index) => (LEFT_ALIGN_HEADERS.has(header) ? index : -1)).filter((i) => i >= 0);

const resolveCellHorizontal = (index, moneyColIndices, leftAlignCols) => {
  if (moneyColIndices.includes(index)) return 'right';
  if (leftAlignCols.has(index)) return 'left';
  return 'center';
};

const ensureHeaderColumnWidths = (ws, headers) => {
  headers.forEach((header, index) => {
    const minWidth = HEADER_MIN_WIDTHS[header];
    if (!minWidth) return;
    const col = ws.getColumn(DATA_FIRST_COL + index);
    col.width = Math.max(col.width || 0, minWidth);
  });
};

const ensureMoneyColumnWidths = (ws, moneyColIndices = []) => {
  moneyColIndices.forEach((idx) => {
    const col = ws.getColumn(DATA_FIRST_COL + idx);
    col.width = Math.max(col.width || 0, MIN_MONEY_COL_WIDTH);
  });
  const grandTotalCol = ws.getColumn(DATA_LAST_COL);
  grandTotalCol.width = Math.max(grandTotalCol.width || 0, MIN_MONEY_COL_WIDTH);
};

const renderBrandedHeader = (ws, wb, companyCtx) => {
  const { leftStart, leftEnd, centerStart, centerEnd, rightStart, rightEnd } = panelSplit();
  const companyCode = companyCtx?.companyCode || 'INBEST';
  const taxId = companyCtx?.taxId || '';

  let r = 1;
  // Header band ~90pt — logos sized to fit without crowding company text.
  const HEADER_ROW_HEIGHT = 32;
  // Shree_black.png is 1:1 — keep square.
  const SHREE_PX = 48;
  // Inbest logo — wider box, same height, extreme-right position.
  const INBEST_H_PX = 88;
  const INBEST_W_PX = 110;

  ws.getRow(r).height = HEADER_ROW_HEIGHT;
  ws.getRow(r + 1).height = HEADER_ROW_HEIGHT;
  ws.getRow(r + 2).height = HEADER_ROW_HEIGHT;

  ws.mergeCells(`${colLetter(leftStart)}${r}:${colLetter(leftEnd)}${r + 2}`);
  ws.mergeCells(`${colLetter(centerStart)}${r}:${colLetter(centerEnd)}${r + 2}`);
  ws.mergeCells(`${colLetter(rightStart)}${r}:${colLetter(rightEnd)}${r + 2}`);

  const companyCell = ws.getCell(r, leftStart);
  if (taxId) {
    companyCell.value = {
      richText: [
        { text: `${companyCode}\n`, font: { name: 'Calibri', bold: true, size: 20, color: { argb: 'FF13AFCD' } } },
        { text: `GST No: ${taxId}`, font: { name: 'Calibri', bold: true, size: 14, color: { argb: 'FF000000' } } },
      ],
    };
  } else {
    companyCell.value = companyCode;
    companyCell.font = { name: 'Calibri', bold: true, size: 20, color: { argb: 'FF13AFCD' } };
  }
  companyCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

  ws.getCell(r, centerStart).alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getCell(r, rightStart).alignment = { vertical: 'middle', horizontal: 'center' };

  const shreePng = readAssetBuffer('Shree_black.png');
  const inbestPng = readAssetBuffer('Inbest_Logo(Blue).png');
  const sheetCenterCol = (DATA_FIRST_COL + DATA_LAST_COL) / 2;

  if (shreePng) {
    const shreeImgId = wb.addImage({ buffer: shreePng, extension: 'png' });
    ws.addImage(shreeImgId, {
      tl: { col: sheetCenterCol - 0.4, row: 0.6 },
      ext: { width: SHREE_PX, height: SHREE_PX },
    });
  } else {
    const shreeCell = ws.getCell(r, Math.round(sheetCenterCol));
    shreeCell.value = '|| SHREE ||';
    shreeCell.alignment = { horizontal: 'center', vertical: 'middle' };
    shreeCell.font = { name: 'Calibri', size: 14, bold: true };
  }

  if (inbestPng) {
    const inbestImgId = wb.addImage({ buffer: inbestPng, extension: 'png' });
    // Extreme right: sit in the trailing margin column, flush to the sheet edge.
    const lastColIdx = SHEET_COLUMN_WIDTHS.length - 1; // 0-based (ExcelJS)
    ws.addImage(inbestImgId, {
      tl: { col: lastColIdx - 0.08, row: 0.28 },
      ext: { width: INBEST_W_PX, height: INBEST_H_PX },
    });
  } else {
    const inbestCell = ws.getCell(r, SHEET_COLUMN_WIDTHS.length);
    inbestCell.value = 'INBEST';
    inbestCell.alignment = { horizontal: 'right', vertical: 'middle' };
    inbestCell.font = { name: 'Calibri', bold: true, size: 22, color: { argb: 'FF0B2F81' } };
  }

  ws.getRow(r + 3).height = 6;
  return r + 4;
};

const renderTitleBlock = (ws, r, { title, reportNo }) => {
  ws.mergeCells(`${colLetter(DATA_FIRST_COL)}${r}:${colLetter(DATA_LAST_COL)}${r}`);
  ws.getCell(r, DATA_FIRST_COL).value = title;
  ws.getCell(r, DATA_FIRST_COL).font = { name: 'Calibri', size: 20, bold: true };
  ws.getCell(r, DATA_FIRST_COL).alignment = { horizontal: 'center' };
  r += 1;

  if (reportNo) {
    ws.mergeCells(`${colLetter(DATA_FIRST_COL)}${r}:${colLetter(DATA_LAST_COL)}${r}`);
    ws.getCell(r, DATA_FIRST_COL).value = reportNo;
    ws.getCell(r, DATA_FIRST_COL).font = { name: 'Calibri', size: 16, bold: true };
    ws.getCell(r, DATA_FIRST_COL).alignment = { horizontal: 'center' };
    r += 1;
  }

  return r + 1;
};

const renderTable = (ws, r, {
  headers,
  rows,
  totalsRow,
  moneyColIndices = [],
  textColIndices = [],
  gstColIndex = -1,
  tdsColIndex = -1,
  totalColIndex = -1,
}) => {
  const tableStartRow = r;
  const colSpan = headers.length;
  const tableEndCol = DATA_FIRST_COL + colSpan - 1;
  const allTextCols = new Set(resolveTextColIndices(headers, textColIndices));
  const leftAlignCols = new Set(resolveLeftAlignColIndices(headers));

  headers.forEach((h, i) => {
    const c = ws.getCell(r, DATA_FIRST_COL + i);
    c.value = h;
    c.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005887' } };
    c.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    border(c);
  });
  ws.getRow(r).height = 36;
  r += 1;

  rows.forEach((rowVals) => {
    rowVals.forEach((v, i) => {
      const c = ws.getCell(r, DATA_FIRST_COL + i);
      const isMoney = moneyColIndices.includes(i);
      const isText = allTextCols.has(i);
      const isLeft = leftAlignCols.has(i);
      c.value = isMoney ? toNumericAmount(v) : isText ? toTextCell(v) : v;
      c.font = {
        name: 'Calibri',
        size: 12,
        ...(i === tdsColIndex ? { color: { argb: 'FFB91C1C' }, bold: true } : {}),
        ...(i === gstColIndex ? { color: { argb: 'FF047857' }, bold: true } : {}),
        ...(i === totalColIndex ? { bold: true } : {}),
      };
      c.alignment = {
        horizontal: resolveCellHorizontal(i, moneyColIndices, leftAlignCols),
        vertical: 'middle',
        wrapText: isLeft,
      };
      if (isMoney) c.numFmt = INR_FMT;
      if (isText) c.numFmt = TEXT_FMT;
      border(c);
    });
    ws.getRow(r).height = 22;
    r += 1;
  });

  if (totalsRow) {
    totalsRow.forEach((v, i) => {
      const c = ws.getCell(r, DATA_FIRST_COL + i);
      const isMoney = moneyColIndices.includes(i);
      const isText = allTextCols.has(i);
      c.value = isMoney ? toNumericAmount(v) : isText ? toTextCell(v) : v;
      c.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1F2937' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF3FA' } };
      if (i === tdsColIndex) {
        c.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF7F1D1D' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      }
      if (i === gstColIndex) {
        c.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF166534' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      }
      c.alignment = {
        horizontal: resolveCellHorizontal(i, moneyColIndices, leftAlignCols),
        vertical: 'middle',
      };
      if (isMoney) c.numFmt = INR_FMT;
      if (isText) c.numFmt = TEXT_FMT;
      border(c);
    });
    ws.getRow(r).height = 28;
    r += 1;
  }

  // Clear unused columns in table area for visual consistency
  for (let rowIdx = r - rows.length - (totalsRow ? 2 : 1); rowIdx < r; rowIdx += 1) {
    for (let col = tableEndCol + 1; col <= DATA_LAST_COL; col += 1) {
      const c = ws.getCell(rowIdx, col);
      if (!c.border) border(c);
    }
  }

  ensureMoneyColumnWidths(ws, moneyColIndices);
  ensureMerNoColumnWidths(ws, [...allTextCols]);
  ensureHeaderColumnWidths(ws, headers);

  return { nextRow: r, tableStartRow, tableEndRow: r - 1 };
};

const renderGrandTotal = (ws, r, grandTotal) => {
  const labelEndCol = DATA_LAST_COL - 1;
  ws.mergeCells(`${colLetter(DATA_FIRST_COL)}${r}:${colLetter(labelEndCol)}${r}`);
  const labelCell = ws.getCell(r, DATA_FIRST_COL);
  labelCell.value = 'TOTAL AMOUNT';
  labelCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
  labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005887' } };
  border(labelCell);

  const amountCol = ws.getColumn(DATA_LAST_COL);
  amountCol.width = Math.max(amountCol.width || 0, MIN_MONEY_COL_WIDTH);

  const amountCell = ws.getCell(r, DATA_LAST_COL);
  amountCell.value = Math.round(Number(grandTotal) || 0);
  amountCell.numFmt = INR_FMT;
  amountCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  amountCell.alignment = { horizontal: 'right', vertical: 'middle' };
  amountCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005887' } };
  border(amountCell);
  ws.getRow(r).height = 26;
  return r + 2;
};

const renderAmountInWords = (ws, r, amount) => {
  ws.mergeCells(`${colLetter(DATA_FIRST_COL)}${r}:${colLetter(DATA_LAST_COL)}${r}`);
  const cell = ws.getCell(r, DATA_FIRST_COL);
  cell.value = `Amount (in words): ${amountToWordsINR(amount)}`;
  cell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF0B2F81' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  ws.getRow(r).height = 24;
  return r + 3;
};

const renderFooter = (ws, r, address) => {
  ws.mergeCells(`${colLetter(DATA_FIRST_COL)}${r}:${colLetter(DATA_LAST_COL)}${r}`);
  const cell = ws.getCell(r, DATA_FIRST_COL);
  cell.value = formatAddressOneLine(address);
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF13AFCD' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false, shrinkToFit: true };
  ws.getRow(r).height = 22;
  return r + 1;
};

const createStyledSheet = (wb, sheetName) => {
  const ws = wb.addWorksheet(sheetName.slice(0, 31), {
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.21, right: 0.21, top: 0.21, bottom: 0.21, header: 0.21, footer: 0.21 },
    },
    views: [{ showGridLines: false }],
  });
  setupColumns(ws);
  return ws;
};

/**
 * Build a fully styled MER worksheet (PO-style layout, no signature section).
 */
export const buildMerStyledSheet = (wb, {
  sheetName,
  title,
  reportNo,
  headers,
  rows,
  totalsRow,
  grandTotal,
  footerAddress,
  companyCtx,
  moneyColIndices = [],
  textColIndices = [],
  gstColIndex = -1,
  tdsColIndex = -1,
  totalColIndex = -1,
  includeGrandTotal = true,
  includeAmountInWords = true,
}) => {
  const ws = createStyledSheet(wb, sheetName);
  let r = renderBrandedHeader(ws, wb, companyCtx);
  r = renderTitleBlock(ws, r, { title, reportNo });
  ws.pageSetup.printTitlesRow = `1:${r - 1}`;
  r += 1;

  const tableResult = renderTable(ws, r, {
    headers,
    rows,
    totalsRow,
    moneyColIndices,
    textColIndices,
    gstColIndex,
    tdsColIndex,
    totalColIndex,
  });
  r = tableResult.nextRow;

  if (includeGrandTotal) {
    r = renderGrandTotal(ws, r, grandTotal);
    if (includeAmountInWords) {
      r = renderAmountInWords(ws, r, grandTotal);
    }
  }

  renderFooter(ws, r, footerAddress);

  return ws;
};

export const createMerWorkbook = () => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MER System';
  wb.created = new Date();
  return wb;
};

export const buildDetailTitle = (query) => {
  const year = query.financialYear
    ? String(query.financialYear).split('-')[0]
    : new Date().getFullYear();
  const month = query.month || '';
  if (month) {
    return `Monthly Expense Report | ${month}'${year}`;
  }
  if (query.financialYear) {
    return `Monthly Expense Report | FY ${query.financialYear}`;
  }
  return `Monthly Expense Report | ${new Date().toLocaleString('en-US', { month: 'long' })}'${year}`;
};

export { fmtDateDMY };
