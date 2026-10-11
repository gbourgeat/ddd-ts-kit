const BILLING = 'src/contexts/billing';
const CATALOG = 'src/contexts/catalog';

export interface BoundaryCase {
  /** The architecture id that has to answer, or `none` for an import both spellings may write. */
  readonly rule: string;
  readonly what: string;
  /** Where the import is written, from the project root. */
  readonly file: string;
  readonly relative: string;
  readonly alias: string;
}

/**
 * One forbidden import per boundary rule, written twice: by a relative path and by the alias,
 * and replayed in each spelling of `SPELLINGS`.
 * The same table is replayed against the CLI checker (packages/cli/test/alias-boundaries.spec.ts).
 */
export const BOUNDARY_CASES: readonly BoundaryCase[] = [
  {
    rule: 'layer/domain-purity',
    what: 'the domain reaches the infrastructure of its context',
    file: `${BILLING}/domain/aggregates/invoice.aggregate.ts`,
    relative: '../../infrastructure/persistence/billing.schema.js',
    alias: '@/contexts/billing/infrastructure/persistence/billing.schema.js',
  },
  {
    rule: 'layer/domain-purity',
    what: 'the domain reaches the platform',
    file: `${BILLING}/domain/aggregates/invoice.aggregate.ts`,
    relative: '../../../../platform/config/app-config.js',
    alias: '@/platform/config/app-config.js',
  },
  {
    rule: 'layer/application-inward',
    what: 'a use case reaches an adapter',
    file: `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`,
    relative: '../../../infrastructure/persistence/drizzle-invoice.repository.js',
    alias: '@/contexts/billing/infrastructure/persistence/drizzle-invoice.repository.js',
  },
  {
    rule: 'layer/presentation-no-infrastructure',
    what: 'a route reaches an adapter',
    file: `${BILLING}/presentation/http/issue-invoice.route.ts`,
    relative: '../../infrastructure/persistence/drizzle-invoice.repository.js',
    alias: '@/contexts/billing/infrastructure/persistence/drizzle-invoice.repository.js',
  },
  {
    rule: 'layer/infrastructure-no-presentation',
    what: 'an adapter reaches a DTO',
    file: `${BILLING}/infrastructure/persistence/drizzle-invoice.repository.ts`,
    relative: '../../presentation/http/invoice.dto.js',
    alias: '@/contexts/billing/presentation/http/invoice.dto.js',
  },
  {
    rule: 'context/published-language-only',
    what: 'a context reaches the domain of another one',
    file: `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`,
    relative: '../../../../catalog/domain/aggregates/product.aggregate.js',
    alias: '@/contexts/catalog/domain/aggregates/product.aggregate.js',
  },
  {
    rule: 'context/declared-relationship',
    what: 'a context reads the published language of one it does not declare as upstream',
    file: `${CATALOG}/application/queries/search-products/search-products.handler.ts`,
    relative: '../../../../billing/published-language/index.js',
    alias: '@/contexts/billing/published-language/index.js',
  },
  {
    rule: 'context/published-language-is-a-contract',
    what: 'a published language reaches the domain behind it',
    file: `${BILLING}/published-language/invoice-issued.v1.integration-event.ts`,
    relative: '../domain/aggregates/invoice.aggregate.js',
    alias: '@/contexts/billing/domain/aggregates/invoice.aggregate.js',
  },
  {
    rule: 'none',
    what: 'the domain reads the shared kernel',
    file: `${BILLING}/domain/aggregates/invoice.aggregate.ts`,
    relative: '../../../../shared-kernel/money.vo.js',
    alias: '@/shared-kernel/money.vo.js',
  },
  {
    rule: 'none',
    what: 'a use case reads its own domain',
    file: `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`,
    relative: '../../../domain/aggregates/invoice.aggregate.js',
    alias: '@/contexts/billing/domain/aggregates/invoice.aggregate.js',
  },
  {
    rule: 'none',
    what: 'a use case reads the published language of a declared upstream',
    file: `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`,
    relative: '../../../../catalog/published-language/index.js',
    alias: '@/contexts/catalog/published-language/index.js',
  },
];

/** How a project writes an import, and the same specifier in that spelling: the table above is written with `.js`. */
export const SPELLINGS: readonly (readonly [string, (specifier: string) => string])[] = [
  ['js', (specifier) => specifier],
  ['none', (specifier) => specifier.replace(/\.js$/, '')],
];
