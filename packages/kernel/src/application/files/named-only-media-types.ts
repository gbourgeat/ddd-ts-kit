/**
 * The media types a browser runs when it opens them: a rule stated for a family (`image/*`,
 * `text/*`) never reaches them, so that a route takes one only by naming it.
 */
export const NAMED_ONLY_MEDIA_TYPES: readonly string[] = [
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
  'text/javascript',
  'application/javascript',
];
