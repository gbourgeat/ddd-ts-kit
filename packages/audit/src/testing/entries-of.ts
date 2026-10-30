import { offsetPage, type AuditEntry, type AuditReader } from '@ddd-ts-kit/kernel';

/** The entries of a chain, in the order of the chain. */
export async function entriesOf(reader: AuditReader, chain: string): Promise<readonly AuditEntry[]> {
  const sort = [{ field: 'sequence', direction: 'asc' }] as const;

  return (await reader.search({ chain }, offsetPage({ limit: 100, sort }))).items;
}
