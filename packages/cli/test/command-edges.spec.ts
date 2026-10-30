import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { UNWRITTEN_EXIT_CODE } from '../src/workspace/exit-code-of';
import { cli, read, tempDir, write } from './helpers';
import { failure } from './reports';
import { BUILT, LOCK, SLICES, SPEC, SPECIFICATION, STORY } from './support/acceptance-story';
import { commitAll } from './support/commit-all';
import { git } from './support/git';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';

const CONFIG = 'ddd-ts-kit.config.json';
const MIGRATION = 'migrations/1700000000000-init.ts';

/** A directory holding a config, enough for a command to find its project. */
function bareProject(label: string, config: object = { contexts: {} }): string {
  const root = tempDir(label);

  write(root, CONFIG, JSON.stringify(config));

  return root;
}

/** The project committed in a repository git then takes for bare: a ref resolves, nothing of the working tree can be diffed. */
function repositoryTakenForBare(root: string): void {
  commitAll(root);
  git(root, 'config', 'core.bare', 'true');
}

/** What the sandbox of Claude Code mounts over a path it protects: a device in place of the file. */
function mask(root: string, file: string): void {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.symlinkSync('/dev/null', path.join(root, file));
}

describe('a command given less than it needs', () => {
  it('check-file needs one path, explain a rule id, init no argument', () => {
    const root = bareProject('refusals');

    expect(failure(cli(root, 'check-file', '--json')).message).toBe('check-file expects exactly one path.');
    expect(failure(cli(root, 'explain', '--json')).message).toBe('explain needs a rule id.');
    expect(failure(cli(tempDir('init-extra'), 'init', 'extra', '--json')).message).toBe('Unexpected argument "extra".');
  });

  it('init needs a package.json that is a JSON object, when the project has one', () => {
    const broken = tempDir('init-broken-manifest');
    const list = tempDir('init-list-manifest');

    write(broken, 'package.json', '{');
    write(list, 'package.json', '[]');

    expect(failure(cli(broken, 'init', '--json')).message).toBe('package.json is not valid JSON.');
    expect(failure(cli(list, 'init', '--json')).message).toBe('package.json must hold a JSON object.');
  });

  it('move-to-module needs a declared context and the paths to move', () => {
    const root = bareProject('move', {
      contexts: { billing: { classification: 'core', upstreams: [], modules: { payments: {} } } },
    });

    expect(failure(cli(root, 'move-to-module', 'nope', 'payments', 'x', '--json')).message).toBe(
      'Unknown context "nope".',
    );

    expect(failure(cli(root, 'move-to-module', 'billing', 'payments', '--json')).message).toBe(
      'move-to-module needs the paths to move.',
    );
  });

  it('plan-waves needs the slices table, a migration its name, and a TypeORM migration its place', () => {
    const root = bareProject('names');

    write(root, 'docs/architecture/slices.md', '# Slices\n');

    expect(failure(cli(root, 'plan-waves', '--json')).message).toBe('docs/architecture/slices.md has no slices table.');
    expect(failure(cli(root, 'prisma-generate', '--json')).message).toBe('A migration is named by what it does.');

    expect(failure(cli(root, 'typeorm-generate', '--json')).message).toBe(
      'A migration is named by where it goes and what it does.',
    );
  });
});

describe('check --self and platform-folders with --json', () => {
  it('print their report as JSON', () => {
    const root = bareProject('json');
    const self = cli(root, 'check', '--self', '--json');
    const folders = cli(root, 'platform-folders', '--json');

    expect(self.code).toBe(0);
    expect(jsonAt(self.json(), 'ok')).toBe(true);
    expect(jsonAt(self.json(), 'fixtures')).toEqual(expect.arrayContaining([expect.objectContaining({ ok: true })]));
    expect(folders.json()).toEqual({ dryRun: false, moved: [], rewritten: [], manual: [] });
  });
});

describe('a project whose repository git cannot diff', () => {
  it('is refused by check --changed-since and by mutation --changed, which name the ref', () => {
    const root = bareProject('taken-for-bare');

    write(root, 'reports/mutation/mutation.json', JSON.stringify({ schemaVersion: '2', files: {} }));
    repositoryTakenForBare(root);

    expect(failure(cli(root, 'check', '--changed-since', 'HEAD', '--json')).message).toMatch(
      /^Could not list the files changed since [0-9a-f]{7}\.$/,
    );

    expect(failure(cli(root, 'mutation', '--changed', 'HEAD', '--json')).message).toBe(
      'The files changed since HEAD cannot be listed.',
    );
  });
});

describe.skipIf(process.platform === 'win32')('a derived file a sandbox protects', () => {
  it('is said by depcruise-config --write, which exits as an unwritten run does', () => {
    const root = bareProject('depcruise-masked');

    mask(root, '.dependency-cruiser.cjs');

    const result = cli(root, 'depcruise-config', '--write');

    expect(result.code).toBe(UNWRITTEN_EXIT_CODE);
    expect(result.stderr).toContain('.dependency-cruiser.cjs');
    expect(result.stdout).not.toContain('written');
  });

  it('is said by acceptance --lock, which locks nothing', () => {
    const root = initProject('--context', 'ordering:core', '--context', 'billing:supporting');

    write(root, 'docs/architecture/slices.md', SLICES);
    write(root, STORY, SPECIFICATION);
    write(root, SPEC, BUILT);
    mask(root, LOCK);

    const locked = cli(root, 'acceptance', 'US5', '--lock');

    expect(locked.code).toBe(UNWRITTEN_EXIT_CODE);
    expect(locked.stderr).toContain(LOCK);
    expect(locked.stdout).not.toContain('Locked');
  });
});

describe('typeorm-generate, what it does to the migration TypeORM wrote', () => {
  it('writes its imports as type-only, and says the migration is not formatted when the project has no formatter', () => {
    const root = bareProject('typeorm-tidy', { contexts: {}, stack: { orm: 'typeorm', audit: 'off' } });

    const migration = `import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1700000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE TABLE "invoices" ("id" text)');
  }
}
`;

    write(
      root,
      'node_modules/typeorm/cli.js',
      `const fs = require('node:fs'); fs.mkdirSync('migrations', { recursive: true }); fs.writeFileSync(${JSON.stringify(MIGRATION)}, ${JSON.stringify(migration)});\n`,
    );

    const url = process.env['DATABASE_URL'];

    // A URL without a host: nothing to probe, and TypeORM is run as installed, not on the in-process database.
    process.env['DATABASE_URL'] = 'file:./local.db';

    try {
      const result = cli(root, 'typeorm-generate', 'migrations/init');

      expect(result.code).toBe(0);

      expect(result.stdout).toContain(
        `Not formatted (package.json has no \`format\` script that runs Biome or Prettier): ${MIGRATION}.`,
      );
    } finally {
      if (url === undefined) {
        Reflect.deleteProperty(process.env, 'DATABASE_URL');
      } else {
        process.env['DATABASE_URL'] = url;
      }
    }

    expect(read(root, MIGRATION)).toContain("import type { MigrationInterface, QueryRunner } from 'typeorm';");
  });
});
