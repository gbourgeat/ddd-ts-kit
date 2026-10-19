import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { selectAffected } from '../src/affected/select-affected.js';
import { parseConfig } from '../src/config/index.js';
import { cli, tempDir, write } from './helpers.js';
import { committedProject } from './support/committed-project.js';
import { git } from './support/git.js';

/** identity <- scheduling <- notification, analytics; billing stands alone. */
const CONFIG = parseConfig({
  contexts: {
    identity: { classification: 'supporting', upstreams: [] },
    scheduling: { classification: 'core', upstreams: ['identity'] },
    notification: { classification: 'supporting', upstreams: ['scheduling'] },
    analytics: { classification: 'supporting', upstreams: [{ context: 'scheduling', relationship: 'conformist' }] },
    billing: { classification: 'core', upstreams: [] },
  },
});

const contextsFor = (...changed: string[]): readonly string[] => selectAffected(CONFIG, changed).contexts;

describe('selectAffected(), what a change set has to run', () => {
  it('selects a changed context and every context downstream of it, directly or through another', () => {
    expect(contextsFor('src/contexts/scheduling/domain/aggregates/booking.aggregate.ts')).toEqual([
      'scheduling',
      'notification',
      'analytics',
    ]);

    expect(contextsFor('src/contexts/identity/application/commands/register/register.handler.ts')).toEqual([
      'identity',
      'scheduling',
      'notification',
      'analytics',
    ]);
  });

  it('selects the downstreams of a context whose published language changed', () => {
    const selection = selectAffected(CONFIG, ['src/contexts/scheduling/published-language/booking-confirmed.event.ts']);

    expect(selection).toMatchObject({ scope: 'contexts', contexts: ['scheduling', 'notification', 'analytics'] });
    expect(selection.leftOut).toEqual(['src/contexts/identity/', 'src/contexts/billing/']);
  });

  it('selects a leaf alone, and names the spec globs that run', () => {
    expect(selectAffected(CONFIG, ['src/contexts/billing/domain/aggregates/invoice.aggregate.ts'])).toEqual({
      scope: 'contexts',
      reason: 'the changed contexts and the contexts downstream of them in the context map',
      contexts: ['billing'],
      specs: ['src/contexts/billing/**/*.spec.ts', '!src/contexts/**'],
      leftOut: [
        'src/contexts/identity/',
        'src/contexts/scheduling/',
        'src/contexts/notification/',
        'src/contexts/analytics/',
      ],
    });
  });

  it('selects a context alone when only its tests changed: no other context may import them', () => {
    expect(contextsFor('src/contexts/scheduling/test/unit/booking.aggregate.spec.ts')).toEqual(['scheduling']);
    expect(contextsFor('src/contexts/scheduling/test/builders/booking.builder.ts')).toEqual(['scheduling']);

    expect(
      contextsFor(
        'src/contexts/scheduling/test/unit/booking.aggregate.spec.ts',
        'src/contexts/scheduling/domain/aggregates/booking.aggregate.ts',
      ),
    ).toEqual(['scheduling', 'notification', 'analytics']);
  });

  it('reads a rename as its old path and its new one: both contexts are reached', () => {
    expect(
      contextsFor(
        'src/contexts/billing/domain/value-objects/money.vo.ts',
        'src/contexts/analytics/domain/value-objects/money.vo.ts',
      ),
    ).toEqual(['analytics', 'billing']);
  });

  it.each([
    ['the shared kernel', 'src/shared-kernel/money.vo.ts'],
    ['the platform', 'src/platform/composition/compose-application.ts'],
    ['the composition root', 'src/main.ts'],
    ['the config file', 'ddd-ts-kit.config.json'],
    ['the manifest', 'package.json'],
    ['a lockfile', 'pnpm-lock.yaml'],
    ['the tooling', 'eslint.config.mjs'],
    ['the pipeline', '.github/workflows/ci.yml'],
    ['the shared test support', 'test/e2e/support/start-application.ts'],
    [
      'a deleted context, which the config no longer declares',
      'src/contexts/catalog/domain/aggregates/item.aggregate.ts',
    ],
    ['a file directly inside the contexts directory', 'src/contexts/README.txt'],
    ['a path outside the project', '../packages/kernel/src/index.ts'],
    ['a path nobody listed', 'some/unknown/file.bin'],
  ])('selects everything when %s changed', (_what, file) => {
    const selection = selectAffected(CONFIG, ['src/contexts/billing/domain/aggregates/invoice.aggregate.ts', file]);

    expect(selection.scope).toBe('all');
    expect(selection.reason).toContain(file);
    expect(selection.contexts).toEqual(Object.keys(CONFIG.contexts));
    expect(selection.leftOut).toEqual([]);
  });

  it('selects nothing that runs when only documents changed, and when nothing changed', () => {
    expect(selectAffected(CONFIG, ['README.md', 'docs/adr/0001-record.md', '.claude/rules/domain.md'])).toEqual({
      scope: 'none',
      reason: 'only documents changed',
      contexts: [],
      specs: [],
      leftOut: [],
    });

    expect(selectAffected(CONFIG, [])).toMatchObject({ scope: 'none', reason: 'no file changed' });
  });

  it('is everything once every context is reached', () => {
    expect(
      selectAffected(CONFIG, ['src/contexts/identity/domain/a.ts', 'src/contexts/billing/domain/b.ts']),
    ).toMatchObject({ scope: 'all', leftOut: [] });
  });
});

