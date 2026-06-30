import ExcelJS from 'exceljs';
import { readAssetBuffer, readWatermarkBuffer } from './assetLoader.js';
import { amountToWordsINR } from './amountToWords.js';

const DATA_FIRST_COL = 2; // B
const DATA_LAST_COL = 16; // P (15 data columns)
const DATA_COL_COUNT = DATA_LAST_COL - DATA_FIRST_COL + 1;
const INR_FMT = '"₹" #,##0';
const TEXT_FMT = '@';
const MIN_MONEY_COL_WIDTH = 20;
const MIN_MER_NO_COL_WIDTH = 36;
const SINGLE_LINE_HEADERS = new Set(['Invoice Date', 'Expense Type', 'Payment Method']);

/** Column widths for A–Q (gap + 15 data cols + gap). Money cols K–N are wider. */
const SHEET_COLUMN_WIDTHS = [
  2,  // A gap
  8,  // B S.No
  36, // C Expense No
  18, // D Invoice Date
  12, // E Month
  22, // F Company
  24, // G Co Name
  24, // H Head of Expense
  36, // I Particulars
  18, // J Expense Type
  20, // K Net Amount
  20, // L Total GST
  18, // M TDS
  22, // N Gross Amount
  24, // O Payment Method
  18, // P Approval Status / grand-total amount
  2,  // Q gap
];

