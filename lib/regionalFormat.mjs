import { DEFAULT_INTERNATIONAL_SETTINGS } from "./internationalSettings.mjs";

function settings(value = {}) { return { ...DEFAULT_INTERNATIONAL_SETTINGS, ...value }; }

export function formatRegionalDate(value, regional, options = {}) {
  const config = settings(regional);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(config.locale, { timeZone: config.timeZone, day: "2-digit", month: "short", year: "numeric", ...options }).format(date);
}

export function formatRegionalDateTime(value, regional, options = {}) {
  return formatRegionalDate(value, regional, { hour: "2-digit", minute: "2-digit", ...options });
}

export function formatRegionalCurrency(value, regional) {
  const config = settings(regional);
  return new Intl.NumberFormat(config.locale, { style: "currency", currency: config.currency }).format(Number(value) || 0);
}

export function formatRegionalNumber(value, regional, options = {}) {
  return new Intl.NumberFormat(settings(regional).locale, options).format(Number(value) || 0);
}
