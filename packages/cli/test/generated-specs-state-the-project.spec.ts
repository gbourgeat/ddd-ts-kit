import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, tempDir } from './helpers';

const BILLING = 'src/contexts/billing/test';

let root: string;

beforeAll(() => {
  root = tempDir('specs-state-the-project');

  const run = (...args: string[]): void => {
    expect(cli(root, ...args).code).toBe(0);
  };

  run('init');
  run('generate', 'context', 'billing', '--classification', 'core');
  run('generate', 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=A request for payment');
  run('generate', 'port', 'billing', 'TaxCalculator');
  run('generate', 'adapter', 'billing', 'TaxCalculator');
  run('generate', 'acl', 'billing', 'Carrier');
  run('generate', 'domain-service', 'billing', 'InvoiceNumbering', '--term', 'Numbering=Giving an invoice its number');
  run('generate', 'guard', 'billing', 'NotBanned');
  run('generate', 'port', 'billing', 'ExchangeRates');
  run('generate', 'adapter', 'billing', 'ExchangeRates', '--kind', 'simulated');

  run(
    'generate',
    'query',
    'billing',
    'SearchInvoices',
    '--permission',
    'invoice.search',
    '--search',
    '--term',
    'Search=To find',
  );
});

describe('A spec the kit generates, what it asserts', () => {
  it.each([
    ['integration/remote-tax-calculator.adapter.spec.ts'],
    ['integration/carrier.translator.spec.ts'],
    ['unit/invoice-numbering.service.spec.ts'],
    ['unit/invoice.aggregate.spec.ts'],
    ['unit/not-banned.guard.spec.ts'],
  ])('asserts nothing the language or the kit already holds, in %s', (file) => {
    expect(read(root, `${BILLING}/${file}`)).not.toMatch(
      /toBeInstanceOf\(Remote|toBeDefined\(\)|\)\)\.not\.toThrow\(\)|anonymousActor|\.thenEvents\(\[\]\)/,
    );
  });

  it('holds the remote adapter to what it does as long as its transport is not written, and no more', () => {
    const spec = read(root, `${BILLING}/integration/remote-tax-calculator.adapter.spec.ts`);

    expect(spec).toContain("await expect(adapter.sendUnwired('ping')).rejects.toThrow('\"ping\" was not sent');");
    expect(spec).not.toContain('built without argument');
  });

  it('holds the translator to the empty record it answers until its mapping is written', () => {
    const spec = read(root, `${BILLING}/integration/carrier.translator.spec.ts`);

    expect(spec).toContain("it('answers an empty record of billing as long as its mapping is not written', () => {");
    expect(spec).toContain('expect(new CarrierTranslator().translate({})).toEqual({});');
  });

  it('holds the domain service to taking nothing when it is built, a port or a store being no part of it', () => {
    expect(read(root, `${BILLING}/unit/invoice-numbering.service.spec.ts`)).toContain(
      'expect(InvoiceNumberingService).toHaveLength(0);',
    );
  });

  it('leaves the first business intention of the aggregate planned, not asserted on its state', () => {
    const spec = read(root, `${BILLING}/unit/invoice.aggregate.spec.ts`);

    expect(spec).not.toContain("import { given } from '@ddd-ts-kit/testing';");
    expect(spec).toContain("it.todo('changes state and records a fact for each business intention');");
  });
});

describe('A spec the kit generates, its title', () => {
  it.each([
    ['unit/not-banned.guard.spec.ts', 'Who may pass the not banned guard'],
    ['integration/remote-tax-calculator.adapter.spec.ts', 'The remote tax calculator'],
    ['integration/simulated-exchange-rates.adapter.spec.ts', 'The simulated exchange rates'],
    ['integration/in-memory-search-invoices-reader.repository.spec.ts', 'The reader of search invoices'],
  ])('names what %s holds in words, never by its class', (file, title) => {
    expect(read(root, `${BILLING}/${file}`)).toContain(`describe('${title}'`);
  });
});
