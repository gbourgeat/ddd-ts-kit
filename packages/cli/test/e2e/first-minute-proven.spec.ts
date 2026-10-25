import { beforeAll, describe, expect, it } from 'vitest';
import { cli, tempDir } from '../helpers';
import { grantOf } from '../support/grant-of';
import { initFlags } from '../support/init-flags';
import { installForReal, type Manager } from './install-for-real';
import { NIGHT, NIGHT_ONLY, PROVEN_AT_NIGHT } from './night-stacks';
import { PROVEN, SLOW } from './stacks';
import { verified } from './verified';

const only = process.env['DDD_TS_KIT_PACKAGE_MANAGER'];

/** The language of the first use case, given with its context: a name the glossary does not hold is refused. */
const TERMS = [
  '--term',
  'Invoice=A request for payment sent to a customer',
  '--term',
  'Issue=To make an invoice final',
];

/** Every proven stack but the default one, which the quick start of the README covers on both managers, and at night those the workspace cannot run: one manager each, in turn. */
const OTHERS = [...PROVEN.slice(1), ...(NIGHT || NIGHT_ONLY ? PROVEN_AT_NIGHT : [])]
  .map(([label, stack], index) => [label, index % 2 === 0 ? 'pnpm' : 'npm', stack] as const)
  .filter(([label]) => !NIGHT_ONLY || PROVEN_AT_NIGHT.some(([night]) => night === label))
  .filter(([, manager]) => only === undefined || only === manager);

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): on each proven stack a project is installed for real from
 * the packed kit right after `init`, with nothing generated, and held to its own `verify`; then
 * again with one context, with a second one downstream of the first, and with its first use
 * case. The other suites generate every kind before they verify: this one is the path a team
 * takes, where the first gate runs on an empty project.
 */
describe.runIf(SLOW).each(OTHERS)('from its first minute, a project on %s (%s)', (_label, manager: Manager, stack) => {
  let root: string;

  const generate = (...args: string[]): void => {
    const result = cli(root, 'generate', ...args);

    expect(result.stderr, args.join(' ')).toBe('');
  };

  beforeAll(() => {
    root = tempDir('first-minute');

    expect(cli(root, 'init', ...initFlags(stack), '--package-manager', manager).code).toBe(0);

    installForReal(root, manager);
  }, 600_000);

  it('is green with no context: init alone, then the whole gate', () => {
    verified(root, manager);
  }, 600_000);

  it('is green with one context, then with a second one downstream of it', () => {
    generate('context', 'billing', '--classification', 'core', ...TERMS);
    verified(root, manager);
    generate('context', 'shipping', '--classification', 'supporting', '--upstream', 'billing:customer-supplier');
    verified(root, manager);
  }, 900_000);

  it('is green with its first use case, as generated', () => {
    generate('aggregate', 'billing', 'Invoice');

    generate(
      'command',
      'billing',
      'IssueInvoice',
      '--aggregate',
      'Invoice',
      '--permission',
      'invoice.issue',
      ...grantOf(stack)('accountant'),
    );

    verified(root, manager);
  }, 600_000);
});
