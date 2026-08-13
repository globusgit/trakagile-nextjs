// This file must be imported first, before any Node.js code runs
import { resolveSrv, setServers } from "dns";
import { promisify } from "util";

// Force Google DNS to resolve MongoDB SRV records
console.log("[Init] Configuring DNS for MongoDB connection");

try {
  setServers(["8.8.8.8", "8.8.4.4"]);
  console.log("[Init] ✓ DNS servers set to Google DNS");
  
  // Pre-resolve the MongoDB SRV record to populate cache
  const resolveSrvAsync = promisify(resolveSrv);
  resolveSrvAsync("_mongodb._tcp.cluster0.nl4edxh.mongodb.net")
    .then(records => {
      console.log("[Init] ✓ MongoDB SRV record pre-resolved successfully");
      
      // Store resolved hosts for use in connection
      if (records && records.length > 0) {
        const hosts = records.map(r => `${r.name}:${r.port}`).join(',');
        (global as any).MONGODB_DIRECT_HOSTS = hosts;
        console.log("[Init] Direct hosts available:", hosts);
      }
    })
    .catch(err => {
      console.warn("[Init] ⚠ SRV pre-resolution failed:", err.message);
    });
} catch (error) {
  console.error("[Init] ✗ DNS setup error:", error);
}


