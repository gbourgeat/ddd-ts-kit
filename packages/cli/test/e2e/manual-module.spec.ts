import { beforeAll, describe, expect, it } from 'vitest';
import { cli, DEFAULT_STACK, scaffoldEverything, tempDir, type StackFlags } from '../helpers';
import { grantOf } from '../support/grant-of';
import { expectNoFinding } from './expect-no-finding';
import { installAsPublished } from './install-as-published';
import { SLOW } from './stacks';

const STACK: StackFlags = { ...DEFAULT_STACK, di: 'manual' };

/** Enough use cases for the registrations of a context to outgrow the 100 lines nothing may exceed in one function. */
const VERBS: readonly (readonly [string, string])[] = [
  ['Approve', 'Approved'],
  ['Archive', 'Archived'],
  ['Block', 'Blocked'],
  ['Close', 'Closed'],
  ['Confirm', 'Confirmed'],
  ['Defer', 'Deferred'],
  ['Escalate', 'Escalated'],
  ['Flag', 'Flagged'],
  ['Hold', 'Held'],
  ['Merge', 'Merged'],
  ['Pause', 'Paused'],
  ['Reopen', 'Reopened'],
  ['Review', 'Reviewed'],
  ['Split', 'Separated'],
  ['Transfer', 'Transferred'],
  ['Unblock', 'Unblocked'],
];

/** Use cases of the larger context, of each kind: about 130 lines of registrations in one function, 100 being the ceiling. */
const LARGER = 6;

const term = (verb: string): string[] => ['--term', `${verb}=To ${verb.toLowerCase()} a ticket`];

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): a project on manual DI whose first context is scaffolded with
 * every kind, then a second, larger one, a ticket with six commands, six queries and six
 * reactions. The module of a context keeps each function under the ceiling as it grows
 * (one function per layer or per role), so the project has no finding.
 */
describe.runIf(SLOW)('a project on manual DI', () => {
  let root: string;

  const generate = (...args: string[]): void => {
    const result = cli(root, 'generate', ...args);

    expect(result.code, `${args.join(' ')}: ${result.stderr}`).toBe(0);
  };

  beforeAll(() => {
    const grant = grantOf(STACK)('agent');

    root = tempDir('manual-module');
    scaffoldEverything(root, STACK);

    generate('context', 'support', '--classification', 'supporting', '--term', 'Ticket=A request for help');
    generate('aggregate', 'support', 'Ticket');
    generate('repository', 'support', 'Ticket');

    for (const [verb, past] of VERBS.slice(0, LARGER)) {
      generate(
        'command',
        'support',
        `${verb}Ticket`,
        '--creates',
        '--aggregate',
        'Ticket',
        '--permission',
        `ticket.${verb.toLowerCase()}`,
        ...grant,
        ...term(verb),
      );

      generate(
        'query',
        'support',
        `Read${verb}Ticket`,
        '--permission',
        `ticket.read-${verb.toLowerCase()}`,
        ...grant,
        ...term(`Read${verb}`),
      );

      generate('event-handler', 'support', 'Ticket', past, ...term(verb), ...term(past));
    }

    installAsPublished(root);
  }, 600_000);

  it('has no finding once the contexts are scaffolded: the checker, ESLint with the preset, dependency-cruiser, knip', () => {
    expectNoFinding(root);
  }, 480_000);
});
