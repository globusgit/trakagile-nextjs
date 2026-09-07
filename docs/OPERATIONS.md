# TrakAgile operations

## Production endpoints

- Web and mobile API: `https://trakagile.com`
- `https://www.trakagile.com` redirects to the canonical non-www host.
- The Next.js service listens only on `127.0.0.1:3100`; Nginx is the public entry point on ports 80 and 443.

## Attendance automation

`trakagile-attendance-reminders.timer` calls the protected reminder endpoint every minute. The secret is stored only in the production `.env.local` file as `CRON_SECRET`.

Useful checks:

```bash
systemctl status trakagile-attendance-reminders.timer
journalctl -u trakagile-attendance-reminders.service --since today
```

## Mobile releases

Run `scripts/build-mobile-release.ps1`. The script analyzes the Flutter project, builds against the HTTPS production API, creates a versioned APK, and prints its SHA-256 checksum.

Production keystore signing remains intentionally pending. Never commit `key.properties`, `.jks`, or `.keystore` files.

## Database backups

Production uses the `trakagile-mongodb-backup.timer` service for daily encrypted-permission MongoDB archives with retention. Regularly copy backups off-server and perform a restore drill into a separate test database.

## TLS certificate

Certbot renewal runs through its system timer. Add a monitored operations email with:

```bash
certbot update_account --email operations@example.com
```

Replace the example address with the organization-owned mailbox.
