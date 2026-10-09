import { pageOf, type Page, type PageRequest } from '@ddd-ts-kit/kernel';
import { emptyChain, headAfter, seal, sealCheckpoint, type ChainHead } from './chain.js';
import { chainOfTenant, type AuditEntry, type AuditRecord } from './entry.js';
import { comparing, compareToPosition, decodeCursor, encodeCursor, matches, orderOf, type ListOrder } from './listing.js';
import type { AuditFilter, AuditReader, AuditSortField, AuditTrail, AuditTrailOptions } from './trail.js';

/**
 * The trail in the memory of the process: the fake of both ports, and enough for an
 * application without a database. `entries` is the store itself, in the order of arrival: a
 * test asserts it, and tampers with it to see a verification fail.
 */
export class InMemoryAuditTrail implements AuditTrail, AuditReader {
  readonly entries: AuditEntry[] = [];
  readonly #heads = new Map<string, ChainHead>();
  readonly #options: AuditTrailOptions;

  constructor(options: AuditTrailOptions = {}) {
    this.#options = options;
  }

  async record(record: AuditRecord): Promise<void> {
    const chain = (this.#options.chainOf ?? chainOfTenant)(record);
    const entry = seal(record, this.#heads.get(chain) ?? emptyChain(chain));
    this.#heads.set(chain, headAfter(entry));
    this.entries.push(entry);
    await sealCheckpoint(entry, this.#options.sealing);
  }

  async list(filter: AuditFilter, page: PageRequest<AuditSortField>): Promise<Page<AuditEntry>> {
    const order = orderOf(page);
    const found = this.entries.filter(matches(filter)).sort(comparing(order));
    if (page.kind === 'offset') {
      return pageOf(found.slice(page.offset, page.offset + page.limit), { total: found.length });
    }
    const rest = page.cursor === undefined ? found : found.filter(after(page.cursor, order));
    const items = rest.slice(0, page.limit);
    const last = items.at(-1);
    return pageOf(items, rest.length > items.length && last !== undefined ? { nextCursor: encodeCursor(last) } : {});
  }
}

function after(cursor: string, order: ListOrder): (entry: AuditEntry) => boolean {
  const position = decodeCursor(cursor);
  const sign = order.direction === 'asc' ? 1 : -1;
  return (entry) => sign * compareToPosition(entry, position, order.field) > 0;
}
