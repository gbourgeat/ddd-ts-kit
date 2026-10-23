import type { FileGrant } from './file-grant';

export function isFileGrant(value: unknown): value is FileGrant {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const grant: Partial<Record<keyof FileGrant, unknown>> = value;

  return (
    (grant.action === 'download' || grant.action === 'upload') &&
    typeof grant.key === 'string' &&
    typeof grant.expiresAt === 'number' &&
    optionalString(grant.fileName) &&
    optionalString(grant.mediaType) &&
    (grant.maxBytes === undefined || typeof grant.maxBytes === 'number')
  );
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}
