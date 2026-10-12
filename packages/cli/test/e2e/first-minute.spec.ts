import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { read, REPO_ROOT, tempDir } from '../helpers.js';
import { installForReal, type Manager } from './install-for-real.js';
import { quickStart } from './quick-start.js';
import { runIn } from './run-in.js';
import { SLOW } from './stacks.js';
import { verified } from './verified.js';

const BUILT_CLI = `node ${path.join(REPO_ROOT, 'packages/cli/dist/bin.js')}`;

const only = process.env['DDD_TS_KIT_PACKAGE_MANAGER'];
const managers = (['pnpm', 'npm'] as const).filter((manager) => only === undefined || only === manager);

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): a project is green from its first minute. The quick start of
 * the root README is run line by line as it is written, on pnpm and, in the words the README
 * gives for it, on npm: the directory, `init` alone, the install and the whole gate the note
 * of `init` names; then each context, a use case and its route, the documents and the gate again.
 * Two things differ from what a reader gets, both because no registry serves this tree yet:
 * `init` is the CLI the workspace built, and the install takes the kit from its packed tarballs.
 * The suite adds one `verify` after each new context: no step of the life of a project is red.
 * `DDD_TS_KIT_PACKAGE_MANAGER` narrows the run to one manager, which is how the pipeline splits it.
 */
describe.runIf(SLOW).each(managers)('the quick start of the README, typed on %s', (manager) => {
  const [directory = '', init = '', install = '', verify = '', ...then] = quickStart(manager);
  let root: string;
  let notes: string[];

  beforeAll(() => {
    const parent = tempDir(`quick-start-${manager}`);

    typed(parent, directory);
    root = path.join(parent, 'orders-api');
    notes = initialised(root, init);
    installForReal(root, manager);
  }, 600_000);

  it('opens on the directory, `init` alone, then the two commands the note of `init` gives', () => {
    expect(directory).toBe('mkdir orders-api && cd orders-api');
    expect(init).toBe(manager === 'npm' ? 'npx ddd-ts-kit init --package-manager npm' : 'npx ddd-ts-kit init');
    expect([install, verify]).toEqual([`${manager} install`, `${manager} run verify`]);
    expect(notes).toContain(`Run \`${install}\`, then \`${verify}\`.`);
    expect(read(root, 'README.md')).toContain(`\`\`\`bash\n${install}\n${verify} `);
    expect(read(root, 'CLAUDE.md')).toContain(`- \`${verify}\`: types, lint, format, tests`);
  });

  it('is green before anything is generated: init alone, with no context, then the whole gate', () => {
    verified(root, manager);
  }, 600_000);

  it('stays green at each step that follows: a context, a second one downstream of it, a use case and its route, the documents', () => {
    const contexts = then.filter((line) => line.includes(' generate context '));

    expect(contexts).toHaveLength(2);
    expect(contexts[1]).toContain('--upstream ordering:');
    expect(then.slice(-3, -1)).toEqual([`${manager} run docs:generate`, verify]);

    for (const line of then) {
      typed(root, line);

      if (contexts.includes(line)) {
        verified(root, manager);
      }
    }

    expect(read(root, 'openapi/openapi.yaml')).toContain('\n  /orders:\n');
  }, 1_200_000);
});

/** The sequence the defect was reported with: a context asked of `init`, on npm, and the gate at once; and several contexts on pnpm. */
const ASKED_OF_INIT: readonly (readonly [Manager, string])[] = [
  ['npm', '--context billing:core'],
  ['pnpm', '--context billing:core --context shipping:supporting --context catalog:generic'],
];

describe.runIf(SLOW).each(ASKED_OF_INIT.filter(([manager]) => managers.includes(manager)))(
  'a project on %s whose contexts are asked of init (%s)',
  (manager, contexts) => {
    it('is green at once: the install, then the whole gate', () => {
      const root = tempDir(`asked-${manager}`);

      initialised(root, `npx ddd-ts-kit init --package-manager ${manager} ${contexts}`);
      installForReal(root, manager);
      verified(root, manager);
    }, 900_000);
  },
);

/** A line a reader types in a shell, run in one. */
function typed(root: string, line: string): string {
  return runIn(root, { command: 'sh', args: ['-c', line], env: { COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' } });
}

/** `init` as the registry will serve it once this tree is released: the CLI this workspace built, asked for its notes. */
function initialised(root: string, line: string): string[] {
  const printed = typed(root, `${line.replace(/^npx ddd-ts-kit\b/, BUILT_CLI)} --json`);
  const { notes } = JSON.parse(printed) as { notes: string[] };

  return notes;
}
