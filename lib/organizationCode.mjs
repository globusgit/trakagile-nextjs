export function organizationCodeBase(name) {
  const words = String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .match(/[A-Z0-9]+/g) || [];
  if (!words.length) return "ORG";
  if (words.length === 1) return words[0].slice(0, 12);
  const initials = words.map((word) => word[0]).join("").slice(0, 10);
  return initials.length >= 2 ? initials : words.join("").slice(0, 12);
}

export async function availableOrganizationCode(name, exists) {
  const base = organizationCodeBase(name);
  if (!(await exists(base))) return base;
  for (let suffix = 2; suffix <= 9999; suffix += 1) {
    const candidate = `${base.slice(0, 27)}-${suffix}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error("Unable to allocate a unique organization code.");
}
