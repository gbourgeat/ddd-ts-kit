/** What declares a column of file content: a binary type of an ORM, of SQL or of Prisma, or a column of base64 text. */
export const FILE_CONTENT_PATTERNS: readonly RegExp[] = [
  /\b(?:bytea|(?:tiny|medium|long)?blob|varbinary)\b/i,
  /\.binary\s*\(/,
  /customType\s*<\s*\{\s*data\s*:\s*(?:Buffer|Uint8Array)/,
  /^\s*\w+\s+Bytes\b/,
  /base_?64/i,
];
