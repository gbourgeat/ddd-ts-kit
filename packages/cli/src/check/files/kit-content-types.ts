/**
 * The media types `@ddd-ts-kit/kernel` has a content rule for, as its `SIGNED_MEDIA_TYPES` then its
 * `TEXT_MEDIA_TYPES` list them: a signature for the first, the text rule for the others. The
 * checker has no dependency, so it keeps its own copy; `kit-content-types.spec.ts` holds the two equal.
 */
export const KIT_CONTENT_TYPES: readonly string[] = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/zip',
  'application/gzip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/epub+zip',
  'text/plain',
  'text/csv',
  'text/markdown',
  'text/tab-separated-values',
  'application/json',
  'application/csv',
];
