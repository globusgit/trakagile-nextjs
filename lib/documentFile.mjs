const signatures = [
  { mimeType: "application/pdf", extension: ".pdf", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { mimeType: "image/png", extension: ".png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mimeType: "image/jpeg", extension: ".jpg", bytes: [0xff, 0xd8, 0xff] },
];

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export function detectDocumentType(buffer) {
  if (!buffer?.length) return null;
  return signatures.find(({ bytes }) =>
    bytes.every((byte, index) => buffer[index] === byte),
  ) ?? null;
}
