export function escapeCsvValue(value) {
  const raw = value == null ? "" : String(value);
  // Keep spreadsheet applications from interpreting user-entered text as formulas.
  const normalized = /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

export function buildAttendanceCsv(rows = []) {
  const headers = [
    "empId",
    "name",
    "designation",
    "status",
    "locationName",
    "markInAt",
    "markOutAt",
    "distanceMeters",
  ];

  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(
      [
        escapeCsvValue(row.empId),
        escapeCsvValue(row.name),
        escapeCsvValue(row.designation),
        escapeCsvValue(row.status),
        escapeCsvValue(row.locationName),
        escapeCsvValue(row.markInAt),
        escapeCsvValue(row.markOutAt),
        escapeCsvValue(row.distanceMeters),
      ].join(",")
    );
  }

  return `${lines.join("\n")}\n`;
}
