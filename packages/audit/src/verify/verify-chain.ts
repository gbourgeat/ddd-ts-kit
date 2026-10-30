import {
  DEFAULT_PAGE_LIMITS,
  cursorPage,
  type AuditEntry,
  type AuditReader,
  type AuditSortField,
} from '@ddd-ts-kit/kernel';
import type { AuditCheckpoint } from '../chain/audit-checkpoint';
import { GENESIS_HASH } from '../chain/genesis-hash';
import { hashOf } from '../chain/hash-of';
import type { ChainBreakKind } from './chain-break-kind';
import type { ChainVerification } from './chain-verification';

export interface VerifyChainOptions {
  /** Required with a reader. With entries: the one chain to verify, every chain found otherwise. */
  readonly chain?: string;

  /**
   * First and last sequence to examine, both included. Default: from 1, or from the entry after
   * `after`, to the last entry given.
   */
  readonly from?: number;

  readonly to?: number;

  /**
   * Checkpoints published elsewhere: an entry at one of these positions must have that hash, and
   * the chain must reach the last of them, inside `to` when there is one: a chain that stops
   * before is a chain cut at its tail. Without `chain`, a chain a checkpoint names is verified
   * like a chain found in the entries.
   */
  readonly checkpoints?: readonly AuditCheckpoint[];

  /**
   * The entry just before the first one examined, as an archive keeps it (`lastHash` and
   * `toSequence`): the examination starts after it and the first entry must link to its hash, so
   * that the entries left in the trail are proven to go on from the archived ones. Without it,
   * starting at `from` above 1 trusts the entry before.
   */
  readonly after?: AuditCheckpoint;
}

/**
 * Walks one chain, or each chain found in the entries, in the order given, and reports the
 * first place where it does not hold, and stops there: past a break the chain proves nothing of
 * what comes next, and where it would go on is a guess. Whoever has looked at a break walks on
 * with `from` after it, which trusts that entry. Entries are examined as they come, never sorted:
 * an export that was shuffled is reported as such. Starting at `from` above 1 trusts the entry
 * before it; a chain rewritten as a whole is self-consistent and only a checkpoint shows it, as
 * only a later checkpoint or `to` shows a chain cut at its tail.
 */
export async function verifyChain(
  source: readonly AuditEntry[] | AuditReader,
  options: VerifyChainOptions = {},
): Promise<ChainVerification> {
  const range = startingAfterTheAnchor(options);
  const entries = isReader(source) ? await readChain(source, range) : source;
  let checked = 0;

  for (const chain of chainsOf(entries, range)) {
    const outcome = verifyOne(inRange(entries, chain, range), { ...range, chain });

    checked += outcome.checked;

    if (!outcome.valid) {
      return { ...outcome, checked };
    }
  }

  return { valid: true, checked };
}

function startingAfterTheAnchor(options: VerifyChainOptions): VerifyChainOptions {
  const { from, after } = options;

  return from === undefined && after !== undefined ? { ...options, from: after.sequence + 1 } : options;
}

function isReader(source: readonly AuditEntry[] | AuditReader): source is AuditReader {
  return 'search' in source && typeof source.search === 'function';
}

async function readChain(reader: AuditReader, options: VerifyChainOptions): Promise<AuditEntry[]> {
  if (options.chain === undefined) {
    throw new TypeError('verifyChain needs the chain to read from a reader');
  }

  const filter = {
    chain: options.chain,
    ...(options.from === undefined ? {} : { fromSequence: options.from }),
    ...(options.to === undefined ? {} : { toSequence: options.to }),
  };

  const sort = [{ field: 'sequence', direction: 'asc' }] as const;
  const entries: AuditEntry[] = [];
  let cursor: string | undefined;

  do {
    const request = cursorPage<AuditSortField>({
      limit: DEFAULT_PAGE_LIMITS.maxSize,
      sort,
      ...(cursor === undefined ? {} : { cursor }),
    });

    const page = await reader.search(filter, request);

    entries.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor !== undefined);

  return entries;
}

function chainsOf(entries: readonly AuditEntry[], options: VerifyChainOptions): string[] {
  if (options.chain !== undefined) {
    return [options.chain];
  }

  const checkpoints = options.checkpoints ?? [];

  return [...new Set([...entries, ...checkpoints].map(({ chain }) => chain))];
}

function inRange(entries: readonly AuditEntry[], chain: string, { from, to }: VerifyChainOptions): AuditEntry[] {
  return entries.filter(
    (entry) =>
      entry.chain === chain &&
      (from === undefined || entry.sequence >= from) &&
      (to === undefined || entry.sequence <= to),
  );
}

type OneChain = VerifyChainOptions & { readonly chain: string };

function verifyOne(entries: readonly AuditEntry[], options: OneChain): ChainVerification {
  const first = options.from ?? 1;

  for (const [position, entry] of entries.entries()) {
    const kind = breakAt(entries, { entry, position }, options);

    if (kind === undefined) {
      continue;
    }

    return {
      valid: false,
      checked: position,
      break: { kind, chain: options.chain, position, sequence: first + position, entryId: entry.id },
    };
  }

  const expected = first + entries.length;

  if (expected > (options.to ?? lastCheckpointOf(options))) {
    return { valid: true, checked: entries.length };
  }

  const missing = {
    kind: 'missing-entry',
    chain: options.chain,
    position: entries.length,
    sequence: expected,
  } as const;

  return { valid: false, checked: entries.length, break: missing };
}

function lastCheckpointOf({ chain, checkpoints = [] }: OneChain): number {
  return Math.max(...checkpoints.filter((checkpoint) => checkpoint.chain === chain).map(({ sequence }) => sequence));
}

/** The entry at a position of the listing. */
interface Listed {
  readonly entry: AuditEntry;
  readonly position: number;
}

function breakAt(
  entries: readonly AuditEntry[],
  { entry, position }: Listed,
  options: OneChain,
): ChainBreakKind | undefined {
  const expected = (options.from ?? 1) + position;

  if (entry.sequence !== expected) {
    return misplacement(entries.slice(position + 1), entry.sequence, expected);
  }

  if (hashOf(entry) !== entry.hash || !linksTo(entry, entries[position - 1], options.after)) {
    return 'altered-content';
  }

  return agreesWith(entry, options.checkpoints ?? []) ? undefined : 'altered-content';
}

function misplacement(rest: readonly AuditEntry[], found: number, expected: number): ChainBreakKind {
  return found < expected || rest.some((entry) => entry.sequence === expected) ? 'reordered' : 'missing-entry';
}

function linksTo(entry: AuditEntry, previous: AuditEntry | undefined, after: AuditCheckpoint | undefined): boolean {
  if (previous !== undefined) {
    return entry.previousHash === previous.hash;
  }

  if (after !== undefined) {
    return entry.sequence === after.sequence + 1 && entry.previousHash === after.hash;
  }

  return entry.sequence !== 1 || entry.previousHash === GENESIS_HASH;
}

function agreesWith(entry: AuditEntry, checkpoints: readonly AuditCheckpoint[]): boolean {
  return checkpoints
    .filter((checkpoint) => checkpoint.chain === entry.chain && checkpoint.sequence === entry.sequence)
    .every((checkpoint) => checkpoint.hash === entry.hash);
}
