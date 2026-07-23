import ExcelJS from 'exceljs';
import { readAssetBuffer } from './assetLoader.js';
import { amountToWordsINR } from './amountToWords.js';
import { abbreviateMonthName, monthToDateInFy } from './merSerial.js';
import { getFinancialYear } from '../config/index.js';

const DATA_FIRST_COL = 2; // B
const DATA_LAST_COL = 22; // V (21 data columns)
const DATA_COL_COUNT = DATA_LAST_COL - DATA_FIRST_COL + 1;
const INR_FMT = '"₹" #,##0';
const TEXT_FMT = '@';
const MIN_MONEY_COL_WIDTH = 16;
const MIN_MER_NO_COL_WIDTH = 36;
const LEFT_ALIGN_HEADERS = new Set(['Co\nName', 'Particulars']);

/** Soft column fills for detail report body cells (ARGB). */
const COL_FILL_CO_PARTICULARS = 'FFBFDBFE'; // light blue — Co Name, Particulars
const COL_FILL_EXP_TYPE = 'FFFEF9C3'; // light yellow — Exp Type
const COL_FILL_TOTAL_GST = 'FFE2EFDA'; // soft sage green — Total GST
const COL_FILL_TDS = 'FFF4CCCC'; // soft coral red — TDS
const COL_FILL_PAYMENT = 'FFD0E2F3'; // steel light blue — Gross Amt + payment cols

const COLUMN_CELL_FILLS = new Map([
  ['Co\nName', COL_FILL_CO_PARTICULARS],
  ['Particulars', COL_FILL_CO_PARTICULARS],
  ['Exp\nType', COL_FILL_EXP_TYPE],
  ['Total\nGST', COL_FILL_TOTAL_GST],
  ['TDS', COL_FILL_TDS],
  ['Gross\nAmt', COL_FILL_PAYMENT],
  ['Paid\nBy', COL_FILL_PAYMENT],
  ['Payment\nFrom', COL_FILL_PAYMENT],
  ['Payment\nMethod', COL_FILL_PAYMENT],
  ['Payment\nRef No', COL_FILL_PAYMENT],
  ['Payment\nDate', COL_FILL_PAYMENT],
]);

const solidFill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

