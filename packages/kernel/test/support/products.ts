import { defineCriteria } from '../../src';

/** A row of a catalogue whose fields hold every type a criteria knows, some of them null. */
export interface ProductRow {
  readonly sku: string;
  readonly name: string;
  readonly price: string;
  readonly stock: number;
  readonly active: boolean;
  readonly featured: boolean | null;
  readonly shelf: string | null;
  readonly restockedAt: Date | null;
}

export const products = defineCriteria<ProductRow>({
  fields: {
    sku: { type: 'string', filter: ['eq'] },
    name: { type: 'string', filter: ['ne', 'contains', 'startsWith', 'gt', 'lte'], sortable: true },
    price: { type: 'decimal', filter: ['eq', 'gt', 'gte', 'lt', 'lte', 'between', 'in'], sortable: true },
    stock: { type: 'number', filter: ['gt', 'lte'], sortable: true },
    active: { type: 'boolean', filter: ['eq', 'ne'], sortable: true },
    featured: { type: 'boolean', filter: ['eq'], sortable: true, nullable: true },
    shelf: { type: 'string', filter: ['eq', 'isNull'], sortable: true, nullable: true },
    restockedAt: { type: 'instant', filter: ['lt'], sortable: true, nullable: true },
  },
  tieBreaker: 'sku',
  limits: { maxDepth: 2 },
});

const october = new Date('2026-10-01T00:00:00Z');
const september = new Date('2026-09-15T00:00:00Z');
const august = new Date('2026-08-30T00:00:00Z');

const product = (sku: string, more: Omit<ProductRow, 'sku'>): ProductRow => ({ sku, ...more });

export const p1 = product('p1', {
  name: 'Anvil',
  price: '10.00',
  stock: 3,
  active: true,
  featured: true,
  shelf: 'A',
  restockedAt: october,
});

export const p2 = product('p2', {
  name: 'apple',
  price: '9.5',
  stock: 0,
  active: false,
  featured: null,
  shelf: null,
  restockedAt: null,
});

export const p3 = product('p3', {
  name: 'Bolt',
  price: '-2.25',
  stock: 12,
  active: true,
  featured: false,
  shelf: 'B',
  restockedAt: september,
});

export const p4 = product('p4', {
  name: 'bolt cutter',
  price: '0.0',
  stock: 7,
  active: false,
  featured: true,
  shelf: null,
  restockedAt: october,
});

export const p5 = product('p5', {
  name: 'Café',
  price: '-0',
  stock: 3,
  active: true,
  featured: null,
  shelf: 'A',
  restockedAt: null,
});

export const p6 = product('p6', {
  name: 'Ant',
  price: '100',
  stock: 1,
  active: true,
  featured: false,
  shelf: 'C',
  restockedAt: august,
});

export const p7 = product('p7', {
  name: 'An',
  price: '-10.5',
  stock: 5,
  active: false,
  featured: null,
  shelf: 'B',
  restockedAt: september,
});

export const catalogue: readonly ProductRow[] = [p1, p2, p3, p4, p5, p6, p7];
