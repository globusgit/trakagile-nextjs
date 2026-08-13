import "./dns-init";
import mongoose from "mongoose";
import { resolveSrv } from "dns/promises";
import { setServers } from "dns";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not defined in .env");
}

let cached = (global as any).mongoose || { conn: null, promise: null };

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000;

// Convert SRV-based URI to direct host URI synchronously from pre-resolved hosts
function buildDirectUri(originalUri: string): string {
  const directHosts = (global as any).MONGODB_DIRECT_HOSTS;
  
  if (!directHosts || !originalUri.includes("mongodb+srv://")) {
    return originalUri;
  }

  try {
    // Extract credentials and database from original URI
    const credsMatch = originalUri.match(/mongodb\+srv:\/\/([^@]+)@/);
    const dbMatch = originalUri.match(/\/([^/?]+)/);
    const optionsMatch = originalUri.match(/\?(.*)$/);

    if (!credsMatch || !dbMatch) return originalUri;

    const creds = credsMatch[1];
    const dbName = dbMatch[1];
    const options = optionsMatch ? optionsMatch[1] : "";

    const directUri = `mongodb://${creds}@${directHosts}/${dbName}?${options}&authSource=admin`;
    return directUri;
  } catch (e) {
    return originalUri;
  }
}

async function connectWithRetry(
  uri: string,
  attempt: number = 1
): Promise<any> {
  try {
    console.log(`[MongoDB] Connection attempt ${attempt}/${RETRY_ATTEMPTS}`);

    // Try to use direct hosts if available
    let connectionUri = uri;
    if (attempt === 1 && (global as any).MONGODB_DIRECT_HOSTS) {
      connectionUri = buildDirectUri(uri);
      console.log("[MongoDB] Using pre-resolved direct hosts");
    }

    const conn = await mongoose.connect(connectionUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: "majority",
      journal: true,
    });

    console.log("[MongoDB] ✓ Connected successfully!");
    return conn;
  } catch (error: any) {
    console.error(
      `[MongoDB] ✗ Attempt ${attempt} failed:`,
      error.code || error.name || error.message
    );

    if (attempt < RETRY_ATTEMPTS) {
      console.log(`[MongoDB] Retrying in ${RETRY_DELAY}ms...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return connectWithRetry(uri, attempt + 1);
    }

    throw new Error(
      `MongoDB connection failed (${error.code || error.name}). ` +
        `⚠️  IMPORTANT: Your IP must be whitelisted. Go to ` +
        `https://cloud.mongodb.com → Network Access → Add your IP. ` +
        `Current error: ${error.message}`
    );
  }
}

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = connectWithRetry(MONGODB_URI)
      .then((mongoose) => {
        return mongoose;
      })
      .catch((error) => {
        cached.promise = null;
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;
