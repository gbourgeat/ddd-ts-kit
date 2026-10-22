import { aggregate } from './aggregate';
import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';
import { SAMPLES } from './samples';

const { AGGREGATE, BILLING } = PATHS;

const MACHINE = `${BILLING}/domain/state-machines/invoice.state-machine.ts`;
const MACHINE_SPEC = `${BILLING}/test/unit/invoice.state-machine.spec.ts`;
const PROCESS = `${BILLING}/application/processes/dunning.process.ts`;
const PROCESS_SPEC = `${BILLING}/test/unit/dunning.process.spec.ts`;

const MACHINE_FILES = {
  [MACHINE]:
    "import { defineStateMachine } from '@ddd-ts-kit/kernel';\n\nexport const invoiceLifecycle = defineStateMachine({\n  states: ['draft', 'issued'],\n  initial: ['draft'],\n  transitions: { issue: { from: ['draft'], to: 'issued' } },\n  refused: () => new Error('refused'),\n});\n",
  [MACHINE_SPEC]: SAMPLES.SPEC,
};

const IMPORT =
  "import { invoiceLifecycle } from '@/contexts/billing/domain/state-machines/invoice.state-machine.js';\n";

const invoice = (body: string, imports = IMPORT): string =>
  `${imports}\nexport class Invoice {\n  private state = { total: 0, status: 'draft' };\n\n${body}\n}\n`;

export const LIFECYCLE_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'lifecycle/status-through-machine',
    name: 'an aggregate that asks its state machine for its status, or copies one it read',
    expect: 'pass',
    files: project({
      ...MACHINE_FILES,
      ...aggregate(
        invoice(
          "  issue(): void {\n    this.state = { ...this.state, status: invoiceLifecycle.next(this.state.status, 'issue') };\n  }\n\n  restore(state: { total: number; status: string }): void {\n    this.state = { total: state.total, status: state.status };\n  }",
        ),
      ),
    }),
  },
  {
    ruleId: 'lifecycle/status-through-machine',
    name: 'an aggregate that writes its status by hand next to its state machine',
    expect: { file: AGGREGATE },
    files: project({
      ...MACHINE_FILES,
      ...aggregate(invoice("  issue(): void {\n    this.state = { ...this.state, status: 'issued' };\n  }")),
    }),
  },
  {
    ruleId: 'lifecycle/status-through-machine',
    name: 'an aggregate that names the status its machine answers, then writes it as a shorthand',
    expect: 'pass',
    files: project({
      ...MACHINE_FILES,
      ...aggregate(
        invoice(
          "  issue(): void {\n    const status = invoiceLifecycle.next(this.state.status, 'issue');\n\n    this.state = { ...this.state, status };\n  }\n\n  isIssued(): boolean {\n    const { status } = this.state;\n\n    return status === 'issued';\n  }",
        ),
      ),
    }),
  },
  {
    ruleId: 'lifecycle/status-through-machine',
    name: 'an aggregate that names a status by hand, then writes it as a shorthand',
    expect: { file: AGGREGATE },
    files: project({
      ...MACHINE_FILES,
      ...aggregate(
        invoice("  issue(): void {\n    const status = 'issued';\n\n    this.state = { ...this.state, status };\n  }"),
      ),
    }),
  },
  {
    ruleId: 'lifecycle/status-through-machine',
    name: 'an aggregate whose state machine exists and is not imported',
    expect: { file: AGGREGATE },
    files: project({
      ...MACHINE_FILES,
      ...aggregate(invoice("  issue(): void {\n    this.state = { ...this.state, status: 'issued' };\n  }", '')),
    }),
  },
  {
    ruleId: 'lifecycle/status-through-machine',
    name: 'an aggregate that writes no status yet next to its new state machine',
    expect: 'pass',
    files: project({
      ...MACHINE_FILES,
      ...aggregate(invoice('  total(): number {\n    return this.state.total;\n  }', '')),
    }),
  },
  {
    ruleId: 'process/sends-commands-only',
    name: 'a process that decides commands from its state',
    expect: 'pass',
    files: project({
      [PROCESS]:
        "import type { IssueInvoiceCommand } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command.js';\n\nexport class DunningProcess {\n  readonly sends: IssueInvoiceCommand[] = [];\n}\n",
      [PROCESS_SPEC]: SAMPLES.SPEC,
    }),
  },
  {
    ruleId: 'process/sends-commands-only',
    name: 'a process that saves an aggregate itself',
    expect: { file: PROCESS },
    files: project({
      [PROCESS]:
        "import type { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository.js';\n\nexport class DunningProcess {\n  readonly invoices: InvoiceRepository[] = [];\n}\n",
      [PROCESS_SPEC]: SAMPLES.SPEC,
    }),
  },
];