const HEADER_MIN_WIDTHS = {
  'Invoice Date': 18,
  'Expense Type': 18,
  'Payment Method': 24,
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

const getMetaColumnSplit = () => {
  const widths = SHEET_COLUMN_WIDTHS.slice(DATA_FIRST_COL - 1, DATA_LAST_COL);
  const totalWidth = widths.reduce((sum, w) => sum + w, 0);
  const target = totalWidth / 2;

  let cumulative = 0;
  let leftEndCol = DATA_FIRST_COL;
  for (let i = 0; i < widths.length; i += 1) {
    cumulative += widths[i];
    leftEndCol = DATA_FIRST_COL + i;
    if (cumulative >= target) break;
  }

  const rightStartCol = Math.min(leftEndCol + 1, DATA_LAST_COL);
  return { leftEndCol, rightStartCol };
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

const resolveSingleLineColIndices = (headers) =>
  headers.map((header, index) => (SINGLE_LINE_HEADERS.has(header) ? index : -1)).filter((i) => i >= 0);

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

const addWatermark = (wb, ws, { tableStartRow = 14, tableEndRow = 30 } = {}) => {
  const watermarkPng = readWatermarkBuffer();
  if (!watermarkPng) return;

  const imageId = wb.addImage({ buffer: watermarkPng, extension: 'png' });
  const centerCol = (DATA_FIRST_COL + DATA_LAST_COL) / 2;
  const centerRow = (tableStartRow + tableEndRow) / 2;

  ws.addImage(imageId, {
    tl: { col: centerCol - 4.5, row: centerRow - 2 },
    ext: { width: 640, height: 140 },
  });
};

const renderBrandedHeader = (ws, wb, companyCtx) => {
  const { leftStart, leftEnd, centerStart, centerEnd, rightStart, rightEnd } = panelSplit();
  const companyCode = companyCtx?.companyCode || 'INBEST';
  const taxId = companyCtx?.taxId || '';

  let r = 1;
  ws.getRow(r).height = 26;
  ws.getRow(r + 1).height = 26;
  ws.getRow(r + 2).height = 26;

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

  const shreePng = readAssetBuffer('shree_red.png');
  const inbestPng = readAssetBuffer('Inbest_Logo(Blue).png');
  const sheetCenterCol = (DATA_FIRST_COL + DATA_LAST_COL) / 2;

  if (shreePng) {
    const shreeImgId = wb.addImage({ buffer: shreePng, extension: 'png' });
    ws.addImage(shreeImgId, {
      tl: { col: sheetCenterCol - 0.02, row: 1.05 },
      ext: { width: 90, height: 48 },
    });
  } else {
    const shreeCell = ws.getCell(r, Math.round(sheetCenterCol));
    shreeCell.value = '|| SHREE ||';
    shreeCell.alignment = { horizontal: 'center', vertical: 'middle' };
    shreeCell.font = { name: 'Calibri', size: 14, bold: true };
  }

  if (inbestPng) {
    const inbestImgId = wb.addImage({ buffer: inbestPng, extension: 'png' });
    ws.addImage(inbestImgId, {
      tl: { col: DATA_LAST_COL - 0.85, row: 0.95 },
      br: { col: DATA_LAST_COL + 0.01, row: 2.2 },
    });
  } else {
    const inbestCell = ws.getCell(r, rightEnd);
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

const renderMetaBlock = (ws, r, metaPairs) => {
  const { leftEndCol, rightStartCol } = getMetaColumnSplit();

  metaPairs.forEach(([left, right]) => {
    const [lLabel, lValue] = left;
    const [rLabel, rValue] = right;
    ws.mergeCells(`${colLetter(DATA_FIRST_COL)}${r}:${colLetter(leftEndCol)}${r}`);
    ws.mergeCells(`${colLetter(rightStartCol)}${r}:${colLetter(DATA_LAST_COL)}${r}`);

    ws.getCell(r, DATA_FIRST_COL).value = {
      richText: [
        { font: { name: 'Calibri', size: 13, bold: true }, text: lLabel ? `${lLabel}: ` : '' },
        { font: { name: 'Calibri', size: 13 }, text: lValue || '' },
      ],
    };
    ws.getCell(r, rightStartCol).value = {
      richText: [
        { font: { name: 'Calibri', size: 13, bold: true }, text: rLabel ? `${rLabel}: ` : '' },
        { font: { name: 'Calibri', size: 13 }, text: rValue || '' },
      ],
    };
    ws.getCell(r, DATA_FIRST_COL).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    ws.getCell(r, rightStartCol).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    ws.getRow(r).height = 22;
    r += 1;
  });

  return r;
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
  const singleLineCols = new Set(resolveSingleLineColIndices(headers));

  headers.forEach((h, i) => {
    const c = ws.getCell(r, DATA_FIRST_COL + i);
    c.value = h;
    c.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005887' } };
    c.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: !singleLineCols.has(i),
    };
    border(c);
  });
  ws.getRow(r).height = 32;
  r += 1;

  rows.forEach((rowVals) => {
    rowVals.forEach((v, i) => {
      const c = ws.getCell(r, DATA_FIRST_COL + i);
      const isMoney = moneyColIndices.includes(i);
      const isText = allTextCols.has(i);
      c.value = isMoney ? toNumericAmount(v) : isText ? toTextCell(v) : v;
      c.font = {
        name: 'Calibri',
        size: 12,
        ...(i === tdsColIndex ? { color: { argb: 'FFB91C1C' }, bold: true } : {}),
        ...(i === gstColIndex ? { color: { argb: 'FF047857' }, bold: true } : {}),
        ...(i === totalColIndex ? { bold: true } : {}),
      };
      const isCenter = i === 0;
      const singleLine = singleLineCols.has(i);
      c.alignment = {
        horizontal: isMoney ? 'right' : isCenter ? 'center' : 'left',
        vertical: 'middle',
        wrapText: isText ? !singleLine : false,
        shrinkToFit: isText && !singleLine,
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
        horizontal: isMoney ? 'right' : i === 0 ? 'center' : 'left',
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
  metaPairs,
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
  r = renderMetaBlock(ws, r, metaPairs);
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

  addWatermark(wb, ws, {
    tableStartRow: tableResult.tableStartRow,
    tableEndRow: Math.max(tableResult.tableEndRow, r - 1),
  });

  return ws;
};

export const createMerWorkbook = () => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MER System';
  wb.created = new Date();
  return wb;
};

export const buildMetaPairsFromQuery = (query, companyCtx = {}) => {
  const pairs = [
    [
      ['Financial Year', query.financialYear || 'All'],
      ['Company', query.company || companyCtx.companyName || 'All'],
    ],
    [
      ['Month', query.month || 'All'],
      ['Location', query.location || 'All'],
    ],
    [
      ['Expense Type', query.expenseType || 'All'],
      ['Phone', companyCtx.phone || ''],
    ],
  ];

  return pairs;
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