/** Column widths for A–W (gap + 21 data cols + gap). */
const SHEET_COLUMN_WIDTHS = [
  2,  // A gap
  6,  // B Sl No (narrow — header wraps)
  9,  // C Exp Type
  9,  // D Month
  22, // E Co Name
  8,  // F Loc
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
  'Sl\nNo': 6,
  'Exp\nType': 9,
  Month: 9,
  Loc: 8,
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
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getFullYear()).slice(-2)}`;
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
  const otherDetails = Array.isArray(companyCtx?.otherDetails) ? companyCtx.otherDetails : [];

  const detailLines = [];
  for (const detail of otherDetails) {
    const label = String(detail?.label || '').trim();
    const value = String(detail?.value || '').trim();
    if (label && value) detailLines.push(`${label}: ${value}`);
  }
  if (taxId) detailLines.push(`GST No: ${taxId}`);

  let r = 1;
  // Header band — logos sized to fit without crowding company text.
  // Grow with detail lines so GST / IRDA / ARN stay readable under the code.
  const detailCount = detailLines.length;
  const headerRows = Math.max(3, 2 + detailCount);
  const HEADER_ROW_HEIGHT = detailCount > 1 ? 26 : 32;
  // Shree_black.png is 1:1 — keep square.
  const SHREE_PX = 48;
  // Inbest logo — wider box, same height, extreme-right position.
  const INBEST_H_PX = 88;
  const INBEST_W_PX = 110;

  for (let i = 0; i < headerRows; i += 1) {
    ws.getRow(r + i).height = HEADER_ROW_HEIGHT;
  }

  ws.mergeCells(`${colLetter(leftStart)}${r}:${colLetter(leftEnd)}${r + headerRows - 1}`);
  ws.mergeCells(`${colLetter(centerStart)}${r}:${colLetter(centerEnd)}${r + headerRows - 1}`);
  ws.mergeCells(`${colLetter(rightStart)}${r}:${colLetter(rightEnd)}${r + headerRows - 1}`);

  const companyCodeFont = { name: 'Calibri', bold: true, size: 20, color: { argb: 'FF13AFCD' } };
  // Same family/weight as company code; slightly smaller so header stays balanced.
  const detailFont = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FF000000' } };

  const companyCell = ws.getCell(r, leftStart);
  if (detailLines.length) {
    companyCell.value = {
      richText: [
        { text: `${companyCode}\n`, font: companyCodeFont },
        ...detailLines.map((line, index) => ({
          text: index < detailLines.length - 1 ? `${line}\n` : line,
          font: detailFont,
        })),
      ],
    };
  } else {
    companyCell.value = companyCode;
    companyCell.font = companyCodeFont;
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

  ws.getRow(r + headerRows).height = 6;
  return r + headerRows + 1;
};

const renderTitleBlock = (ws, r, { title }) => {
  ws.mergeCells(`${colLetter(DATA_FIRST_COL)}${r}:${colLetter(DATA_LAST_COL)}${r}`);
  const titleCell = ws.getCell(r, DATA_FIRST_COL);
  if (title && typeof title === 'object' && Array.isArray(title.richText)) {
    titleCell.value = title;
  } else {
    titleCell.value = title || '';
    titleCell.font = { name: 'Calibri', size: 20, bold: true };
  }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  ws.getRow(r).height = 32;
  return r + 1;
};

const renderTable = (ws, r, {
  headers,
  rows,
  totalsRow,
  totalsLabel = '',
  moneyColIndices = [],
  textColIndices = [],
  gstColIndex = -1,
  tdsColIndex = -1,
  totalColIndex = -1,
}) => {
  void gstColIndex;
  void tdsColIndex;
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
      const colFill = COLUMN_CELL_FILLS.get(headers[i]);
      c.value = isMoney ? toNumericAmount(v) : isText ? toTextCell(v) : v;
      c.font = {
        name: 'Calibri',
        size: isMoney ? 13 : 12,
        bold: isMoney || i === totalColIndex,
      };
      if (colFill) c.fill = solidFill(colFill);
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
    const TOTAL_BG = 'FF005887';
    const TOTAL_FONT = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    // Detail report style: merge Exp Type → Particulars for the label; money from Net Amt onward.
    const useDetailTotalsStyle = Boolean(totalsLabel);
    const mergeEndIdx = useDetailTotalsStyle ? 8 : -1;

    totalsRow.forEach((v, i) => {
      const c = ws.getCell(r, DATA_FIRST_COL + i);
      const isMoney = moneyColIndices.includes(i)
        && !(useDetailTotalsStyle && mergeEndIdx >= 0 && i <= mergeEndIdx);
      const isText = allTextCols.has(i);
      c.value = isMoney
        ? toNumericAmount(v)
        : (useDetailTotalsStyle && i > 0 && i <= mergeEndIdx
          ? ''
          : (isText ? toTextCell(v) : v));
      c.font = TOTAL_FONT;
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
      c.alignment = {
        horizontal: isMoney ? 'right' : (i === 0 ? 'center' : 'left'),
        vertical: 'middle',
      };
      if (isMoney) c.numFmt = INR_FMT;
      if (isText && !useDetailTotalsStyle) c.numFmt = TEXT_FMT;
      border(c);
    });

    // Fill any trailing table columns with the same total styling
    for (let i = totalsRow.length; i < colSpan; i += 1) {
      const c = ws.getCell(r, DATA_FIRST_COL + i);
      c.value = '';
      c.font = TOTAL_FONT;
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
      border(c);
    }

    if (useDetailTotalsStyle && mergeEndIdx >= 1) {
      const mergeStart = DATA_FIRST_COL + 1;
      const mergeEnd = DATA_FIRST_COL + mergeEndIdx;
      ws.mergeCells(`${colLetter(mergeStart)}${r}:${colLetter(mergeEnd)}${r}`);
      const labelCell = ws.getCell(r, mergeStart);
      labelCell.value = buildTotalsLabelRichText(totalsLabel, TOTAL_FONT);
      labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
      labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
      border(labelCell);
    }

    // Count in S.No
    const countCell = ws.getCell(r, DATA_FIRST_COL);
    if (useDetailTotalsStyle && (totalsRow[0] !== undefined && totalsRow[0] !== '')) {
      countCell.value = Number(totalsRow[0]) || totalsRow[0];
      countCell.font = TOTAL_FONT;
      countCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } };
      countCell.alignment = { horizontal: 'center', vertical: 'middle' };
      border(countCell);
    }

    ws.getRow(r).height = 30;
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

/** "Total Bank Expense - BSIBPL - APR'24" with period highlighted yellow. */
const buildTotalsLabelRichText = (label, baseFont) => {
  const text = String(label || '');
  const sep = ' - ';
  const lastSep = text.lastIndexOf(sep);
  if (lastSep === -1) {
    return { richText: [{ text, font: { ...baseFont } }] };
  }

  const prefix = text.slice(0, lastSep + sep.length);
  const period = text.slice(lastSep + sep.length);
  return {
    richText: [
      { text: prefix, font: { ...baseFont, bold: true, color: { argb: 'FFFFFFFF' } } },
      { text: period, font: { ...baseFont, bold: true, color: { argb: 'FFFFFF00' } } },
    ],
  };
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

const renderReportFooter = (ws, r, reportNo) => {
  // One blank row gap after the table
  r += 1;

  const mid = Math.floor((DATA_FIRST_COL + DATA_LAST_COL) / 2);
  const leftEnd = mid;
  const rightStart = mid + 1;

  ws.mergeCells(`${colLetter(DATA_FIRST_COL)}${r}:${colLetter(leftEnd)}${r}`);
  const leftCell = ws.getCell(r, DATA_FIRST_COL);
  leftCell.value = reportNo || '';
  leftCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF000000' } };
  leftCell.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.mergeCells(`${colLetter(rightStart)}${r}:${colLetter(DATA_LAST_COL)}${r}`);
  const rightCell = ws.getCell(r, rightStart);
  rightCell.value = {
    richText: [
      { text: 'Internal Documents', font: { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF000000' } } },
      { text: ' : ', font: { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF000000' } } },
      { text: 'Accounts Department', font: { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFEF4444' } } },
    ],
  };
  rightCell.alignment = { horizontal: 'right', vertical: 'middle' };

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
  totalsLabel = '',
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
  r = renderTitleBlock(ws, r, { title });
  ws.pageSetup.printTitlesRow = `1:${r - 1}`;

  const tableResult = renderTable(ws, r, {
    headers,
    rows,
    totalsRow,
    totalsLabel,
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

  if (reportNo) {
    r = renderReportFooter(ws, r, reportNo);
  }

  return ws;
};

export const createMerWorkbook = () => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MER System';
  wb.created = new Date();
  return wb;
};

const TITLE_RED = { argb: 'FFEF4444' };
const TITLE_BLACK = { argb: 'FF000000' };
const TITLE_FONT_SIZE = 24;
const titlePartFont = (color) => ({
  name: 'Calibri',
  size: TITLE_FONT_SIZE,
  bold: true,
  color,
});

const formatTitleMerType = (merType) => {
  const normalized = String(merType || 'combined').trim().toLowerCase();
  if (normalized === 'cash') return 'CASH';
  if (normalized === 'bank' || normalized === 'bnk') return 'BANK';
  if (normalized === 'combined' || normalized === 'comb') return 'COMBINED';
  return normalized ? normalized.toUpperCase() : 'COMBINED';
};

/** e.g. April + 2024-25 → APR'24 */
const formatShortMonthPeriod = (month, financialYear) => {
  const abbr = abbreviateMonthName(month);
  if (!abbr) return '';
  const fy = financialYear || getFinancialYear();
  const date = monthToDateInFy(month, fy);
  return `${abbr.toUpperCase()}'${String(date.getFullYear()).slice(-2)}`;
};

