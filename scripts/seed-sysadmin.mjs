// Creates (or resets) the System Admin account used at /sysadmin to create
// organizations. Safe to run repeatedly: it upserts by username.
//
//   npm run platform-admin:seed
//
// Defaults: username "sysadmin", password "Globus@2026".
// Override with PLATFORM_ADMIN_USERNAME / PLATFORM_ADMIN_PASSWORD /
// PLATFORM_ADMIN_NAME in the environment (or .env.local).
// Change the password after the first login on any shared environment.
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

// Pick up MONGODB_URI etc. from .env.local / .env when present. Variables that
// are already set in the shell are never overridden.
for (const file of [".env.local", ".env"]) {
  try { process.loadEnvFile(file); } catch { /* file not present */ }
}

const uri = process.env.MONGODB_URI;
const username = String(process.env.PLATFORM_ADMIN_USERNAME || "sysadmin").trim().toLowerCase();
const name = String(process.env.PLATFORM_ADMIN_NAME || "System Administrator").trim();
const password = String(process.env.PLATFORM_ADMIN_PASSWORD || "Globus@2026");

if (!uri) throw new Error("MONGODB_URI is required.");
if (!/^[a-z0-9._-]{3,64}$/.test(username)) throw new Error("PLATFORM_ADMIN_USERNAME must be 3-64 safe characters.");
if (password.length < 8) throw new Error("PLATFORM_ADMIN_PASSWORD must contain at least 8 characters.");

await mongoose.connect(uri);
try {
  const collection = mongoose.connection.db.collection("platformadmins");
  await collection.createIndex({ username: 1 }, { unique: true });
  const now = new Date();
  await collection.updateOne(
    { username },
    {
      $set: {
        name,
        password: await bcrypt.hash(password, 12),
        status: "ACTIVE",
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );
  console.log(`System Admin '${username}' is ready. Sign in at /sysadmin.`);
} finally {
  await mongoose.disconnect();
}