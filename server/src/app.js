import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const normalizeOrigin = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '');

const allowedOrigins = [
  config.clientUrl,
  ...(process.env.FRONTEND_URLS || '').split(',').map((x) => x.trim()).filter(Boolean),
]
  .filter(Boolean)
  .map(normalizeOrigin);

const isAllowedOrigin = (origin) => {
  const normalizedOrigin = normalizeOrigin(origin);
  if (allowedOrigins.includes(normalizedOrigin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname.endsWith('.onrender.com')) return true;
  } catch {
    return false;
  }
  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(morgan(config.env === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, message: 'Too many requests' },
});
app.use('/api', limiter);

app.use('/uploads', express.static(path.resolve(config.upload.dir)));

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
