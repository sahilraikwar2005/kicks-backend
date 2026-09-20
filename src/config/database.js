import dns from 'dns';
import mongoose from 'mongoose';
import { env } from './env.js';

try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  // fallback if DNS set fails
}

export async function connectDatabase() {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(env.mongoUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 10000,
    });

    console.log('MongoDB connected successfully');
    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    throw error;
  }
}

export function closeDatabase() {
  return mongoose.connection.close();
}
