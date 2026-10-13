import { aggregate } from './aggregate.js';
import type { Fixture } from './fixture.js';
import { PATHS } from './paths.js';
import { project } from './project.js';
import { SAMPLES } from './samples.js';

const { AGGREGATE, BILLING } = PATHS;

const MACHINE = `${BILLING}/domain/state-machines/invoice.state-machine.ts`;
const MACHINE_SPEC = `${BILLING}/test/unit/invoice.state-machine.spec.ts`;

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
    name: 'an aggregate whose state machine exists and is not imported',
    expect: { file: AGGREGATE },
    files: project({
      ...MACHINE_FILES,
      ...aggregate(invoice("  issue(): void {\n    this.state = { ...this.state, status: 'issued' };\n  }", '')),
    }),
  },
];
