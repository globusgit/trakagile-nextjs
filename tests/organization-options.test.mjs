import assert from "node:assert/strict";
import test from "node:test";
 
import { normalizeInternationalSettings } from "../lib/internationalSettings.mjs";
import {
  COUNTRIES,
  DEFAULT_DESIGNATIONS,
  DEFAULT_EMPLOYEE_PASSWORD,
  internationalDefaultsForCountry,
  normalizeMobileNumber,
  statesForCountry,
  validateOrganizationInput,
} from "../lib/organizationOptions.mjs";
 
const validForm = () => ({
  name: "Frazen Technologies",
  contactPerson: "Dheeraj Reddy",
  contactDesignation: "MANAGING DIRECTOR",
  contactPhone: "79950 04310",
  contactEmail: "Info@Frazen.in",
  address: "Madhapur",
  city: "Hyderabad",
  country: "india",
  state: "telangana",
  industryType: "IT / Software",
  registrationMode: "MSME / Udyam",
  organizationType: "Private Limited",
  panNumber: "abcde1234f",
});
 
test("a complete form is valid and is normalized", () => {
  const { errors, value } = validateOrganizationInput(validForm());
  assert.deepEqual(errors, {});
  assert.equal(value.loginId, "7995004310");
  assert.equal(value.contactEmail, "info@frazen.in");
  assert.equal(value.country, "India");
  assert.equal(value.state, "TELANGANA");
  assert.equal(value.panNumber, "ABCDE1234F");
});
 
test("all starred fields are required when creating", () => {
  const { errors } = validateOrganizationInput({});
  for (const key of ["name", "contactPhone", "contactEmail", "address", "city", "country", "state", "industryType", "registrationMode", "organizationType"]) {
    assert.ok(errors[key], `${key} should be required`);
  }
  for (const key of ["contactPerson", "contactDesignation", "website", "district", "pincode", "panNumber", "gstNumber"]) {
    assert.equal(errors[key], undefined, `${key} should be optional`);
  }
});
 
test("editing only requires the details every organization already has", () => {
  const { errors } = validateOrganizationInput({ name: "Old Org", contactPhone: "9109109101", contactEmail: "a@b.co", address: "Somewhere" }, { partial: true });
  assert.deepEqual(errors, {});
  assert.ok(validateOrganizationInput({ name: "Old Org", contactPhone: "9109109101", contactEmail: "a@b.co", address: "x", state: "Nowhere", country: "India" }, { partial: true }).errors.state);
});
 
test("invalid values are rejected", () => {
  const { errors } = validateOrganizationInput({ ...validForm(), contactPhone: "abc", contactEmail: "nope", state: "ATLANTIS", industryType: "Made up" });
  assert.ok(errors.contactPhone && errors.contactEmail && errors.state && errors.industryType);
  assert.ok(validateOrganizationInput({ ...validForm(), country: "Narnia" }).errors.country);
});
 
test("states are a list for India and free text for other countries", () => {
  assert.ok(statesForCountry("India").includes("TELANGANA"));
  assert.deepEqual(statesForCountry("Singapore"), []);
  assert.equal(validateOrganizationInput({ ...validForm(), country: "Singapore", state: "Central" }).errors.state, undefined);
});
 
test("mobile numbers become login ids", () => {
  assert.equal(normalizeMobileNumber("+91 (79950) 04-310"), "+917995004310");
  assert.equal(normalizeMobileNumber("12345"), "");
  assert.equal(normalizeMobileNumber("98765abc10"), "");
});
 
test("every country has valid regional defaults", () => {
  for (const country of COUNTRIES) {
    assert.doesNotThrow(() => normalizeInternationalSettings(internationalDefaultsForCountry(country.name)), country.name);
  }
  assert.equal(internationalDefaultsForCountry("India").timeZone, "Asia/Kolkata");
});
 
test("default designations keep the role-mapped names and the default password matches employees", () => {
  assert.ok(DEFAULT_DESIGNATIONS.includes("DIRECTOR") && DEFAULT_DESIGNATIONS.includes("ACCOUNTANT"));
  assert.equal(new Set(DEFAULT_DESIGNATIONS).size, DEFAULT_DESIGNATIONS.length);
  assert.equal(DEFAULT_EMPLOYEE_PASSWORD, "emp@1");
});
 