
// Shared by the System Admin organization forms (client) and the organization
// API routes (server). Pure JavaScript - no framework or database imports.

// Same default password the Employees module gives every new employee.
export const DEFAULT_EMPLOYEE_PASSWORD = "emp@1";

// Country -> regional defaults stored on the organization (time zone, locale,
// currency, ISO code). They can still be changed later from Settings.
export const COUNTRIES = Object.freeze([
  { name: "India", countryCode: "IN", currency: "INR", locale: "en-IN", timeZone: "Asia/Kolkata" },
  { name: "United States", countryCode: "US", currency: "USD", locale: "en-US", timeZone: "America/New_York" },
  { name: "United Kingdom", countryCode: "GB", currency: "GBP", locale: "en-GB", timeZone: "Europe/London" },
  { name: "United Arab Emirates", countryCode: "AE", currency: "AED", locale: "en-AE", timeZone: "Asia/Dubai" },
  { name: "Singapore", countryCode: "SG", currency: "SGD", locale: "en-SG", timeZone: "Asia/Singapore" },
  { name: "Australia", countryCode: "AU", currency: "AUD", locale: "en-AU", timeZone: "Australia/Sydney" },
  { name: "Canada", countryCode: "CA", currency: "CAD", locale: "en-CA", timeZone: "America/Toronto" },
]);

const INDIA_STATES = Object.freeze([
  "ANDHRA PRADESH", "ARUNACHAL PRADESH", "ASSAM", "BIHAR", "CHHATTISGARH", "GOA", "GUJARAT", "HARYANA",
  "HIMACHAL PRADESH", "JHARKHAND", "KARNATAKA", "KERALA", "MADHYA PRADESH", "MAHARASHTRA", "MANIPUR",
  "MEGHALAYA", "MIZORAM", "NAGALAND", "ODISHA", "PUNJAB", "RAJASTHAN", "SIKKIM", "TAMIL NADU", "TELANGANA",
  "TRIPURA", "UTTAR PRADESH", "UTTARAKHAND", "WEST BENGAL",
  "ANDAMAN AND NICOBAR ISLANDS", "CHANDIGARH", "DADRA AND NAGAR HAVELI AND DAMAN AND DIU", "DELHI",
  "JAMMU AND KASHMIR", "LADAKH", "LAKSHADWEEP", "PUDUCHERRY",
]);

export const INDUSTRY_TYPES = Object.freeze([
  "IT / Software", "Manufacturing", "Healthcare", "Education", "Retail", "Finance & Banking",
  "Construction & Real Estate", "Logistics & Transport", "Hospitality", "Telecom",
  "Media & Entertainment", "Consulting / Services", "Agriculture", "Government / Non-profit", "Other",
]);

export const REGISTRATION_MODES = Object.freeze([
  "MCA (Companies Act)", "MSME / Udyam", "Shops & Establishment", "GST Only", "Trust / Society Registration", "Not Registered",
]);

export const ORGANIZATION_TYPES = Object.freeze([
  "Private Limited", "Public Limited", "LLP", "Partnership", "Proprietorship", "Trust / NGO", "Government", "Other",
]);

// Built-in designation data. New organizations get these in their Designation
// list (see lib/organizationDefaults.js). DIRECTOR and ACCOUNTANT must stay
// spelled exactly like this: the Employees module maps them to roles.
export const DEFAULT_DESIGNATIONS = Object.freeze([
  "DIRECTOR", "MANAGING DIRECTOR", "CEO", "GENERAL MANAGER", "PROJECT MANAGER", "HR MANAGER", "TEAM LEAD",
  "SENIOR SOFTWARE ENGINEER", "SOFTWARE ENGINEER", "QA ENGINEER", "BUSINESS ANALYST", "ACCOUNTANT",
  "SALES EXECUTIVE", "OFFICE ADMINISTRATOR", "INTERN",
]);

const COUNTRY_STATES = Object.freeze({ India: INDIA_STATES });

function findByName(list, value) {
  const wanted = String(value ?? "").trim().toLowerCase();
  return list.find((item) => String(item).toLowerCase() === wanted);
}

