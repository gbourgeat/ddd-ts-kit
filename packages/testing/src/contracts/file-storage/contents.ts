/** The contents the suites write: a small PDF, a line of text, and the size of a large one. */
export const PDF = new Uint8Array(Buffer.from('%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n'));

export const TEXT = new Uint8Array(Buffer.from('Appointment notes, plain text.\n'));

/** Six mebibytes, enough to cross the part size of a multipart upload. */
export const LARGE_SIZE = 6 * 1_024 * 1_024;

export const LARGE_CHUNK = 65_536;
