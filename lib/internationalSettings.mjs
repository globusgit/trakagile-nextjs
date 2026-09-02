export const DEFAULT_INTERNATIONAL_SETTINGS = Object.freeze({ timeZone: "Asia/Kolkata", locale: "en-IN", currency: "INR", countryCode: "IN", weekStartsOn: 1 });

export function normalizeInternationalSettings(input = {}) {
  const value = {
    timeZone: String(input.timeZone || DEFAULT_INTERNATIONAL_SETTINGS.timeZone).trim(),
    locale: String(input.locale || DEFAULT_INTERNATIONAL_SETTINGS.locale).trim(),
    currency: String(input.currency || DEFAULT_INTERNATIONAL_SETTINGS.currency).trim().toUpperCase(),
    countryCode: String(input.countryCode || DEFAULT_INTERNATIONAL_SETTINGS.countryCode).trim().toUpperCase(),
    weekStartsOn: Number(input.weekStartsOn ?? DEFAULT_INTERNATIONAL_SETTINGS.weekStartsOn),
  };
  try { new Intl.DateTimeFormat(value.locale, { timeZone: value.timeZone }).format(); }
  catch { throw new Error("Enter a valid locale and IANA time zone."); }
  if (!/^[A-Z]{3}$/.test(value.currency)) throw new Error("Currency must be a three-letter ISO code.");
  if (!/^[A-Z]{2}$/.test(value.countryCode)) throw new Error("Country must be a two-letter ISO code.");
  if (!Number.isInteger(value.weekStartsOn) || value.weekStartsOn < 0 || value.weekStartsOn > 6) throw new Error("Week start must be between Sunday and Saturday.");
  return Object.freeze(value);
}
