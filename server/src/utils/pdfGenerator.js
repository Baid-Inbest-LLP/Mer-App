import { readAssetDataUri } from './assetLoader.js';
import { amountToWordsINR } from './amountToWords.js';

/**
 * HTML/Puppeteer PDF renderer that mirrors the styled MER Excel report
 * (see excelGenerator.js). Same header, title, table, totals, and footer
 * layout — just rendered as an A4 landscape PDF instead of a worksheet.
 */

const HEADER_BLUE = '#005887';
const COMPANY_CODE_BLUE = '#13AFCD';
const TDS_RED = '#B91C1C';
const GST_GREEN = '#047857';
const TITLE_RED = '#EF4444';
const WORDS_BLUE = '#0B2F81';
const HIGHLIGHT_YELLOW = '#FFFF00';
const ACCOUNTS_RED = '#EF4444';

const LEFT_ALIGN_HEADERS = new Set(['Co\nName', 'Particulars']);
const DETAIL_MERGE_END_IDX = 8; // Exp Type → Particulars

/**
 * Preferred relative widths for the 21 detail-report columns.
 * Slightly tighter: Sl No (wraps), Exp Type, Month, Loc.
 * Narrower: Invoice No. Wider nowrap: Co Name, Payment Method.
 */
const DETAIL_COL_WIDTHS = [
  '2.2%',  // 0  Sl No (narrow — header wraps to 2 lines)
  '2.6%',  // 1  Exp Type (~2-4px tighter)
  '3%',  // 2  Month
  '7.5%',  // 3  Co Name
  '2.8%',  // 4  Loc (narrower)
  '4%',    // 5  Invoice Date
  '5%',  // 6  Invoice No
  '6.8%',  // 7  Head of Exp
  '9%',    // 8  Particulars (absorbs freed space)
  '5.6%',  // 9  Net Amt
  '4.6%',  // 10 CGST
  '4.6%',  // 11 SGST
  '4.6%',  // 12 IGST
  '5.4%',    // 13 Total GST
  '4.6%',  // 14 TDS
  '5.6%',  // 15 Gross Amt
  '3.6%',  // 16 Paid By
  '4.8%',  // 17 Payment From
  '4.2%',  // 18 Payment Method
  '5%',  // 19 Payment Ref No
  '4%',  // 20 Payment Date
];

/** Columns that must stay on one line (no word break). */
const NOWRAP_HEADERS = new Set([
  'Exp\nType',
  'Month',
  'Loc',
  'Invoice\nDate',
  'Payment\nDate',
  'Net\nAmt',
  'CGST',
  'SGST',
  'IGST',
  'Total\nGST',
  'TDS',
  'Gross\nAmt',
  'Payment\nMethod',
]);

/** Text columns that should wrap when content is long. */
const WRAP_HEADERS = new Set([
  'Co\nName',
  'Head of\nExp',
  'Particulars',
  'Payment\nRef No',
]);

/** Sl No header wraps to 2 lines; cell values stay short. */
const HEADER_WRAP_HEADERS = new Set(['Sl\nNo']);

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/** Header labels contain "\n" for line breaks (e.g. "Net\nAmt"). */
const headerHtml = (header) =>
  escapeHtml(header).replace(/\n/g, '<br/>');

const fmtMoney = (value) => {
  const n = Math.round(Number(value) || 0);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
  return `₹${formatted}`;
};

/** Renders a value that may be a plain string or an ExcelJS-style richText object. */
const renderRichText = (value, { fallbackColor = '#000' } = {}) => {
  if (value && typeof value === 'object' && Array.isArray(value.richText)) {
    return value.richText
      .map((part) => {
        const color = part?.font?.color?.argb
          ? `#${part.font.color.argb.slice(-6)}`
          : fallbackColor;
        return `<span style="color:${color}">${escapeHtml(part.text).replace(/\n/g, '<br/>')}</span>`;
      })
      .join('');
  }
  return escapeHtml(value).replace(/\n/g, '<br/>');
};

/** "Total X Expense - CODE - APR'24" → period highlighted yellow (matches Excel). */
const renderTotalsLabel = (label) => {
  const text = String(label || '');
  const sep = ' - ';
  const lastSep = text.lastIndexOf(sep);
  if (lastSep === -1) return `<span>${escapeHtml(text)}</span>`;
  const prefix = text.slice(0, lastSep + sep.length);
  const period = text.slice(lastSep + sep.length);
  return `<span>${escapeHtml(prefix)}</span><span style="color:${HIGHLIGHT_YELLOW}">${escapeHtml(period)}</span>`;
};

const resolveAlign = (index, headers, moneyCols) => {
  if (moneyCols.has(index)) return 'right';
  if (LEFT_ALIGN_HEADERS.has(headers[index])) return 'left';
  return 'center';
};

/** Header text is always centered (incl. Co Name / Particulars). */
const resolveHeaderAlign = () => 'center';

