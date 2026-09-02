const REQUIRED_ENVIRONMENT = ["MONGODB_URI"];

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateEnvironment(environment = process.env) {
  const missing = REQUIRED_ENVIRONMENT.filter((name) => !nonEmpty(environment[name]));
  if (!nonEmpty(environment.AUTH_SECRET) && !nonEmpty(environment.NEXTAUTH_SECRET)) {
    missing.push("AUTH_SECRET or NEXTAUTH_SECRET");
  }
  if (missing.length) {
    throw new Error(`Missing required environment configuration: ${missing.join(", ")}.`);
  }

  return Object.freeze({
    mongoUri: environment.MONGODB_URI.trim(),
    authSecret: (environment.AUTH_SECRET || environment.NEXTAUTH_SECRET).trim(),
    platformAdminKey: nonEmpty(environment.PLATFORM_ADMIN_KEY)
      ? environment.PLATFORM_ADMIN_KEY.trim()
      : null,
    cronSecret: nonEmpty(environment.CRON_SECRET) ? environment.CRON_SECRET.trim() : null,
    nodeEnv: environment.NODE_ENV || "development",
  });
}

let cachedEnvironment;

export function serverEnvironment() {
  cachedEnvironment ??= validateEnvironment(process.env);
  return cachedEnvironment;
}
