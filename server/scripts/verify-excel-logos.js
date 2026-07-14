/**
 * Generate a sample MER Excel and verify Shree / Inbest logo sizing.
 * Also writes a visual HTML preview of the header logos at Excel pixel sizes.
 *
 * Run: node scripts/verify-excel-logos.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import {
  buildMerStyledSheet,
  createMerWorkbook,
  buildDetailTitle,
} from '../src/utils/excelGenerator.js';
import { readAssetBuffer } from '../src/utils/assetLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../tmp');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const SHREE_PX = 48;
const INBEST_H_PX = 62;
const INBEST_W_PX = Math.round(INBEST_H_PX * (930 / 740));

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const shreeBuf = readAssetBuffer('Shree_black.png');
const inbestBuf = readAssetBuffer('Inbest_Logo(Blue).png');
assert(shreeBuf, 'Shree_black.png missing');
assert(inbestBuf, 'Inbest_Logo(Blue).png missing');

const shreeMeta = PNG.sync.read(shreeBuf);
const inbestMeta = PNG.sync.read(inbestBuf);
console.log('Asset native sizes:');
console.log(`  Shree:  ${shreeMeta.width}×${shreeMeta.height} (aspect ${(shreeMeta.width / shreeMeta.height).toFixed(3)})`);
console.log(`  Inbest: ${inbestMeta.width}×${inbestMeta.height} (aspect ${(inbestMeta.width / inbestMeta.height).toFixed(3)})`);

assert(shreeMeta.width === shreeMeta.height, 'Shree asset must be square');
assert(
  Math.abs(inbestMeta.width / inbestMeta.height - 930 / 740) < 0.02,
  'Inbest aspect unexpected',
);

const companyCtx = {
  companyCode: 'BILLP',
  companyName: 'Baid Inbest Llp',
  taxId: '19AALFB4917G1ZB',
  phone: '8981541333',
  address: '6th Floor, Suite No 608 And 609, Ashoka House, 3a, Hare St, B.b.d. Bagh, Kolkata, West Bengal, 700001, India',
};

const wb = createMerWorkbook();
buildMerStyledSheet(wb, {
  sheetName: 'Logo Check',
  title: buildDetailTitle(
    { financialYear: '2025-26', month: 'June', merType: 'combined' },
    companyCtx,
  ),
  reportNo: 'MER/BILLP/HQ/25-26/Jun',
  headers: [
    'S.No',
    'Exp\nType',
    'Month',
    'Co\nName',
    'Location',
    'Invoice\nDate',
    'Invoice\nNo',
    'Head of\nExp',
    'Particulars',
    'Net\nAmt',
    'CGST',
    'SGST',
    'IGST',
    'Total\nGST',
    'TDS',
    'Gross\nAmt',
    'Paid\nBy',
    'Payment\nMethod',
    'Payment\nDate',
  ],
  rows: [
    [1, 'RE', 'June', 'Office Mart', 'HQ', '15-06-2025', 'INV-001', 'Stationary', 'Paper & toner', 5000, 450, 450, 0, 900, 0, 5900, 'BILLP', 'NEFT', '16-06-2025'],
  ],
  totalsRow: ['', 'Totals', '', '', '', '', '', '', '1 entries', 5000, 450, 450, 0, 900, 0, 5900, '', '', ''],
  grandTotal: 5900,
  footerAddress: companyCtx.address,
  companyCtx,
  moneyColIndices: [9, 10, 11, 12, 13, 14, 15],
  gstColIndex: 13,
  tdsColIndex: 14,
  totalColIndex: 15,
});

const sheet = wb.getWorksheet('Logo Check');
assert(sheet, 'Sheet missing');

const images = sheet.getImages();
assert(images.length >= 2, `Expected ≥2 images, got ${images.length}`);

const sized = images.map((img) => {
  const range = img.range || {};
  const ext = range.ext || {};
  const tl = range.tl || {};
  const media = wb.getImage(img.imageId);
  return {
    imageId: img.imageId,
    width: ext.width,
    height: ext.height,
    tlCol: tl.nativeCol != null ? tl.nativeCol + (tl.nativeColOff || 0) / 10000 : tl.col,
    tlRow: tl.nativeRow != null ? tl.nativeRow + (tl.nativeRowOff || 0) / 10000 : tl.row,
    mediaBytes: media?.buffer?.length || 0,
    hasBr: Boolean(range.br),
  };
});

console.log('\nEmbedded image placements:');
sized.forEach((s, i) => console.log(`  #${i}`, s));

const shreePlacement = sized.find((s) => s.width === SHREE_PX && s.height === SHREE_PX);
const inbestPlacement = sized.find((s) => s.width === INBEST_W_PX && s.height === INBEST_H_PX);

assert(shreePlacement, `Shree placement ${SHREE_PX}×${SHREE_PX} not found`);
assert(inbestPlacement, `Inbest placement ${INBEST_W_PX}×${INBEST_H_PX} not found`);
assert(!shreePlacement.hasBr, 'Shree must use ext sizing (no br stretch)');
assert(!inbestPlacement.hasBr, 'Inbest must use ext sizing (no br stretch)');
assert(
  Math.abs(shreePlacement.width / shreePlacement.height - 1) < 0.01,
  'Shree must remain square in Excel',
);
assert(
  Math.abs(inbestPlacement.width / inbestPlacement.height - 930 / 740) < 0.02,
  'Inbest aspect must match asset',
);

const headerBandPt = 30 * 3;
const shreeFits = SHREE_PX <= headerBandPt * 1.4;
const inbestFits = INBEST_H_PX <= headerBandPt * 1.4;
assert(shreeFits, 'Shree taller than header band');
assert(inbestFits, 'Inbest taller than header band');

const xlsxPath = path.join(outDir, 'mer-logo-check.xlsx');
await wb.xlsx.writeFile(xlsxPath);
assert(fs.statSync(xlsxPath).size > 8000, 'xlsx too small — images likely missing');
console.log(`\n✓ wrote ${xlsxPath} (${fs.statSync(xlsxPath).size} bytes)`);

// Visual HTML preview at the exact Excel pixel sizes
const shreeB64 = shreeBuf.toString('base64');
const inbestB64 = inbestBuf.toString('base64');
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>MER Excel logo size preview</title>
  <style>
    body { font-family: Calibri, Segoe UI, sans-serif; background: #f3f4f6; margin: 24px; color: #111; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { margin: 0 0 16px; color: #4b5563; font-size: 14px; }
    .sheet {
      background: #fff; border: 1px solid #d1d5db; padding: 12px 16px;
      max-width: 1100px; box-shadow: 0 1px 3px rgba(0,0,0,.08);
    }
    .header {
      display: grid; grid-template-columns: 1fr 1fr 1fr; align-items: center;
      min-height: 90px; border-bottom: 2px solid #e5e7eb; margin-bottom: 12px; gap: 12px;
    }
    .company { color: #13AFCD; font-weight: 700; font-size: 20px; line-height: 1.2; }
    .gst { color: #000; font-size: 14px; font-weight: 700; margin-top: 4px; }
    .center, .right { display: flex; justify-content: center; align-items: center; }
    .right { justify-content: flex-end; }
    .meta { margin-top: 16px; font-size: 13px; color: #374151; }
    code { background: #eef2ff; padding: 1px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>MER Excel header logo preview</h1>
  <p>Rendered at the same pixel sizes used in ExcelJS <code>ext</code> (Shree ${SHREE_PX}×${SHREE_PX}, Inbest ${INBEST_W_PX}×${INBEST_H_PX}).</p>
  <div class="sheet">
    <div class="header">
      <div>
        <div class="company">BILLP</div>
        <div class="gst">GST No: 19AALFB4917G1ZB</div>
      </div>
      <div class="center">
        <img src="data:image/png;base64,${shreeB64}" width="${SHREE_PX}" height="${SHREE_PX}" alt="Shree" />
      </div>
      <div class="right">
        <img src="data:image/png;base64,${inbestB64}" width="${INBEST_W_PX}" height="${INBEST_H_PX}" alt="Inbest" />
      </div>
    </div>
    <div class="meta">
      Header band: 3 × 30pt ≈ 90pt. Both logos fit with correct aspect ratios (no stretch).<br/>
      Open <code>tmp/mer-logo-check.xlsx</code> in Excel for the live sheet.
    </div>
  </div>
</body>
</html>`;

const htmlPath = path.join(outDir, 'mer-logo-preview.html');
fs.writeFileSync(htmlPath, html);
console.log(`✓ wrote visual preview ${htmlPath}`);
console.log('\nAll logo size checks passed.');
console.log(`  Shree Excel size:  ${SHREE_PX}×${SHREE_PX} (1:1)`);
console.log(`  Inbest Excel size: ${INBEST_W_PX}×${INBEST_H_PX} (aspect ${(INBEST_W_PX / INBEST_H_PX).toFixed(3)})`);
