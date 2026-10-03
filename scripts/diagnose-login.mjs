
// Explains why an organization login fails, and can reset a password.
//
//   node scripts/diagnose-login.mjs                        overview of organizations and their users
//   node scripts/diagnose-login.mjs <empId> [password]     check one login (password optional)
//   node scripts/diagnose-login.mjs --reset <empId> [ORGCODE]
//                                                          set the password back to emp@1, unlock the
//                                                          account and ask for a password change at next login
//
// Reads MONGODB_URI (and NEXT_PUBLIC_ORGANIZATION_CODE) from .env.local / .env.
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

for (const file of [".env.local", ".env"]) {
  try { process.loadEnvFile(file); } catch { /* file not present */ }
}

const DEFAULT_PASSWORD = "emp@1";
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is required (set it in .env).");

const args = process.argv.slice(2);
const reset = args[0] === "--reset";
const [first, second] = reset ? args.slice(1) : args;

await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
try {
  const db = mongoose.connection.db;
  const organizations = await db.collection("organizations").find({}).sort({ createdAt: -1 }).toArray();
  const orgById = new Map(organizations.map((org) => [String(org._id), org]));
  const orgName = (orgId) => {
    const org = orgById.get(String(orgId));
    return org ? `${org.name} [${org.code}]${org.status === "ACTIVE" ? "" : " (INACTIVE)"}` : `unknown organization (${orgId})`;
  };
  const envCode = String(process.env.NEXT_PUBLIC_ORGANIZATION_CODE || "").trim().toUpperCase();

  console.log(`Connected to database: ${db.databaseName}`);
  if (envCode) {
    console.log(`\n!! NEXT_PUBLIC_ORGANIZATION_CODE is set to "${envCode}".`);
    console.log("   The login page sends this code with every login that has no ?org= in the URL,");
    console.log("   so only users of that organization can sign in there. Blank it and restart npm run dev");
    console.log("   to let each organization's users sign in from the plain login page.");
  } else {
    console.log("NEXT_PUBLIC_ORGANIZATION_CODE is empty (good).");
  }

  if (!first) {
    // ---- Overview -------------------------------------------------------
    for (const org of organizations) {
      const users = await db.collection("users").find({ orgId: String(org._id) }).project({ username: 1, role: 1, status: 1, isFirstLogin: 1, lockedUntil: 1, failedLoginAttempts: 1 }).toArray();
      console.log(`\n${org.name}  [code ${org.code}]  ${org.status}  phone: ${org.contactPhone || "-"}  users: ${users.length}`);
      for (const user of users.filter((u) => ["DIRECTOR", "ADMIN"].includes(String(u.role).toUpperCase()))) {
        const locked = user.lockedUntil && new Date(user.lockedUntil) > new Date() ? `  LOCKED until ${new Date(user.lockedUntil).toISOString()}` : "";
        console.log(`   ${user.role}: Employee ID "${user.username}"  status ${user.status}  ${user.isFirstLogin ? "first login pending (default password)" : "password already changed"}${locked}`);
      }
    }
    const usernames = await db.collection("users").aggregate([{ $group: { _id: "$username", orgs: { $addToSet: "$orgId" } } }, { $match: { "orgs.1": { $exists: true } } }]).toArray();
    if (usernames.length) {
      console.log("\nEmployee IDs that exist in more than one organization (these need ?org=CODE on the login URL):");
      for (const entry of usernames) console.log(`   "${entry._id}" -> ${entry.orgs.map(orgName).join(" | ")}`);
    }
    console.log("\nCheck one login:  node scripts/diagnose-login.mjs <employeeId> [password]");
  } else {
    // ---- Single login check / reset -------------------------------------
    const username = first.trim();
    let matches = await db.collection("users").find({ username }).project({ username: 1, role: 1, status: 1, password: 1, orgId: 1, isFirstLogin: 1, lockedUntil: 1, failedLoginAttempts: 1 }).toArray();
    if (!matches.length) {
      const like = await db.collection("users").find({ username: { $regex: `^${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*")}$`, $options: "i" } }).limit(5).toArray();
      console.log(`\nNo user with Employee ID exactly "${username}".`);
      if (like.length) console.log(`Similar IDs: ${like.map((u) => `"${u.username}" (${orgName(u.orgId)})`).join(", ")}`);
      else console.log('Tip: the Employee ID is the mobile number with no spaces or dashes (for example 7995004310). Run without arguments to list the real IDs.');
    } else if (reset) {
      const wanted = String(second || "").trim().toUpperCase();
      if (wanted) matches = matches.filter((u) => orgById.get(String(u.orgId))?.code === wanted);
      if (matches.length !== 1) {
        console.log(`\n${matches.length} accounts match "${username}". Give the organization code as the last argument: --reset ${username} ORGCODE`);
      } else {
        await db.collection("users").updateOne(
          { _id: matches[0]._id },
          { $set: { password: await bcrypt.hash(DEFAULT_PASSWORD, 12), failedLoginAttempts: 0, isFirstLogin: true, status: "Active" }, $unset: { lockedUntil: 1 } },
        );
        console.log(`\nReset done for "${username}" in ${orgName(matches[0].orgId)}. Sign in with password ${DEFAULT_PASSWORD} (you will be asked to change it).`);
      }
    } else {
      console.log(`\nFound ${matches.length} account(s) with Employee ID "${username}":`);
      for (const user of matches) {
        const org = orgById.get(String(user.orgId));
        console.log(`\n - ${orgName(user.orgId)}  role ${user.role}  status ${user.status}`);
        const problems = [];
        if (user.status !== "Active") problems.push(`account status is "${user.status}" (must be Active)`);
        if (org && org.status !== "ACTIVE") problems.push("the organization is INACTIVE, so its code is rejected at login");
        if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) problems.push(`locked after too many wrong passwords until ${new Date(user.lockedUntil).toISOString()} (use --reset)`);
        if (envCode && org && org.code !== envCode) problems.push(`NEXT_PUBLIC_ORGANIZATION_CODE is "${envCode}", so the login page looks only in that organization and never finds this user`);
        if (second !== undefined) {
          const ok = await bcrypt.compare(second, user.password || "");
          if (!ok) problems.push(`the password you gave does not match (${user.isFirstLogin ? `it should still be the default ${DEFAULT_PASSWORD}` : "the user already changed it, use --reset to set it back to the default"})`);
          else console.log("   password matches");
        } else if (user.isFirstLogin) {
          console.log(`   still on the default password (${DEFAULT_PASSWORD}) - first login pending`);
        }
        if (org) console.log(`   organization code: ${org.code}  ->  direct link: http://localhost:3000/?org=${org.code}`);
        console.log(problems.length ? problems.map((p) => `   PROBLEM: ${p}`).join("\n") : "   no problems found for this account");
      }
      if (matches.length > 1) console.log(`\nThis ID exists in ${matches.length} organizations, so the plain login page cannot choose. Use the ?org=CODE link of the right one.`);
    }
  }
} finally {
  await mongoose.disconnect();
}