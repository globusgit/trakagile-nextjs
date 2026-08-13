# MongoDB Connection Troubleshooting Guide

## Current Status
- ✓ MongoDB Atlas cluster is **RUNNING** (verified with MongoDB Compass)
- ✓ DNS SRV records **CAN BE RESOLVED** with Google DNS
- ✗ Node.js/Mongoose connection still fails with `ECONNREFUSED`

## Root Cause
Your router's DNS server cannot resolve MongoDB SRV records, and even after setting Google DNS in Node.js, mongoose doesn't pick it up properly. This is likely a:
- Windows/Firewall DNS caching issue
- Network adapter DNS configuration
- Or Next.js/Turbopack DNS handling

## Quick Fixes (Try in Order)

### Fix #1: Change DNS to Google (System-Wide)
1. **Windows Settings** → **Network & Internet** → **Change adapter options**
2. Right-click your network → **Properties**
3. Select **Internet Protocol Version 4** → **Properties**
4. Change DNS to:
   - Preferred: `8.8.8.8`
   - Alternate: `8.8.4.4`
5. Click OK and restart your dev server

### Fix #2: Clear Windows DNS Cache
```powershell
ipconfig /flushdns
netsh int tcp set global autotuninglevel=disabled
netsh int tcp set global autotuninglevel=normal
```
Then restart dev server.

### Fix #3: Use MongoDB Atlas Network Configuration
1. Go to https://cloud.mongodb.com
2. **Network Access** → Check if your IP is in the whitelist
3. If not, add `0.0.0.0/0` (allows all - use for testing only)
4. Wait 2-3 minutes for changes to propagate

## Permanent Solution: Local MongoDB Development

Edit `.env.local`:
```bash
MONGODB_URI="mongodb://localhost:27017/tadb"
```

Then install MongoDB:
```powershell
# Download from: https://www.mongodb.com/try/download/community
# Or use Chocolatey:
choco install mongodb

# Start MongoDB:
mongod
```

## Debug Information
- Connection string: `mongodb+srv://psa:psa@cluster0.nl4edxh.mongodb.net/tadb`
- Cluster: `cluster0.nl4edxh.mongodb.net`
- Database: `tadb`
- Status: Can be accessed via MongoDB Compass but not from Node.js

## Support
If none of these work:
1. Check Windows Firewall → Allow Node.js outbound connections
2. Disable VPN/Proxy if running
3. Check if ISP blocks MongoDB ports (27017)
4. Try from a different network (mobile hotspot)
