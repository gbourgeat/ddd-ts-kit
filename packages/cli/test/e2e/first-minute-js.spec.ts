import { beforeAll, describe, expect, it } from 'vitest';
import { cli, DEFAULT_STACK, exists, read, tempDir, walk } from '../helpers';
import { grantOf } from '../support/grant-of';
import { initFlags } from '../support/init-flags';
import { installForReal, type Manager } from './install-for-real';
import { DEEP } from './night-stacks';
import { runIn } from './run-in';
import { PROVEN, SLOW } from './stacks';
import { started } from './started';
import { verified } from './verified';

const only = process.env['DDD_TS_KIT_PACKAGE_MANAGER'];

/** The heaviest of the proven stacks: wired by hand on knex behind RabbitMQ and Redis, failures reported, winston for the logs. */
const [, HEAVY = DEFAULT_STACK] = PROVEN.at(-1) ?? [];

const TERMS = [
  '--term',
  'Invoice=A request for payment sent to a customer',
  '--term',
  'Issue=To make an invoice final',
];

const PROJECT_IMPORT = /(?:\bfrom|\bimport\(?)\s*['"]((?:@|\$[a-z][a-z0-9-]*)\/[^'"]*)['"]/g;

const CASES = (
  [
    ['the default stack', 'pnpm', DEFAULT_STACK],
    ['wired by hand behind RabbitMQ, failures reported, winston', 'npm', HEAVY],
  ] as const
).filter(([, manager]) => only === undefined || only === manager);

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): the spelling a project had before `importExtension` existed
 * stays alive. On the default stack and on the heaviest one, a project initialised with
 * `--import-extension js` is installed for real from the packed kit and held to its own `verify`
 * with no context, with two, and with its first use case; it is then built by its own script and
 * started under plain `node`. Every other suite generates the default, without an extension.
 */
describe.runIf(SLOW).each(CASES)(
  'from its first minute, a project that writes ".js" (%s, on %s)',
  (_label, manager: Manager, stack) => {
    let root: string;

    const generate = (...args: string[]): void => {
      expect(cli(root, 'generate', ...args).stderr, args.join(' ')).toBe('');
    };

    beforeAll(() => {
      root = tempDir('first-minute-js');

      expect(
        cli(root, 'init', ...initFlags(stack), '--package-manager', manager, '--import-extension', 'js').code,
      ).toBe(0);

      installForReal(root, manager);
    }, 600_000);

    it('is green with no context: init alone, then the whole gate', () => {
      expect(read(root, 'ddd-ts-kit.config.json')).toContain('"importExtension": "js"');
      expect(read(root, 'tsconfig.json')).toContain('"moduleResolution": "NodeNext"');
      verified(root, manager);
    }, 600_000);

    it('is green with its first use case, in a project of two contexts', () => {
      generate('context', 'billing', '--classification', 'core', ...TERMS);
      generate('context', 'shipping', '--classification', 'supporting', '--upstream', 'billing:customer-supplier');

      if (DEEP) {
        verified(root, manager);
      }

      generate('aggregate', 'billing', 'Invoice');

      generate(
        'command',
        'billing',
        'IssueInvoice',
        '--creates',
        '--aggregate',
        'Invoice',
        '--permission',
        'invoice.issue',
        ...grantOf(stack)('accountant'),
      );

      verified(root, manager);
    }, 1_200_000);

    it('writes ".js" in every import of the project, builds through its own script and starts under plain node', () => {
      const imports = ['src', 'test', 'scripts']
        .flatMap((tree) => walk(root, tree).filter((file) => file.endsWith('.ts')))
        .flatMap((file) => [...read(root, file).matchAll(PROJECT_IMPORT)].map((found) => found[1] ?? ''));

      expect(imports.length).toBeGreaterThan(100);
      expect(imports.filter((specifier) => !specifier.endsWith('.js'))).toEqual([]);

      runIn(root, { command: manager, args: ['run', 'build'] });

      const run = started(root, process.execPath, ['dist/src/main.js']);

      expect(exists(root, 'dist/src/main.js')).toBe(true);
      expect(read(root, 'dist/src/main.js')).not.toMatch(/from '@\//);
      expect(run.unresolved, run.output).toBe(false);
    }, 600_000);
  },
);
