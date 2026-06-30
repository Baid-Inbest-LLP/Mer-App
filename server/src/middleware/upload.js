import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config/index.js';
import { ApiError } from '../utils/ApiError.js';

if (!fs.existsSync(config.upload.dir)) {
  fs.mkdirSync(config.upload.dir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.upload.dir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (config.upload.allowedMime.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(ApiError.badRequest('Only PDF, JPG, and PNG files are allowed'), false);
  }
};

export const uploadInvoice = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxSize },
}).single('invoiceCopy');