describe('ddd-ts-kit affected', () => {
  let root: string;

  beforeAll(() => {
    root = committedProject('shop', '--context', 'billing:core', '--context', 'catalog:supporting');
    cli(root, 'generate', 'context', 'shipping', '--classification', 'supporting', '--upstream', 'billing');
    git(root, 'add', '--all');
    git(root, 'commit', '--quiet', '--message', 'feat(shipping): add the context');
    git(root, 'branch', 'base');
  });

  const commit = (file: string, content: string): void => {
    write(root, file, content);
    git(root, 'add', '--all');
    git(root, 'commit', '--quiet', '--message', `chore: change ${file}`);
  };

  it('selects everything without a base, which is what the default branch runs', () => {
    expect(cli(root, 'affected').stdout).toBe('Everything is affected: no base to compare with.');

    expect(cli(root, 'affected', '--base', '', '--format', 'github').stdout).toBe('scope=all\ncontexts=\nargs=\nlint=');
  });

  it('selects everything when git cannot tell what changed', () => {
    expect(cli(root, 'affected', '--base', 'no-such-ref', '--json').json()).toMatchObject({
      scope: 'all',
      reason: 'git cannot tell what changed since no-such-ref',
    });
  });

  it('reads the difference with the base: a changed upstream brings its downstream, as outputs of a GitHub step and as a GitLab dotenv report', () => {
    commit('src/contexts/billing/domain/note.ts', 'export const note = 1;\n');

    expect(cli(root, 'affected', '--base', 'base').stdout).toBe(
      [
        'Affected contexts: billing, shipping (the changed contexts and the contexts downstream of them in the context map).',
        'Specs: src/contexts/billing/**/*.spec.ts src/contexts/shipping/**/*.spec.ts !src/contexts/**',
        'Left to the default branch: src/contexts/catalog/',
      ].join('\n'),
    );

    expect(cli(root, 'affected', '--base', 'base', '--format', 'github').stdout).toBe(
      'scope=contexts\ncontexts=billing,shipping\nargs=--passWithNoTests\nlint=--ignore-pattern src/contexts/catalog/',
    );

    expect(cli(root, 'affected', '--base', 'base', '--format', 'env').stdout).toBe(
      'AFFECTED_SCOPE=contexts\nAFFECTED_CONTEXTS=billing,shipping\nAFFECTED_ARGS=--passWithNoTests\nAFFECTED_LINT=--ignore-pattern src/contexts/catalog/',
    );
  });

  it('reads a renamed file as a change of both places, and a deleted context as a change of everything', () => {
    commit('src/contexts/billing/domain/moved.ts', 'export const moved = 1;\n');
    git(root, 'branch', '--force', 'base');
    git(root, 'mv', 'src/contexts/billing/domain/moved.ts', 'src/contexts/catalog/moved.ts');
    git(root, 'commit', '--quiet', '--message', 'refactor: move the note');

    expect(cli(root, 'affected', '--base', 'base', '--json').json()).toMatchObject({ scope: 'all' });

    git(root, 'branch', '--force', 'base');
    fs.rmSync(path.join(root, 'src/contexts/catalog/moved.ts'));
    git(root, 'add', '--all');
    git(root, 'commit', '--quiet', '--message', 'chore: drop the note');

    expect(cli(root, 'affected', '--base', 'base', '--json').json()).toMatchObject({
      scope: 'contexts',
      contexts: ['catalog'],
    });
  });

  it('selects nothing that runs for a change of documents, and refuses an unknown format', () => {
    git(root, 'branch', '--force', 'base');
    commit('docs/notes.md', '# Notes\n');

    expect(cli(root, 'affected', '--base', 'base', '--format', 'github').stdout).toBe(
      'scope=none\ncontexts=\nargs=\nlint=',
    );

    expect(cli(root, 'affected', '--format', 'xml').stderr).toContain('Unknown value "xml" for --format.');
  });
});

