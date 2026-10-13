import type { Fixture } from './fixture.js';
import type { FixtureFiles } from './fixture-files.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { source } from './source.js';

const { BILLING } = PATHS;

const PROJECTION_RULE = 'event-sourcing/projection-never-appends';
const STORE = 'event-sourcing/store-behind-repository';
const KERNEL = "'@ddd-ts-kit/kernel'";
const PROJECTION = `${BILLING}/application/projections/invoice-list.projection.ts`;

const LIST_PORT = "import { InvoiceList } from '@/contexts/billing/application/ports/invoice-list.port.js';";

const INVOICE_REPOSITORY =
  "import { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository.js';";

export const EVENT_SOURCING_PROJECTION_FIXTURES: readonly Fixture[] = [
  {
    ruleId: PROJECTION_RULE,
    name: 'a projection writing its read model only',
    expect: 'pass',
    files: project(projection([LIST_PORT], ['private readonly invoices: InvoiceList'])),
  },
  {
    ruleId: PROJECTION_RULE,
    name: 'a projection given the event store',
    expect: { file: PROJECTION },
    also: [STORE],
    files: project(
      projection(
        [LIST_PORT, `import { EventStore } from ${KERNEL};`],
        ['private readonly invoices: InvoiceList', 'private readonly store: EventStore'],
      ),
    ),
  },
  {
    ruleId: PROJECTION_RULE,
    name: 'a projection fed by the dispatcher that names a repository, as before event sourcing',
    expect: 'pass',
    files: project(projection([INVOICE_REPOSITORY], ['private readonly invoices: InvoiceRepository'])),
  },
  {
    ruleId: PROJECTION_RULE,
    name: 'a projection fed by the event store given a repository',
    expect: { file: PROJECTION },
    files: project(
      projection([INVOICE_REPOSITORY], ['private readonly invoices: InvoiceRepository'], "{ feed: 'event-store' }"),
    ),
  },
];

/** A projection under `application/projections/`; declared with `@Projection` and these options when some are given. */
function projection(imports: readonly string[], parameters: readonly string[], options?: string): FixtureFiles {
  const decorator = options === undefined ? [] : [`@Projection('billing.invoice-list', ${options})`];
  const imported = options === undefined ? [] : ["import { Projection } from '@ddd-ts-kit/kernel/declarations';"];

  return {
    [PROJECTION]: source(
      ...imports,
      ...imported,
      '',
      ...decorator,
      'export class InvoiceListProjection {',
      `  constructor(${parameters.join(', ')}) {}`,
      '}',
    ),
    [`${BILLING}/test/unit/invoice-list.projection.spec.ts`]: source(
      "import { it } from 'vitest';",
      '',
      "it.todo('lists');",
    ),
    [`${BILLING}/application/ports/invoice-list.port.ts`]: 'export abstract class InvoiceList {}\n',
  };
}
