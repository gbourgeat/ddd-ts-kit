import type { AuditEntry } from '@ddd-ts-kit/kernel';

/**
 * The entries of a chain to archive: from the one after the last archive, in the order of the
 * chain, while they are older than `before`, and without a hole. An entry dated after `before`
 * ends the range, even if a later one is older (a clock set back): the chain is archived from its
 * start, never in pieces.
 */
export function archivablePrefix(entries: readonly AuditEntry[], first: number, before: Date): AuditEntry[] {
  const prefix: AuditEntry[] = [];

  for (const entry of [...entries].sort((left, right) => left.sequence - right.sequence)) {
    if (entry.sequence !== first + prefix.length || entry.occurredAt.getTime() >= before.getTime()) {
      break;
    }

    prefix.push(entry);
  }

  return prefix;
}
