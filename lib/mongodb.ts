/**
 * MongoDB Connection
 * Singleton pattern for database connection
 */

import mongoose from 'mongoose';
import { dbConfig } from '@/config/database';

type MongooseConnection = typeof mongoose;

declare global {
  var mongoose: {
    conn: MongooseConnection | null;
    promise: Promise<MongooseConnection> | null;
  } | undefined;
}

// Global variable to cache connection across hot reloads in development
const cached = global.mongoose ?? (global.mongoose = { conn: null, promise: null });

/**
 * Database connection with singleton pattern
 * Reuses existing connection to prevent connection pool exhaustion
 */
async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(dbConfig.uri, dbConfig.options);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default connectDB;
