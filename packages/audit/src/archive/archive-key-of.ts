import { isFileKey } from '@ddd-ts-kit/kernel';

/** `audit-archives/tenant/acme/000000000001-000000000420.ndjson`: one folder per chain, the range in the name, sorted as text. */
export function archiveKeyOf(chain: string, from: number, to: number): string {
  const key = `audit-archives/${chain.split(':').join('/')}/${padded(from)}-${padded(to)}.ndjson`;

  if (!isFileKey(key)) {
    throw new TypeError(
      `The chain "${chain}" makes no file key: a chain is named after a tenant id, letters, digits, "_" and "-"`,
    );
  }

  return key;
}

function padded(sequence: number): string {
  return String(sequence).padStart(12, '0');
}
