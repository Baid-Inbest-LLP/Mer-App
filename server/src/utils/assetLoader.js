import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cachedAssetDirs;
let cachedWatermarkBuffer;

const transparentizeDarkBackground = (buffer, threshold = 50) => {
  try {
    const png = PNG.sync.read(buffer);
    for (let i = 0; i < png.data.length; i += 4) {
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      if (r <= threshold && g <= threshold && b <= threshold) {
        png.data[i + 3] = 0;
      }
    }
    return PNG.sync.write(png);
  } catch {
    return buffer;
  }
};

const getAssetDirCandidates = () => {
  if (cachedAssetDirs) return cachedAssetDirs;

  const dirs = [];
  const add = (d) => {
    if (!d) return;
    const normalized = path.normalize(d);
    if (!dirs.includes(normalized)) dirs.push(normalized);
  };

  if (process.env.MER_ASSETS_DIR) add(process.env.MER_ASSETS_DIR);

  const cwd = process.cwd();
  add(path.join(cwd, 'assets'));
  add(path.join(cwd, 'server', 'assets'));
  add(path.join(__dirname, '../../assets'));

  cachedAssetDirs = dirs;
  return cachedAssetDirs;
};

const resolveAssetPath = (relativePath) => {
  const cleaned = String(relativePath || '').trim();
  if (!cleaned) return '';

  for (const dir of getAssetDirCandidates()) {
    const absPath = path.join(dir, cleaned);
    if (fs.existsSync(absPath)) return absPath;
  }
  return '';
};

export const readAssetBuffer = (relativePath) => {
  const absPath = resolveAssetPath(relativePath);
  if (!absPath) return null;
  try {
    return fs.readFileSync(absPath);
  } catch {
    return null;
  }
};

const mimeFromFilename = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
};

/** Base64 data URI for an asset — used to embed logos in PDF HTML. */
export const readAssetDataUri = (relativePath) => {
  const buffer = readAssetBuffer(relativePath);
  if (!buffer) return '';
  return `data:${mimeFromFilename(relativePath)};base64,${buffer.toString('base64')}`;
};

/** Watermark with dark background removed so it sits behind sheet content. */
export const readWatermarkBuffer = () => {
  if (cachedWatermarkBuffer) return cachedWatermarkBuffer;
  const raw = readAssetBuffer('inbest-water-mark.png');
  if (!raw) return null;
  cachedWatermarkBuffer = transparentizeDarkBackground(raw);
  return cachedWatermarkBuffer;
};
