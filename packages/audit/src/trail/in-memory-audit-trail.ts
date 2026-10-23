import {
  pageOf,
  type AuditEntry,
  type AuditFilter,
  type AuditReader,
  type AuditRecord,
  type AuditSortField,
  type AuditTrail,
  type Page,
  type PageRequest,
} from '@ddd-ts-kit/kernel';
import type { ChainHead } from '../chain/chain-head';
import { chainOfTenant } from '../chain/chain-of-tenant';
import { emptyChain } from '../chain/empty-chain';
import { headAfter } from '../chain/head-after';
import { seal } from '../chain/seal';
import { sealCheckpoint } from '../chain/seal-checkpoint';
import { comparing } from '../search/comparing';
import { decodeCursor } from '../search/decode-cursor';
import { encodeCursor } from '../search/encode-cursor';
import type { SearchOrder } from '../search/search-order';
import { matches } from '../search/matches';
import { orderOf } from '../search/order-of';
import type { AuditTrailOptions } from './audit-trail-options';

/**
 * The trail in the memory of the process: the fake of both ports, and enough for an
 * application without a database. `entries` is the store itself, in the order of arrival: a
 * test asserts it, and tampers with it to see a verification fail.
 */
export class InMemoryAuditTrail implements AuditTrail, AuditReader {
  readonly entries: AuditEntry[] = [];

  private readonly heads = new Map<string, ChainHead>();

  private readonly options: AuditTrailOptions;

  constructor(options: AuditTrailOptions = {}) {
    this.options = options;
  }

  async record(record: AuditRecord): Promise<void> {
    const chain = (this.options.chainOf ?? chainOfTenant)(record);
    const entry = seal(record, this.heads.get(chain) ?? emptyChain(chain));

    this.heads.set(chain, headAfter(entry));
    this.entries.push(entry);
    await sealCheckpoint(entry, this.options.sealing);
  }

  async search(filter: AuditFilter, page: PageRequest<AuditSortField>): Promise<Page<AuditEntry>> {
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

function after(cursor: string, order: SearchOrder): (entry: AuditEntry) => boolean {
  const position = decodeCursor(cursor);
  const compare = comparing(order);

  return (entry) => compare(entry, position) > 0;
}