/** e.g. April + 2024-25 → APR'2024 */
const formatFullMonthPeriod = (month, financialYear) => {
  const abbr = abbreviateMonthName(month);
  if (!abbr) return '';
  const fy = financialYear || getFinancialYear();
  const date = monthToDateInFy(month, fy);
  return `${abbr.toUpperCase()}'${date.getFullYear()}`;
};

/**
 * Total Bank Expense - BSIBPL - APR'24
 */
export const buildTotalsLabel = (query = {}, companyCtx = {}) => {
  const companyCode = String(companyCtx.companyCode || '').trim().toUpperCase() || 'COMPANY';
  const merLabel = formatTitleMerType(query.merType);
  const merTitleCase = merLabel.charAt(0) + merLabel.slice(1).toLowerCase();
  const fy = query.financialYear || getFinancialYear();
  const period = query.month
    ? formatShortMonthPeriod(query.month, fy)
    : (fy ? `FY ${fy}` : '');

  return `Total ${merTitleCase} Expense - ${companyCode}${period ? ` - ${period}` : ''}`;
};

/**
 * BSIBPL - MONTHLY EXPENSE REPORT COMBINED (black) - APR'2024 / FY 2024-25 (bright red)
 * Plain string titles (summary sheets) remain supported by callers.
 */
export const buildDetailTitle = (query = {}, companyCtx = {}) => {
  const companyCode = String(companyCtx.companyCode || '').trim().toUpperCase();
  const merLabel = formatTitleMerType(query.merType);
  const fy = query.financialYear || getFinancialYear();

  let period = '';
  if (query.month) {
    period = formatFullMonthPeriod(query.month, fy);
  } else if (fy) {
    period = `FY ${fy}`;
  }

  const middle = merLabel
    ? `MONTHLY EXPENSE REPORT ${merLabel}`
    : 'MONTHLY EXPENSE REPORT';

  if (!companyCode && !period) {
    return middle;
  }

  const richText = [];
  if (companyCode) {
    richText.push({ text: companyCode, font: titlePartFont(TITLE_BLACK) });
    richText.push({ text: ` - ${middle}`, font: titlePartFont(TITLE_BLACK) });
  } else {
    richText.push({ text: middle, font: titlePartFont(TITLE_BLACK) });
  }

  if (period) {
    richText.push({ text: ' - ', font: titlePartFont(TITLE_BLACK) });
    richText.push({ text: period, font: titlePartFont(TITLE_RED) });
  }

  return { richText };
};

export { fmtDateDMY };
