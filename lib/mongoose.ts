import mongoose from "mongoose";
import { serverEnvironment } from "@/lib/env.mjs";

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
    console.log("[MongoDB] Connecting...");

    cached.promise = mongoose
      .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 30000,
        maxPoolSize: 10,
      })
      .then((mongooseInstance) => {
        console.log("[MongoDB] Connected successfully");
        return mongooseInstance;
      })
      .catch((error) => {
        console.error(
          "[MongoDB] Connection failed:",
          error
        );

        cached.promise = null;

        throw error;
      });
  }

  cached.conn = await cached.promise;

  return cached.conn;
}

export default connectDB;
