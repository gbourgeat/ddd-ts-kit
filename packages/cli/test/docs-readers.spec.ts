import { describe, expect, it } from 'vitest';
import { readJobs } from '../src/docs/read-jobs';
import { readStateMachines } from '../src/docs/read-state-machines';
import { Workspace } from '../src/workspace';
import { tempDir, write } from './helpers';

const BILLING = 'src/contexts/billing';
const MACHINES = `${BILLING}/domain/state-machines`;
const JOBS = `${BILLING}/application/scheduling`;
/** Billing as the config places it, divided into no module. */
const FLAT = { directory: BILLING, modules: [] };
/** Billing divided into the module reminders. */
const WITH_REMINDERS = { directory: BILLING, modules: ['reminders'] };

function workspaceWith(files: Readonly<Record<string, string>>): Workspace {
  const root = tempDir('docs-readers');

  for (const [file, content] of Object.entries(files)) {
    write(root, file, content);
  }

  return new Workspace(root, false);
}

describe('the state machines of a context, as the documentation reads them', () => {
  it('reads the states from the transitions when the declaration does not list them', () => {
    const ws = workspaceWith({
      [`${MACHINES}/invoice.state-machine.ts`]: [
        'export const invoiceLifecycle = defineStateMachine({',
        "  initial: 'draft',",
        '  transitions: {',
        "    issue: { from: ['draft'], to: 'issued' },",
        "    remind: { from: ['issued'] },",
        "    pay: { from: ['issued', 'reminded'], to: 'paid', guard: isDue },",
        '  },',
        '});',
      ].join('\n'),
    });

    expect(readStateMachines(ws, FLAT)).toEqual([
      {
        aggregate: 'invoice',
        file: `${MACHINES}/invoice.state-machine.ts`,
        states: ['draft', 'issued', 'reminded', 'paid'],
        initial: ['draft'],
        transitions: [
          { name: 'issue', from: ['draft'], to: 'issued', guarded: false },
          { name: 'remind', from: ['issued'], guarded: false },
          { name: 'pay', from: ['issued', 'reminded'], to: 'paid', guarded: true },
        ],
      },
    ]);
  });

  it('reads states written as members of a vocabulary of the context, and keeps the key of an unknown one', () => {
    const ws = workspaceWith({
      [`${BILLING}/domain/vocabularies/invoice-status.vocabulary.ts`]:
        "export const InvoiceStatus = { Draft: 'draft', 'on-hold': 'on hold' } as const;\n",
      [`${MACHINES}/invoice.state-machine.ts`]: [
        'export const invoiceLifecycle = defineStateMachine({',
        "  states: [InvoiceStatus.Draft, InvoiceStatus['on-hold'], Unknown.Lost, 42],",
        '  initial: InvoiceStatus.Draft,',
        '  transitions: {},',
        '});',
      ].join('\n'),
    });

    expect(readStateMachines(ws, FLAT)).toMatchObject([
      { states: ['draft', 'on hold', 'Lost'], initial: ['draft'], transitions: [] },
    ]);
  });

  it('reads no state from the values of a vocabulary it does not know, nor transitions built by a call', () => {
    const ws = workspaceWith({
      [`${MACHINES}/invoice.state-machine.ts`]: [
        'export const invoiceLifecycle = defineStateMachine({',
        '  states: Object.values(InvoiceStatus),',
        "  initial: 'draft',",
        '  transitions: transitionsOf(InvoiceStatus),',
        '});',
      ].join('\n'),
      [`${MACHINES}/order.state-machine.ts`]: 'export const orderLifecycle = buildLifecycle();\n',
      [`${MACHINES}/README.md`]: 'Not a state machine.\n',
    });

    expect(readStateMachines(ws, FLAT)).toMatchObject([
      { aggregate: 'invoice', states: ['draft'], initial: ['draft'], transitions: [] },
    ]);
  });
});

describe('the jobs of a context, as the documentation reads them', () => {
  it('reads a schedule in milliseconds, and names a job registered nowhere after its class', () => {
    const ws = workspaceWith({
      [`${JOBS}/close-month.job.ts`]: [
        "@Scheduled('billing.close-month', { every: 86_400_000 })",
        'export class CloseMonthJob {',
        '  run() { return this.commands.send(new CloseMonthCommand()); }',
        '}',
      ].join('\n'),
      [`${JOBS}/remind-payers.job.ts`]: 'export class RemindPayersJob {}\n',
      [`${JOBS}/remind-payers.job.spec.ts`]: "it('reminds');\n",
    });

    expect(readJobs(ws, FLAT, 'billing')).toEqual([
      { name: 'billing.close-month', schedule: 'every 86400000ms', command: 'CloseMonth' },
      { name: 'RemindPayersJob', schedule: '', command: '' },
    ]);
  });
});

describe('a context divided into modules of its model, as the documentation reads it', () => {
  it('reads the role folders of every module it is given next to those of the context', () => {
    const ws = workspaceWith({
      [`${BILLING}/reminders/domain/state-machines/reminder.state-machine.ts`]:
        "export const reminderLifecycle = defineStateMachine({ initial: 'due', transitions: {} });\n",
      [`${MACHINES}/invoice.state-machine.ts`]:
        "export const invoiceLifecycle = defineStateMachine({ initial: 'draft', transitions: {} });\n",
      [`${BILLING}/reminders/application/scheduling/remind-payers.job.ts`]: 'export class RemindPayersJob {}\n',
    });

    expect(readStateMachines(ws, WITH_REMINDERS).map((machine) => machine.file)).toEqual([
      `${MACHINES}/invoice.state-machine.ts`,
      `${BILLING}/reminders/domain/state-machines/reminder.state-machine.ts`,
    ]);

    expect(readJobs(ws, WITH_REMINDERS, 'billing')).toEqual([{ name: 'RemindPayersJob', schedule: '', command: '' }]);
  });

  it('reads no folder it is not given as a module: check reports it, the documentation does not invent it', () => {
    const ws = workspaceWith({
      [`${BILLING}/application/legacy/scheduling/remind-payers.job.ts`]: 'export class RemindPayersJob {}\n',
    });

    expect(readJobs(ws, FLAT, 'billing')).toEqual([]);
  });
});
