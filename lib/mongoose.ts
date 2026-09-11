import mongoose, { type Mongoose } from "mongoose";
import { serverEnvironment } from "@/lib/env.mjs";
import { createLogger } from "@/lib/logger.mjs";

const logger = createLogger("mongodb");

const MONGODB_URI = serverEnvironment().mongoUri;

type MongooseCache = {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
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
      .then((mongooseInstance: Mongoose) => {
        logger.info("MongoDB connected successfully");
        setupConnectionListeners(mongooseInstance);
        return mongooseInstance;
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("MongoDB connection failed", { error: message });
        cached.promise = null;
        throw error;
      });
  }

  cached.conn = await cached.promise;

  return cached.conn;
}

function setupConnectionListeners(mongooseInstance: Mongoose) {
  mongooseInstance.connection.on("disconnected", () => {
    logger.warn("MongoDB connection lost");
    cached.conn = null;
    cached.promise = null;
  });

  mongooseInstance.connection.on("reconnected", () => {
    logger.info("MongoDB connection restored");
  });

  mongooseInstance.connection.on("error", (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("MongoDB connection error", { error: message });
  });
}

export async function healthCheck() {
  try {
    const conn = await connectDB();
    const db = conn.connection?.db;
    if (!db) {
      throw new Error("MongoDB connection is not ready");
    }
    await db.command({ ping: 1 });
    return { status: "ok", connected: true };
  } catch {
    return { status: "error", connected: false };
  }
}

export default connectDB;
