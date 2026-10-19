import { AssertionError } from 'node:assert';
import { describe, expect, it } from 'vitest';
import { Command, type ProcessDecision } from '@ddd-ts-kit/kernel';
import { givenProcess } from '../src/index.js';

interface Dunning {
  readonly invoiceId: string;
  readonly stage: 'waiting' | 'paid';
}

class CloseDunning extends Command {
  constructor(readonly invoiceId: string) {
    super();
  }
}

const due = new Date('2026-03-02T12:00:00.000Z');

const issued = (current: Dunning | undefined): ProcessDecision<Dunning> | undefined =>
  current === undefined
    ? { state: { invoiceId: 'invoice-1', stage: 'waiting' }, timeouts: [{ name: 'reminder', at: due }] }
    : undefined;

const paid = (current: Dunning | undefined): ProcessDecision<Dunning> | undefined =>
  current === undefined
    ? undefined
    : {
        state: { ...current, stage: 'paid' },
        commands: [new CloseDunning(current.invoiceId)],
        cancel: ['reminder'],
        ended: true,
      };

describe('a step of a process, given a state', () => {
  it('asserts the state, the timeouts, the commands, the disarmed timeouts and the end', () => {
    givenProcess<Dunning>(undefined)
      .when(issued)
      .thenState({ invoiceId: 'invoice-1', stage: 'waiting' })
      .thenTimeouts([{ name: 'reminder', at: due }])
      .thenCommands([])
      .thenCancelled([]);

    givenProcess<Dunning>({ invoiceId: 'invoice-1', stage: 'waiting' })
      .when(paid)
      .thenCommands([CloseDunning])
      .thenCommands([{ invoiceId: 'invoice-1' }])
      .thenCancelled(['reminder'])
      .thenEnded();

    givenProcess<Dunning>({ invoiceId: 'invoice-1', stage: 'waiting' }).when(issued).thenIgnored();
  });

  it('says what differs', () => {
    const outcome = givenProcess<Dunning>({ invoiceId: 'invoice-1', stage: 'waiting' }).when(paid);
    const ignored = givenProcess<Dunning>(undefined).when(paid);

    expect(() => outcome.thenCommands([{ invoiceId: 'invoice-2' }])).toThrow(
      /command 0.invoiceId: expected 'invoice-2'/,
    );

    expect(() => outcome.thenCommands([Command, CloseDunning])).toThrow(/expected 2 command\(s\), decided 1/);
    expect(() => outcome.thenCommands([class Other extends Command {}])).toThrow(/expected an instance of Other/);
    expect(() => outcome.thenState({ invoiceId: 'invoice-1', stage: 'waiting' })).toThrow(AssertionError);
    expect(() => outcome.thenTimeouts([{ name: 'reminder', at: due }])).toThrow(/expected the timeouts/);
    expect(() => outcome.thenCancelled([])).toThrow(/expected to disarm/);
    expect(() => outcome.thenIgnored()).toThrow(/expected the step to ignore it/);
    expect(() => ignored.thenEnded()).toThrow(/expected a decision/);
    expect(() => givenProcess<Dunning>(undefined).when(issued).thenEnded()).toThrow(/expected the process to end/);
  });

  it('refuses a state that the JSON of the store would change', () => {
    const dated = (): ProcessDecision<{ readonly since: Date }> => ({ state: { since: due } });

    expect(() => givenProcess<{ readonly since: Date }>(undefined).when(dated).thenState({ since: due })).toThrow(
      /read back as/,
    );
  });

  it('asserts a step that ends the process without a state to keep', () => {
    const settledAtOnce = (): ProcessDecision<undefined> => ({ state: undefined, ended: true });

    givenProcess<undefined>(undefined).when(settledAtOnce).thenState(undefined).thenEnded();
  });
});
