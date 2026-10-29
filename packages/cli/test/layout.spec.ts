import { describe, expect, it } from 'vitest';
import { fitSource, fitStatement } from '../src/layout';
import { insertInRegion } from '../src/markers';

const LONG = 'InternationalPurchaseOrder';

describe('a statement laid out for the names of the project', () => {
  it('stays on its line when it fits', () => {
    const statement = "builder.bind(TaxRates).toClass(RemoteTaxRates).as('external').with(ownPolicy());";

    expect(fitStatement(statement, '    ')).toEqual([`    ${statement}`]);
  });

  it('breaks a call chain link by link once it no longer fits', () => {
    const statement = `builder.bind(${LONG}Repository).toClass(Drizzle${LONG}Repository, [Database, Clock]).as('repository');`;

    expect(fitStatement(statement, '    ')).toEqual([
      '    builder',
      `      .bind(${LONG}Repository)`,
      `      .toClass(Drizzle${LONG}Repository, [Database, Clock])`,
      "      .as('repository');",
    ]);
  });

  it('breaks a chain of three calls that passes a function, even when it fits', () => {
    const statement =
      "builder.command(Pay).requires(permissions['pay'], { resource: () => ({ id: 'a' }) }).handledBy(Handler);";

    expect(fitStatement(statement, '').slice(0, 2)).toEqual(['builder', '  .command(Pay)']);
  });

  it('opens only the object a call receives last when what precedes it fits', () => {
    const statement = `const reader = platform.adapter(new InMemorySearch${LONG}sReader(), { kind: 'repository', context: 'order-fulfilment' });`;

    expect(fitStatement(statement, '  ')).toEqual([
      `  const reader = platform.adapter(new InMemorySearch${LONG}sReader(), {`,
      "    kind: 'repository',",
      "    context: 'order-fulfilment',",
      '  });',
    ]);
  });

  it('gives each argument a line when the line does not fit up to the last one', () => {
    const created = `new Place${LONG}Handler(${LONG}Repository, platform.ids, platform.clock)`;
    const statement = `platform.commands.register(Place${LONG}Command, ${created}, { context: 'order-fulfilment' });`;

    expect(fitStatement(statement, '  ')).toEqual([
      '  platform.commands.register(',
      `    Place${LONG}Command,`,
      `    ${created},`,
      "    { context: 'order-fulfilment' },",
      '  );',
    ]);
  });
});

describe('a rendered source file', () => {
  it('gives each name of an import, each clause of a class and each parameter a line once they no longer fit', () => {
    const source = [
      `import type { List${LONG}sResult, List${LONG}sSort } from '../queries/list-${LONG}s/list-${LONG}s.result.js';`,
      `export class Fake${LONG}Repository extends InMemoryRepository<${LONG}> implements ${LONG}Repository {`,
      `  abstract search(scope: AccessScope, page: PageRequest<List${LONG}sSort>): Promise<List${LONG}sResult>;`,
      '}',
    ].join('\n');

    expect(fitSource(source).split('\n')).toEqual([
      'import type {',
      `  List${LONG}sResult,`,
      `  List${LONG}sSort,`,
      `} from '../queries/list-${LONG}s/list-${LONG}s.result.js';`,
      `export class Fake${LONG}Repository`,
      `  extends InMemoryRepository<${LONG}>`,
      `  implements ${LONG}Repository`,
      '{',
      '  abstract search(',
      '    scope: AccessScope,',
      `    page: PageRequest<List${LONG}sSort>,`,
      `  ): Promise<List${LONG}sResult>;`,
      '}',
    ]);
  });

  it('keeps a constructor that receives one dependency on its line, and gives it its own once it no longer fits', () => {
    const short = '  constructor(private readonly invoiceRepository: InvoiceRepository) {}';
    const long = `  constructor(private readonly internationalPurchaseOrderAwaitingApprovalRepository: ${LONG}AwaitingApprovalRepository) {}`;

    expect(fitSource(short)).toBe(short);

    expect(fitSource(long).split('\n')).toEqual([
      '  constructor(',
      `    private readonly internationalPurchaseOrderAwaitingApprovalRepository: ${LONG}AwaitingApprovalRepository,`,
      '  ) {}',
    ]);
  });

  it('sets a statement it broke apart from its neighbours, and leaves comments and short lines alone', () => {
    const call = `await this.access.scope(query.actor, ${LONG}Permissions['international-purchase-order.search'], 'international-purchase-order');`;
    const comment = `  // ${'a long comment '.repeat(10)}`;
    const source = ['  const one = 1;', comment, `  ${call}`, '  return one;'].join('\n');

    expect(fitSource(source).split('\n')).toEqual([
      '  const one = 1;',
      '',
      comment,
      '  await this.access.scope(',
      '    query.actor,',
      `    ${LONG}Permissions['international-purchase-order.search'],`,
      "    'international-purchase-order',",
      '  );',
      '',
      '  return one;',
    ]);
  });
});

describe('the imports of a region', () => {
  const region = (inside: string): string => `// ddd-ts-kit:imports\n${inside}// /ddd-ts-kit:imports\n`;

  it('take one name per line once the statement no longer fits, and merge into it afterwards', () => {
    const names = ['Clock', 'ExecutionScope', 'IdGenerator', 'DomainEventDispatcher', 'IntegrationEventPublisher'];
    const first = `import { ${names.join(', ')} } from '@ddd-ts-kit/kernel';`;
    const once = insertInRegion(region(`${first}\n`), 'imports', "import { CommandBus } from '@ddd-ts-kit/kernel';");
    const twice = insertInRegion(once ?? '', 'imports', "import { Cache } from '@ddd-ts-kit/kernel';");
    const broken = [...names, 'CommandBus'].map((name) => `  ${name},\n`).join('');

    expect(once).toBe(region(`import {\n${broken}} from '@ddd-ts-kit/kernel';\n`));
    expect(twice).toBe(region(`import {\n${broken}  Cache,\n} from '@ddd-ts-kit/kernel';\n`));
  });

  it('keep a single name on its line, whatever its length', () => {
    const line = `import { ${LONG.repeat(3)}IntegrationHandler } from './application/integration/handlers/${LONG}.js';`;

    expect(insertInRegion(region(''), 'imports', line)).toBe(region(`${line}\n`));
  });
});