export function findCountry(value) {
  const wanted = String(value ?? "").trim().toLowerCase();
  return COUNTRIES.find((country) => country.name.toLowerCase() === wanted) || null;
}

/** State names for a country, or [] when the state should be typed in. */
export function statesForCountry(countryName) {
  const country = findCountry(countryName);
  return country ? [...(COUNTRY_STATES[country.name] || [])] : [];
}

/** Regional settings (time zone, locale, currency, ISO code) for a country. */
export function internationalDefaultsForCountry(countryName) {
  const country = findCountry(countryName) || COUNTRIES[0];
  const { countryCode, currency, locale, timeZone } = country;
  return { countryCode, currency, locale, timeZone };
}

/**
 * The mobile number as it will be used for login (spaces, dashes, dots and
 * brackets removed; optional leading +). Returns "" when it is not a valid
 * 7-15 digit number.
 */
export function normalizeMobileNumber(value) {
  const cleaned = String(value ?? "").replace(/[\s\-().]/g, "");
  return /^\+?\d{7,15}$/.test(cleaned) ? cleaned : "";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LENGTH = 500;
const REQUIRED = "This field is required.";

/**
 * Validates and normalizes the organization form. `partial` (used when
 * editing) only insists on the details every organization already has -
 * name, phone, email and address - because older organizations were created
 * before the other fields existed. Fields that are filled in are always checked.
 *
 * @returns {{ errors: Record<string, string>, value: Record<string, string> }}
 */
export function validateOrganizationInput(input = {}, { partial = false } = {}) {
  const errors = {};
  const text = (key) => String(input?.[key] ?? "").trim();
  const value = {
    name: text("name"),
    contactPerson: text("contactPerson"),
    contactDesignation: text("contactDesignation"),
    contactPhone: text("contactPhone"),
    contactEmail: text("contactEmail").toLowerCase(),
    website: text("website"),
    address: text("address"),
    city: text("city"),
    district: text("district"),
    country: text("country"),
    state: text("state"),
    pincode: text("pincode"),
    industryType: text("industryType"),
    registrationMode: text("registrationMode"),
    organizationType: text("organizationType"),
    panNumber: text("panNumber").toUpperCase(),
    gstNumber: text("gstNumber").toUpperCase(),
    loginId: "",
  };

  for (const [key, entry] of Object.entries(value)) {
    if (entry.length > MAX_LENGTH) errors[key] = "This value is too long.";
  }

  // Always required.
  for (const key of ["name", "contactPhone", "contactEmail", "address"]) {
    if (!value[key]) errors[key] ||= REQUIRED;
  }
  // Required when creating; only checked when filled in while editing.
  for (const key of ["city", "country", "state", "industryType", "registrationMode", "organizationType"]) {
    if (!partial && !value[key]) errors[key] ||= REQUIRED;
  }

  if (value.contactPhone) {
    value.loginId = normalizeMobileNumber(value.contactPhone);
    if (!value.loginId) errors.contactPhone ||= "Enter a valid mobile number (7-15 digits).";
  }
  if (value.contactEmail && !EMAIL_PATTERN.test(value.contactEmail)) errors.contactEmail ||= "Enter a valid email address.";

  if (value.country) {
    const country = findCountry(value.country);
    if (!country) errors.country ||= "Select a country from the list.";
    else value.country = country.name;
  }
  if (value.state) {
    const states = statesForCountry(value.country);
    if (states.length) {
      const state = findByName(states, value.state);
      if (!state) errors.state ||= "Select a state from the list.";
      else value.state = state;
    }
  }
  for (const [key, options, label] of [
    ["industryType", INDUSTRY_TYPES, "industry type"],
    ["registrationMode", REGISTRATION_MODES, "registration mode"],
    ["organizationType", ORGANIZATION_TYPES, "organization type"],
  ]) {
    if (!value[key]) continue;
    const match = findByName(options, value[key]);
    if (!match) errors[key] ||= `Select a valid ${label}.`;
    else value[key] = match;
  }
  return { errors, value };
}