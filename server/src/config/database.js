import mongoose from 'mongoose';
import { config } from './index.js';

/** Options tuned for MongoDB Atlas on Windows (TLS / IPv6 issues). */
export const getConnectionOptions = (uri) => {
  const options = {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
  };

  if (uri.startsWith('mongodb+srv://') || uri.includes('mongodb.net')) {
    options.autoSelectFamily = false;
    options.family = 4;
  }

  return options;
};

export const connectDatabase = async () => {
  const uri = config.mongodbUri;
  const options = getConnectionOptions(uri);

  try {
    await mongoose.connect(uri, options);
    console.log('MongoDB connected successfully');
    console.log(`Database: ${mongoose.connection.name}`);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);

    if (uri.includes('mongodb+srv://') || uri.includes('mongodb.net')) {
      console.error('\nAtlas checklist:');
      console.error('  1. MONGODB_URI must include a database name, e.g. ...mongodb.net/mer_db');
      console.error('  2. Atlas → Network Access → allow your IP (or 0.0.0.0/0 for dev)');
      console.error('  3. Confirm username/password in Database Access');
    } else {
      console.error('\nLocal MongoDB: start with `docker compose up -d mongodb` or install MongoDB.');
    }

    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});
