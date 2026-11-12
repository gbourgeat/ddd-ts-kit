import { ZIP_CONTAINERS } from './zip-containers';

/** The media types whose content is proven by its first bytes: the formats `signatureOf` recognises, and the zip containers. */
export const SIGNED_MEDIA_TYPES: readonly string[] = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/zip',
  'application/gzip',
  ...ZIP_CONTAINERS,
];
