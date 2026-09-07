import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
const defaultCode = String(process.env.DEFAULT_ORG_CODE || "DEFAULT").trim().toUpperCase();
const defaultName = String(process.env.DEFAULT_ORG_NAME || "Default Organization").trim();
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

const tenantIds = [...new Set((await Promise.all([
  db.collection("users").distinct("orgId"),
  db.collection("employees").distinct("orgId"),
])).flat().map((value) => String(value || "").trim()).filter(Boolean))];

for (const [index, tenantId] of tenantIds.entries()) {
  const objectId = mongoose.isValidObjectId(tenantId) ? new mongoose.Types.ObjectId(tenantId) : null;
  const existing = await organizations.findOne({
    $or: [
      ...(objectId ? [{ _id: objectId }] : []),
      { code: tenantId.toUpperCase() },
    ],
  });
  if (existing) continue;

  const code = /^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(tenantId.toUpperCase())
    ? tenantId.toUpperCase()
    : tenantIds.length === 1
      ? defaultCode
      : `LEGACY-${index + 1}`;
  await organizations.insertOne({
    ...(objectId ? { _id: objectId } : {}),
    name: tenantIds.length === 1 ? defaultName : `Legacy Organization ${index + 1}`,
    code,
    status: "ACTIVE",
    address: "Not provided",
    contactPerson: "Not provided",
    contactEmail: "not-provided@example.invalid",
    contactPhone: "Not provided",
    timeZone: "Asia/Kolkata",
    locale: "en-IN",
    currency: "INR",
    countryCode: "IN",
    weekStartsOn: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log(`Created missing organization master for tenant ${tenantId} using code ${code}.`);
}

async function dropIndexIfPresent(collectionName, indexName) {
  const collection = db.collection(collectionName);
  const indexes = await collection.indexes();
  if (indexes.some((index) => index.name === indexName)) await collection.dropIndex(indexName);
}

await dropIndexIfPresent("users", "username_1");
await dropIndexIfPresent("employees", "empId_1");
await dropIndexIfPresent("employees", "email_1");
await dropIndexIfPresent("employees", "empId_1_orgId_1");
await dropIndexIfPresent("employees", "email_1_orgId_1");

await organizations.createIndex({ code: 1 }, { unique: true });
await db.collection("users").createIndex({ orgId: 1, username: 1 }, { unique: true });
await db.collection("employees").createIndex({ orgId: 1, empId: 1 }, { unique: true });
await db.collection("employees").createIndex({ orgId: 1, email: 1 }, { unique: true });

console.log("Multi-tenant indexes and organization codes are ready.");
await mongoose.disconnect();
