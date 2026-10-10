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
import type { ChainHead } from '../chain/chain-head.js';
import { chainOfTenant } from '../chain/chain-of-tenant.js';
import { emptyChain } from '../chain/empty-chain.js';
import { headAfter } from '../chain/head-after.js';
import { seal } from '../chain/seal.js';
import { sealCheckpoint } from '../chain/seal-checkpoint.js';
import { comparing } from '../listing/comparing.js';
import { decodeCursor } from '../listing/decode-cursor.js';
import { encodeCursor } from '../listing/encode-cursor.js';
import type { ListOrder } from '../listing/list-order.js';
import { matches } from '../listing/matches.js';
import { orderOf } from '../listing/order-of.js';
import type { AuditTrailOptions } from './audit-trail-options.js';

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
  const compare = comparing(order);

  return (entry) => compare(entry, position) > 0;
}
