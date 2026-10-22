import { beforeAll, describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers';

const BILLING = 'src/contexts/billing';
const DOC = `${BILLING}/CONTEXT.md`;

const VOCABULARY = `export const InvoiceStatus = {
  Draft: 'draft',
  Issued: 'issued',
  'Written off': 'written-off',
} as const;
`;

const MACHINE = `import { defineStateMachine } from '@ddd-ts-kit/kernel';
import { InvoiceStatus } from '@/contexts/billing/domain/vocabularies/invoice-status.vocabulary';

export const invoiceLifecycle = defineStateMachine({
  states: Object.values(InvoiceStatus),
  initial: [InvoiceStatus.Draft],
  transitions: {
    issue: { from: [InvoiceStatus.Draft], to: InvoiceStatus.Issued, guard: (paid: boolean) => undefined },
    'write-off': { from: [InvoiceStatus.Issued], to: InvoiceStatus['Written off'] },
    annotate: { from: ['draft', 'issued'] },
  },
  refused: () => new Error('refused'),
});
`;

const LISTED = `import { defineStateMachine } from '@ddd-ts-kit/kernel';

export const paymentLifecycle = defineStateMachine({
  states: ['due', 'paid'],
  initial: ['due'],
  transitions: { settle: { from: ['due'], to: 'paid' } },
  refused: () => new Error('refused'),
});
`;

const PROCESS = `export class DunningProcess {
  static readonly processName = 'billing.dunning';

  static readonly timeoutJob: string | undefined = 'billing.dunning-timeout';
}
`;

const JOB = `export class CompileStatementsBackgroundJob {
  static readonly jobName = 'billing.compile-statements';
}
`;

describe('state machines and background jobs in the documentation', () => {
  let root: string;

  beforeAll(() => {
    root = tempDir('lifecycle');
    expect(cli(root, 'init', '--context', 'billing:core').code).toBe(0);
    write(root, `${BILLING}/domain/vocabularies/invoice-status.vocabulary.ts`, VOCABULARY);
    write(root, `${BILLING}/domain/state-machines/invoice.state-machine.ts`, MACHINE);
    write(root, `${BILLING}/domain/state-machines/payment.state-machine.ts`, LISTED);
    write(root, `${BILLING}/domain/state-machines/notes.md`, 'Not a machine.\n');
    write(root, `${BILLING}/domain/state-machines/broken.state-machine.ts`, 'export const nothing = 1;\n');
    write(root, `${BILLING}/application/background/compile-statements.background-job.ts`, JOB);
    write(root, `${BILLING}/application/processes/dunning.process.ts`, PROCESS);
    write(root, `${BILLING}/application/processes/collection.process.ts`, 'export class CollectionProcess {}\n');

    write(
      root,
      `${BILLING}/application/background/send-statements.background-job.ts`,
      'export class SendStatementsBackgroundJob {}\n',
    );

    expect(cli(root, 'docs').code).toBe(0);
  });

  it('draws each state machine in CONTEXT.md, states read from the vocabulary of the context', () => {
    const doc = read(root, DOC);

    expect(doc).toContain(
      [
        '```mermaid',
        'stateDiagram-v2',
        '  state "written-off" as written_off',
        '  [*] --> draft',
        '  draft --> issued: issue [guarded]',
        '  issued --> written_off: write-off',
        '  draft --> draft: annotate',
        '  issued --> issued: annotate',
        '  written_off --> [*]',
        '```',
      ].join('\n'),
    );

    expect(doc).toContain('  due --> paid: settle\n  paid --> [*]');
    expect(cli(root, 'docs', '--check').code).toBe(0);
  });

  it('lists the background jobs by their name, or by their class when it is not written', () => {
    expect(read(root, DOC)).toContain(
      '| Job | Class |\n|---|---|\n| `billing.compile-statements` | `CompileStatementsBackgroundJob` |\n| `SendStatementsBackgroundJob` | `SendStatementsBackgroundJob` |',
    );
  });

  it('lists the process managers and the job that delivers their timeouts', () => {
    expect(read(root, DOC)).toContain(
      '| Process | Class | Timeouts delivered by |\n|---|---|---|\n| `CollectionProcess` | `CollectionProcess` | none |\n| `billing.dunning` | `DunningProcess` | `billing.dunning-timeout` |',
    );

    expect(cli(root, 'describe', 'billing').stdout).toContain(
      '  process managers:\n    CollectionProcess (CollectionProcess)',
    );
  });

  it('describes both', () => {
    const described = cli(root, 'describe', 'billing').stdout;

    expect(described).toContain('  background jobs:\n    billing.compile-statements (CompileStatementsBackgroundJob)');

    expect(described).toContain(
      '  state machines:\n    invoice (draft, issued, written-off; issue, write-off, annotate)',
    );
  });

  it('says that a context has none, and keeps a document written before the sections existed', () => {
    const bare = tempDir('lifecycle');

    cli(bare, 'init', '--context', 'billing:core');

    expect(read(bare, DOC)).toContain('No state machine.');
    expect(read(bare, DOC)).toContain('No background job.');
    expect(read(bare, DOC)).toContain('No process manager.');

    write(bare, DOC, read(bare, DOC).replace(/## Background jobs[\s\S]*?(?=## Relationships)/, ''));
    write(bare, `${BILLING}/domain/state-machines/payment.state-machine.ts`, LISTED);

    const result = cli(bare, 'docs', '--json').json() as { notes: string[] };

    expect(result.notes).toEqual([
      `${DOC} has no "ddd-ts-kit:state-machines" region: its generated list is not kept up to date.`,
    ]);
  });
});
