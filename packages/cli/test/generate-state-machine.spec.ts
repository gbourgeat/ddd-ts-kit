import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, write } from './helpers';
import { failure, report } from './reports';
import { jobProject } from './support/job-project';

const BILLING = 'src/contexts/billing';
const MACHINE = `${BILLING}/domain/state-machines/invoice.state-machine.ts`;
const SPEC = `${BILLING}/test/unit/invoice.state-machine.spec.ts`;
const STATUS = `${BILLING}/domain/vocabularies/invoice-status.vocabulary.ts`;

const LIFECYCLE = [
  'generate',
  'state-machine',
  'billing',
  'Invoice',
  '--value',
  'draft',
  '--value',
  'issued',
  '--value',
  'cancelled',
  '--transition',
  'issue:draft>issued',
  '--transition',
  'cancel:draft,issued>cancelled',
  '--transition',
  'annotate:draft,issued',
];

describe('generate state-machine', () => {
  let root: string;
  let generated: ReturnType<typeof report>;

  beforeAll(() => {
    root = jobProject();
    expect(cli(root, 'generate', 'aggregate', 'billing', 'Invoice').code).toBe(0);
    generated = report(cli(root, ...LIFECYCLE, '--json'));
  });

  it('writes the status as a closed vocabulary, the machine and its spec', () => {
    expect(generated.created).toEqual([STATUS, MACHINE, SPEC]);

    expect(read(root, STATUS)).toContain(
      "export const InvoiceStatus = {\n  Draft: 'draft',\n  Issued: 'issued',\n  Cancelled: 'cancelled',\n} as const;",
    );
  });

  it('declares the transitions asked, the first state initial, from the members of the vocabulary', () => {
    const machine = read(root, MACHINE);

    expect(machine).toContain('export const invoiceLifecycle = defineStateMachine({');
    expect(machine).toContain('  states: Object.values(InvoiceStatus),\n  initial: [InvoiceStatus.Draft],');
    expect(machine).toContain('    issue: { from: [InvoiceStatus.Draft], to: InvoiceStatus.Issued },');

    expect(machine).toContain(
      '    cancel: { from: [InvoiceStatus.Draft, InvoiceStatus.Issued], to: InvoiceStatus.Cancelled },',
    );

    expect(machine).toContain('    annotate: { from: [InvoiceStatus.Draft, InvoiceStatus.Issued] },');
  });

  it('tests each transition where it leads, and its refusal from a state it does not leave', () => {
    const spec = read(root, SPEC);

    expect(spec).toContain("expect(invoiceLifecycle.next(InvoiceStatus.Draft, 'issue')).toBe(InvoiceStatus.Issued);");

    expect(spec).toContain(
      "expect(() => invoiceLifecycle.next(InvoiceStatus.Issued, 'issue')).toThrow('is not allowed from the state');",
    );

    expect(spec).toContain("expect(invoiceLifecycle.next(InvoiceStatus.Draft, 'annotate')).toBe(InvoiceStatus.Draft);");
  });

  it('draws the machine in CONTEXT.md', () => {
    expect(read(root, `${BILLING}/CONTEXT.md`)).toContain('  draft --> issued: issue');
  });

  it('extends a status that exists with the states it misses', () => {
    const other = jobProject();

    expect(cli(other, 'generate', 'aggregate', 'billing', 'Invoice').code).toBe(0);
    write(other, STATUS, "export const InvoiceStatus = {\n  Draft: 'draft',\n} as const;\n");
    expect(cli(other, 'generate', 'state-machine', 'billing', 'Invoice', '--value', 'paid').code).toBe(0);
    expect(read(other, STATUS)).toContain("  Draft: 'draft',\n  Paid: 'paid',\n} as const;");
    expect(read(other, MACHINE)).toContain('// TODO(domain): one transition per intention method of Invoice');
  });
});

describe('generate state-machine, refused', () => {
  let root: string;

  beforeAll(() => {
    root = jobProject();
  });

  it('without its aggregate', () => {
    expect(failure(cli(root, ...LIFECYCLE, '--json')).message).toContain('The aggregate Invoice does not exist');
  });

  it('with fewer than two states, or a transition through a state the status does not list', () => {
    expect(cli(root, 'generate', 'aggregate', 'billing', 'Invoice').code).toBe(0);

    expect(
      failure(cli(root, 'generate', 'state-machine', 'billing', 'Invoice', '--value', 'draft', '--json')).message,
    ).toBe('InvoiceStatus does not exist, and a lifecycle needs two states at least.');

    const unknown = ['--value', 'draft', '--value', 'issued', '--transition', 'pay:issued>paid', '--json'];

    expect(failure(cli(root, 'generate', 'state-machine', 'billing', 'Invoice', ...unknown)).message).toBe(
      'The transition pay names "paid", which the status does not list.',
    );

    const twice = ['--value', 'draft', '--value', 'issued', '--transition', 'issue:draft>issued'];

    expect(
      failure(cli(root, 'generate', 'state-machine', 'billing', 'Invoice', ...twice, ...twice.slice(-2), '--json'))
        .message,
    ).toBe('The transition issue is given twice.');

    expect(
      failure(
        cli(
          root,
          'generate',
          'state-machine',
          'billing',
          'Invoice',
          ...twice.slice(0, 4),
          '--transition',
          'nothing',
          '--json',
        ),
      ).message,
    ).toBe('"nothing" is not a transition.');
  });
});