const colClass = (header) => {
  const classes = [];
  if (NOWRAP_HEADERS.has(header)) classes.push('col-nowrap');
  if (HEADER_WRAP_HEADERS.has(header)) classes.push('col-header-wrap');
  return classes.join(' ');
};

const renderColGroup = (headers) => {
  if (headers.length !== DETAIL_COL_WIDTHS.length) return '';
  const cols = DETAIL_COL_WIDTHS.map((w) => `<col style="width:${w}" />`).join('');
  return `<colgroup>${cols}</colgroup>`;
};

const renderHeaderPanel = (companyCtx, assets) => {
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

  const detailsHtml = detailLines
    .map((line) => `<div class="company-detail">${escapeHtml(line)}</div>`)
    .join('');

  return `
    <div class="brand-header">
      <div class="brand-left">
        <div class="company-code">${escapeHtml(companyCode)}</div>
        ${detailsHtml}
      </div>
      <div class="brand-center">
        ${assets.shreeSrc ? `<img src="${assets.shreeSrc}" class="shree-logo" alt="Shree" />` : ''}
      </div>
      <div class="brand-right">
        ${assets.inbestSrc ? `<img src="${assets.inbestSrc}" class="inbest-logo" alt="Inbest" />` : ''}
      </div>
    </div>`;
};

const renderTableHead = (headers, moneyCols) => {
  void moneyCols;
  const cells = headers
    .map((h) => {
      const cls = colClass(h);
      return `<th class="${cls}" style="text-align:${resolveHeaderAlign()}">${headerHtml(h)}</th>`;
    })
    .join('');
  return `<thead><tr>${cells}</tr></thead>`;
};

