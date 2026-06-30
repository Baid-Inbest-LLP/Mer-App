import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { normalizeMongoUri } from '../config/index.js';
import { getConnectionOptions } from '../config/database.js';
import { ensureCompanies } from './ensureCompanies.js';

dotenv.config();

const uri = normalizeMongoUri(process.env.MONGODB_URI);

mongoose
  .connect(uri, getConnectionOptions(uri))
  .then(async () => {
    console.log('Connected. Upserting companies and branches...');
    await ensureCompanies();
    console.log('Companies and locations updated.');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
