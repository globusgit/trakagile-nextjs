import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
const defaultCode = String(process.env.DEFAULT_ORG_CODE || "DEFAULT").trim().toUpperCase();
if (!uri) throw new Error("MONGODB_URI is required.");

await mongoose.connect(uri);
const db = mongoose.connection.db;

const organizations = db.collection("organizations");
const existingOrganizations = await organizations.find({}).toArray();
for (const [index, organization] of existingOrganizations.entries()) {
  if (!organization.code) {
    const code = existingOrganizations.length === 1 ? defaultCode : `ORG-${index + 1}`;
    await organizations.updateOne({ _id: organization._id }, { $set: { code, status: organization.status || "ACTIVE" } });
  }
}

async function dropIndexIfPresent(collectionName, indexName) {
  const collection = db.collection(collectionName);
  const indexes = await collection.indexes();
  if (indexes.some((index) => index.name === indexName)) await collection.dropIndex(indexName);
}

await dropIndexIfPresent("users", "username_1");
await dropIndexIfPresent("employees", "empId_1");
await dropIndexIfPresent("employees", "email_1");

await organizations.createIndex({ code: 1 }, { unique: true });
await db.collection("users").createIndex({ orgId: 1, username: 1 }, { unique: true });
await db.collection("employees").createIndex({ orgId: 1, empId: 1 }, { unique: true });
await db.collection("employees").createIndex({ orgId: 1, email: 1 }, { unique: true });

console.log("Multi-tenant indexes and organization codes are ready.");
await mongoose.disconnect();