describe('ddd-ts-kit affected --run', () => {
  let root: string;
  /** Where the script `probe` of the project writes what it was run with: outside the project, whose diff it would change. */
  let probed: string;

  beforeAll(() => {
    // npm runs the script: every runner of the pipeline has it, not every one has pnpm.
    root = committedProject(
      'shop',
      '--context',
      'billing:core',
      '--context',
      'catalog:supporting',
      '--package-manager',
      'npm',
    );

    cli(root, 'generate', 'context', 'shipping', '--classification', 'supporting', '--upstream', 'billing');
    probed = path.join(tempDir('probe'), 'probed.json');

    write(
      root,
      'probe.mjs',
      `import fs from 'node:fs';\nfs.writeFileSync(${JSON.stringify(probed)}, JSON.stringify({ affected: process.env.DDD_TS_KIT_AFFECTED, args: process.argv.slice(2) }));\n`,
    );

    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    write(
      root,
      'package.json',
      `${JSON.stringify({ ...manifest, scripts: { ...manifest.scripts, probe: 'node probe.mjs' } }, null, 2)}\n`,
    );

    git(root, 'add', '--all');
    git(root, 'commit', '--quiet', '--message', 'feat(shipping): add the context');
  });

  const commit = (file: string, content: string): void => {
    write(root, file, content);
    git(root, 'add', '--all');
    git(root, 'commit', '--quiet', '--message', `chore: change ${file}`);
  };

  const probe = (...args: string[]): { code: number; stdout: string; run: unknown } => {
    fs.rmSync(probed, { force: true });
    const result = cli(root, 'affected', ...args, '--run', 'probe');

    return {
      code: result.code,
      stdout: result.stdout,
      run: fs.existsSync(probed) ? (JSON.parse(fs.readFileSync(probed, 'utf8')) as unknown) : undefined,
    };
  };

  it('runs a script of the project on the contexts the change reaches, as the pre-push hook runs the unit specs', () => {
    git(root, 'branch', '--force', 'base');
    commit('src/contexts/billing/domain/rate.ts', 'export const rate = 1;\n');

    expect(probe('--base', 'base')).toEqual({
      code: 0,
      stdout:
        'probe on billing, shipping (the changed contexts and the contexts downstream of them in the context map).',
      run: { affected: 'billing,shipping', args: ['--passWithNoTests'] },
    });
  });

  it('runs it on everything without a base or when git cannot tell what changed, and not at all when nothing that runs changed', () => {
    expect(probe()).toMatchObject({ code: 0, run: { affected: '', args: [] } });
    expect(probe('--base', 'no-such-ref')).toMatchObject({ code: 0, run: { affected: '', args: [] } });

    git(root, 'branch', '--force', 'base');
    commit('docs/rates.md', '# Rates\n');

    expect(probe('--base', 'base')).toEqual({
      code: 0,
      stdout: 'Nothing that runs is affected (only documents changed): probe is not run.',
      run: undefined,
    });
  });

  it('answers the exit code of the script', () => {
    write(root, 'probe.mjs', 'process.exit(3);\n');

    expect(probe().code).toBe(3);
  });
});
