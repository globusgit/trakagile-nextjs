import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
const username = String(process.env.PLATFORM_ADMIN_USERNAME || "").trim().toLowerCase();
const name = String(process.env.PLATFORM_ADMIN_NAME || "System Administrator").trim();
const password = String(process.env.PLATFORM_ADMIN_PASSWORD || "");
if (!uri) throw new Error("MONGODB_URI is required.");
if (!/^[a-z0-9._-]{3,64}$/.test(username)) throw new Error("PLATFORM_ADMIN_USERNAME must be 3-64 safe characters.");
if (password.length < 12) throw new Error("PLATFORM_ADMIN_PASSWORD must contain at least 12 characters.");

await mongoose.connect(uri);
const now = new Date();
await mongoose.connection.db.collection("platformadmins").updateOne(
  { username },
  { $set: { name, password: await bcrypt.hash(password, 12), status: "ACTIVE", failedLoginAttempts: 0, lockedUntil: null, updatedAt: now }, $setOnInsert: { createdAt: now } },
  { upsert: true },
);
console.log(`System Admin '${username}' is ready.`);
await mongoose.disconnect();
