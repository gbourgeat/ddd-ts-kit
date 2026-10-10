import { contextDoc } from './context-doc.js';
import { DECLARED } from './declared.js';
import { declaredProject } from './declared-project.js';
import type { Fixture } from './fixture.js';
import { PATHS } from './paths.js';
import { SAMPLES } from './samples.js';
import { source } from './source.js';

const { ADAPTER, BILLING, PORT, REPOSITORY_PORT } = PATHS;

const RULE = 'naming/search-not-list';
const QUERIES = `${BILLING}/application/queries`;
const READER = `${BILLING}/application/ports/invoice-reader.port.ts`;
const FAKE = `${BILLING}/test/fakes/invoice-reader.fake.ts`;
const AUTHORIZER = `${BILLING}/infrastructure/external/billing-authorizer.adapter.ts`;

const GLOSSARY = { [`${BILLING}/CONTEXT.md`]: contextDoc('core', undefined, glossaryWith('Search', 'List')) };

const SEARCHING = source(
  'export abstract class InvoiceReader {',
  '  abstract search(scope: AccessScope, page: PageRequest<InvoiceSort>): Promise<Page<InvoiceLine>>;',
  '',
  '  abstract searchByCustomer(customerId: string): Promise<readonly InvoiceLine[]>;',
  '',
  '  abstract findById(id: string): Promise<InvoiceLine | undefined>;',
  '}',
);

const LISTING = SEARCHING.replace('abstract search(', 'abstract list(');

const FAKED = source(
  "import { InvoiceReader } from '#src/contexts/billing/application/ports/invoice-reader.port.js';",
  '',
  'export class FakeInvoiceReader implements InvoiceReader {',
  '  readonly listings: string[] = [];',
  '',
  '  async search(): Promise<Page<InvoiceLine>> {',
  '    return { items: [] };',
  '  }',
  '}',
);

const AUTHORIZING = source(
  `import { Adapter } from '@ddd-ts-kit/kernel/declarations';`,
  "import { Authorizer } from '@ddd-ts-kit/kernel';",
  '',
  "@Adapter(Authorizer, { kind: 'external' })",
  'export class BillingAuthorizer implements Authorizer {',
  '  async listAccessible(): Promise<AccessScope> {',
  "    return { kind: 'all' };",
  '  }',
  '}',
);

export const NAMING_FIXTURES: readonly Fixture[] = [
  {
    ruleId: RULE,
    name: 'a port, a fake and a query that search, a property named after its listings, the listAccessible of the kit',
    expect: 'pass',
    files: declaredProject({
      ...GLOSSARY,
      [READER]: SEARCHING,
      [FAKE]: FAKED,
      [AUTHORIZER]: AUTHORIZING,
      ...query('search-invoices', 'SearchInvoices'),
    }),
  },
  {
    ruleId: RULE,
    name: 'a read port with a method named list',
    expect: { file: READER },
    files: declaredProject({ [READER]: LISTING }),
  },
  {
    ruleId: RULE,
    name: 'a repository port with a method named listByCustomer',
    expect: { file: REPOSITORY_PORT },
    files: declaredProject({
      [REPOSITORY_PORT]: DECLARED.repositoryPort.replace(
        '{}',
        '{\n  abstract listByCustomer(customerId: string): Promise<readonly Invoice[]>;\n}',
      ),
    }),
  },
  {
    ruleId: RULE,
    name: 'an adapter with a method named list',
    expect: { file: ADAPTER },
    files: declaredProject({
      [REPOSITORY_PORT]: DECLARED.repositoryPort,
      [ADAPTER]: DECLARED.repository.replace(
        '{}',
        '{\n  async list(): Promise<readonly Invoice[]> {\n    return [];\n  }\n}',
      ),
    }),
  },
  {
    ruleId: RULE,
    name: 'a fake with a method named listAll',
    expect: { file: FAKE },
    files: declaredProject({ [READER]: SEARCHING, [FAKE]: FAKED.replace('async search(', 'async listAll(') }),
  },
  {
    ruleId: RULE,
    name: 'a query named ListInvoices in a folder named list-invoices',
    expect: { file: `${QUERIES}/list-invoices/list-invoices.query.ts` },
    files: declaredProject({ ...GLOSSARY, ...query('list-invoices', 'ListInvoices') }),
  },
  {
    ruleId: RULE,
    name: 'a port outside a context is not judged, nor a payment gateway that lists nothing',
    expect: 'pass',
    files: declaredProject({ [PORT]: DECLARED.port, 'src/platform/audit/invoice-reader.ts': LISTING }),
  },
];

function glossaryWith(...terms: string[]): string {
  return [SAMPLES.GLOSSARY, ...terms.map((term) => `| ${term} | To read invoices page by page. |`)].join('\n');
}

function query(folder: string, name: string): Record<string, string> {
  return {
    [`${QUERIES}/${folder}/${folder}.query.ts`]: DECLARED.query.replace('InvoicesIssued', name),
    [`${QUERIES}/${folder}/${folder}.handler.ts`]: DECLARED.queryHandler.replaceAll('InvoicesIssued', name),
    [`${BILLING}/test/unit/${folder}.handler.spec.ts`]: SAMPLES.SPEC,
  };
}
