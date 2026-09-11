import mongoose from "mongoose";
import { serverEnvironment } from "@/lib/env.mjs";
import { createLogger } from "@/lib/logger.mjs";

const logger = createLogger("mongodb");

const MONGODB_URI = serverEnvironment().mongoUri;

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalWithMongoose = globalThis as typeof globalThis & {
  mongoose?: MongooseCache;
};

const cached: MongooseCache =
  globalWithMongoose.mongoose ?? {
    conn: null,
    promise: null,
  };

globalWithMongoose.mongoose = cached;

export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    logger.info("Connecting to MongoDB...");

    cached.promise = mongoose
      .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 30000,
        maxPoolSize: 10,
      })
      .then((mongooseInstance) => {
        logger.info("MongoDB connected successfully");
        setupConnectionListeners(mongooseInstance);
        return mongooseInstance;
      })
      .catch((error) => {
        logger.error("MongoDB connection failed", { error: error?.message });
        cached.promise = null;
        throw error;
      });
  }

  cached.conn = await cached.promise;

  return cached.conn;
}

function setupConnectionListeners(mongooseInstance) {
  mongooseInstance.connection.on("disconnected", () => {
    logger.warn("MongoDB connection lost");
    cached.conn = null;
    cached.promise = null;
  });

  mongooseInstance.connection.on("reconnected", () => {
    logger.info("MongoDB connection restored");
  });

  mongooseInstance.connection.on("error", (error) => {
    logger.error("MongoDB connection error", { error: error?.message });
  });
}

export async function healthCheck() {
  try {
    const conn = await connectDB();
    await conn.db.command({ ping: 1 });
    return { status: "ok", connected: true };
  } catch {
    return { status: "error", connected: false };
  }
}

export default connectDB;
