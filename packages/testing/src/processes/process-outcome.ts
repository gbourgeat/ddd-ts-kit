import { AssertionError } from 'node:assert';
import { isDeepStrictEqual } from 'node:util';
import type { ProcessDecision, ProcessTimeout } from '@ddd-ts-kit/kernel';
import { show } from '../scenarios/show.js';
import { subsetDifferences } from '../scenarios/subset-differences.js';
import type { CommandMatcher } from './command-matcher.js';

/** What one step of a process decided, asserted without a store, a queue or a bus. Each assertion answers the outcome, to chain. */
export class ProcessOutcome<State> {
  constructor(private readonly decision: ProcessDecision<State> | undefined) {}

  /** The step ignored what it was given: no state saved, nothing sent. */
  thenIgnored(): this {
    return this.holds(this.decision === undefined, `expected the step to ignore it, it decided ${show(this.decision)}`);
  }

  /** Also asserts that the state survives the JSON the runner stores it as: a `Date` or a class instance does not. */
  thenState(expected: State): this {
    const state = this.decided().state;
    const stored: unknown = state === undefined ? undefined : JSON.parse(JSON.stringify(state));

    this.holds(
      isDeepStrictEqual(stored, state),
      `the state ${show(state)} is stored as JSON and read back as ${show(stored)}: keep it plain JSON data`,
    );

    return this.holds(
      isDeepStrictEqual(state, expected),
      `expected the state ${show(expected)}, decided ${show(state)}`,
    );
  }

  /** Exactly these commands, in order: each by its class or the properties that matter. */
  thenCommands(expected: readonly CommandMatcher[]): this {
    const sent = this.decided().commands ?? [];

    const lines = [
      ...(sent.length === expected.length ? [] : [`expected ${expected.length} command(s), decided ${sent.length}`]),
      ...expected.flatMap((matcher, index) => commandMismatches(sent[index], matcher, `command ${index}`)),
    ];

    return this.holds(lines.length === 0, lines.join('\n'));
  }

  thenTimeouts(expected: readonly ProcessTimeout[]): this {
    const armed = this.decided().timeouts ?? [];

    return this.holds(
      isDeepStrictEqual(armed, expected),
      `expected the timeouts ${show(expected)}, decided ${show(armed)}`,
    );
  }

  /** The names of the timeouts the step disarms. */
  thenCancelled(expected: readonly string[]): this {
    const cancelled = this.decided().cancel ?? [];

    return this.holds(
      isDeepStrictEqual(cancelled, expected),
      `expected to disarm ${show(expected)}, decided ${show(cancelled)}`,
    );
  }

  thenEnded(): this {
    return this.holds(this.decided().ended === true, 'expected the process to end, it goes on');
  }

  private decided(): ProcessDecision<State> {
    if (this.decision === undefined) {
      throw new AssertionError({ message: 'expected a decision, the step ignored what it was given' });
    }

    return this.decision;
  }

  private holds(condition: boolean, message: string): this {
    if (!condition) {
      throw new AssertionError({ message });
    }

    return this;
  }
}

function commandMismatches(command: unknown, matcher: CommandMatcher, where: string): string[] {
  if (command === undefined) {
    return [`${where}: none was decided`];
  }

  if (typeof matcher === 'function') {
    return command instanceof matcher
      ? []
      : [`${where}: expected an instance of ${matcher.name}, decided ${show(command)}`];
  }

  return subsetDifferences(command, matcher, where);
}
