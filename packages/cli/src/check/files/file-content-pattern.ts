const TEXT_TYPES = '(?:text|varchar|char|string|json|jsonb|clob|longtext|mediumtext|character varying)';

/**
 * What declares a column of file content: a binary type of an ORM, of SQL or of Prisma, or a
 * column of text whose name says base64. A word base64 elsewhere (an encoded cursor, an ETag)
 * declares no column and is not matched.
 */
export const FILE_CONTENT_PATTERNS: readonly RegExp[] = [
  /\b(?:bytea|(?:tiny|medium|long)?blob|varbinary)\b/i,
  /\.binary\s*\(/,
  /customType\s*<\s*\{\s*data\s*:\s*(?:Buffer|Uint8Array)/,
  /^\s*\w+\s+Bytes\b/,
  new RegExp(`\\b${TEXT_TYPES}\\s*\\(\\s*['"\`]\\w*base_?64\\w*['"\`]`, 'i'),
  new RegExp(`\\b\\w*base_?64\\w*\\s*:\\s*${TEXT_TYPES}\\s*\\(`, 'i'),
  new RegExp(`["\`]?\\b\\w*base_?64\\w*\\b["\`]?\\s+${TEXT_TYPES}\\b`, 'i'),
  /^\s*\w*base_?64\w*\s+String\b/i,
];