const renderBodyRows = (rows, headers, moneyCols, { gstColIndex, tdsColIndex, totalColIndex }) =>
  rows
    .map((rowVals) => {
      const cells = headers
        .map((header, i) => {
          const value = rowVals[i];
          const isMoney = moneyCols.has(i);
          const align = resolveAlign(i, headers, moneyCols);
          const classes = [colClass(header)];
          if (i === tdsColIndex) classes.push('cell-tds');
          if (i === gstColIndex) classes.push('cell-gst');
          if (i === totalColIndex) classes.push('cell-total');
          if (WRAP_HEADERS.has(header) || (align === 'left' && !NOWRAP_HEADERS.has(header))) {
            classes.push('cell-wrap');
          }
          const rendered = isMoney
            ? fmtMoney(value)
            : escapeHtml(value === 0 ? 0 : value || '');
          return `<td class="${classes.filter(Boolean).join(' ')}" style="text-align:${align}">${rendered}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

const renderTotalsRow = (totalsRow, headers, moneyCols, totalsLabel) => {
  if (!totalsRow) return '';
  const useDetailStyle = Boolean(totalsLabel);
  const colSpan = headers.length;
  const cells = [];

  for (let i = 0; i < colSpan; i += 1) {
    if (i === 0) {
      const count = totalsRow[0] !== undefined && totalsRow[0] !== '' ? totalsRow[0] : '';
      cells.push(`<td class="totals-cell" style="text-align:center">${escapeHtml(count)}</td>`);
      continue;
    }

    if (useDetailStyle && i >= 1 && i <= DETAIL_MERGE_END_IDX) {
      if (i === 1) {
        const span = DETAIL_MERGE_END_IDX - 1 + 1;
        cells.push(
          `<td class="totals-cell totals-label" colspan="${span}" style="text-align:center">${renderTotalsLabel(totalsLabel)}</td>`,
        );
      }
      continue;
    }

    const isMoney = moneyCols.has(i) && !(useDetailStyle && i <= DETAIL_MERGE_END_IDX);
    const value = totalsRow[i];
    const content = isMoney ? fmtMoney(value) : escapeHtml(value === 0 ? '' : value || '');
    cells.push(`<td class="totals-cell" style="text-align:${isMoney ? 'right' : 'center'}">${content}</td>`);
  }

  return `<tr class="totals-row">${cells.join('')}</tr>`;
};

const renderGrandTotal = (headers, grandTotal) => {
  const labelSpan = headers.length - 1;
  return `
    <table class="grand-total-table">
      <tr>
        <td class="grand-total-label" colspan="${labelSpan}">TOTAL AMOUNT</td>
        <td class="grand-total-amount">${fmtMoney(grandTotal)}</td>
      </tr>
    </table>`;
};

const renderAmountInWords = (grandTotal) =>
  `<div class="amount-words">Amount (in words): ${escapeHtml(amountToWordsINR(grandTotal))}</div>`;

const renderFooter = (reportNo) => `
  <div class="report-footer">
    <div class="footer-left">${escapeHtml(reportNo || '')}</div>
    <div class="footer-right">
      <span class="footer-doc">Internal Documents</span>
      <span class="footer-sep"> : </span>
      <span class="footer-dept">Accounts Department</span>
    </div>
  </div>`;

/** Build the full HTML document mirroring buildMerStyledSheet output. */
export const buildMonthlyReportHtml = ({
  title,
  reportNo,
  headers,
  rows,
  totalsRow,
  totalsLabel = '',
  grandTotal,
  companyCtx,
  moneyColIndices = [],
  gstColIndex = -1,
  tdsColIndex = -1,
  totalColIndex = -1,
  includeGrandTotal = true,
  includeAmountInWords = true,
}) => {
  const moneyCols = new Set(moneyColIndices);
  const assets = {
    shreeSrc: readAssetDataUri('Shree_black.png'),
    inbestSrc: readAssetDataUri('Inbest_Logo(Blue).png'),
  };

  const head = renderTableHead(headers, moneyCols);
  const body = renderBodyRows(rows, headers, moneyCols, { gstColIndex, tdsColIndex, totalColIndex });
  const totals = renderTotalsRow(totalsRow, headers, moneyCols, totalsLabel);
  const colGroup = renderColGroup(headers);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(reportNo || 'MER Report')}</title>
    <style>
      @page { size: A4 landscape; margin: 8mm 4mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: Calibri, 'Segoe UI', Arial, sans-serif;
        color: #000;
        font-size: 9px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .brand-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
      }
      .brand-left { flex: 1; text-align: left; }
      .brand-center { flex: 1; text-align: center; }
      .brand-right { flex: 1; text-align: right; }
      .company-code { color: ${COMPANY_CODE_BLUE}; font-weight: 700; font-size: 20px; line-height: 1.1; }
      .company-detail { font-weight: 700; font-size: 11px; color: #000; margin-top: 1px; }
      .shree-logo { height: 46px; width: auto; display: inline-block; }
      .inbest-logo { height: 64px; width: auto; display: inline-block; }

      .report-title {
        text-align: center;
        font-weight: 700;
        font-size: 18px;
        margin: 4px 0 10px 0;
        line-height: 1.2;
      }

      table.report-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      table.report-table th,
      table.report-table td {
        border: 1px solid #000;
        padding: 3px 3px;
        font-size: 9px;
        vertical-align: middle;
        overflow: hidden;
      }
      table.report-table thead th {
        background: ${HEADER_BLUE};
        color: #fff;
        font-weight: 700;
        font-size: 9.5px;
        text-align: center;
      }
      table.report-table tbody td { white-space: nowrap; }
      table.report-table tbody td.cell-wrap {
        white-space: normal;
        word-break: break-word;
        overflow-wrap: anywhere;
      }
      /* Keep short label columns readable — no mid-word breaks / no stacking. */
      table.report-table th.col-nowrap,
      table.report-table td.col-nowrap {
        white-space: nowrap;
        word-break: normal;
        overflow-wrap: normal;
      }
      /* Sl No header stacks on two lines. */
      table.report-table th.col-header-wrap {
        white-space: normal;
        line-height: 1.15;
        word-break: normal;
      }
      /* Invoice No (7th data col) may wrap to avoid crowding neighbours. */
      table.report-table td:nth-child(7) {
        white-space: normal;
        word-break: break-all;
        overflow-wrap: anywhere;
      }
      .cell-tds { color: ${TDS_RED}; font-weight: 700; }
      .cell-gst { color: ${GST_GREEN}; font-weight: 700; }
      .cell-total { font-weight: 700; }

      tr.totals-row .totals-cell {
        background: ${HEADER_BLUE};
        color: #fff;
        font-weight: 700;
        font-size: 10px;
      }
      .totals-label { font-size: 11px; }

      .grand-total-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 0;
      }
      .grand-total-table td {
        border: 1px solid #000;
        background: ${HEADER_BLUE};
        color: #fff;
        font-weight: 700;
        font-size: 14px;
        padding: 5px 6px;
      }
      .grand-total-label { text-align: center; }
      .grand-total-amount { text-align: right; white-space: nowrap; }

      .amount-words {
        background: ${HIGHLIGHT_YELLOW};
        color: ${WORDS_BLUE};
        font-weight: 700;
        font-size: 12px;
        padding: 5px 8px;
        margin-top: 6px;
      }

      .report-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 12px;
        font-size: 10px;
        font-weight: 700;
      }
      .footer-dept { color: ${ACCOUNTS_RED}; }
    </style>
  </head>
  <body>
    ${renderHeaderPanel(companyCtx, assets)}
    <div class="report-title">${renderRichText(title)}</div>
    <table class="report-table">
      ${colGroup}
      ${head}
      <tbody>
        ${body}
        ${totals}
      </tbody>
    </table>
    ${includeGrandTotal ? renderGrandTotal(headers, grandTotal) : ''}
    ${includeGrandTotal && includeAmountInWords ? renderAmountInWords(grandTotal) : ''}
    ${reportNo ? renderFooter(reportNo) : ''}
  </body>
</html>`;
};
