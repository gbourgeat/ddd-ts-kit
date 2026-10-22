import type { StoredMetadata } from './stored-metadata';

export function isStoredMetadata(value: unknown): value is StoredMetadata {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const metadata: Partial<Record<keyof StoredMetadata, unknown>> = value;

  return typeof metadata.mediaType === 'string' && typeof metadata.checksum === 'string';
}
