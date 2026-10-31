import { describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers';
import { initProject } from './support/init-project';
import { NPM } from './support/npm';
import { jsonAt } from './support/json-at';
import { keysAt } from './support/keys-at';
import { readJson } from './support/read-json';
import { stringsAt } from './support/strings-at';
import { lockFileOf } from '../src/acceptance/lock-file-of';

const SETTINGS = '.claude/settings.json';
const permissions = (root: string, kind: string): string[] => stringsAt(readJson(root, SETTINGS), 'permissions', kind);

const DENIED = [
  'Read(./.env)',
  'Read(./.env.local)',
  'Read(./.env.*.local)',
  'Read(./.env.production)',
  'Read(./.env.development)',
  'Read(./.env.test)',
];

const GENERATED = [
  'Edit(./openapi/**)',
  'Edit(./docs/integration/asyncapi.*)',
  'Edit(./docs/integration/event-catalog.md)',
  'Edit(./test/acceptance/*.acceptance.lock.json)',
];

/** The path of the project a permission rule on a file names, as a pattern: `**` crosses folders, `*` stays in one. */
const pathOf = (rule: string): RegExp | undefined => {
  const glob = /^Edit\(\.\/(.+)\)$/.exec(rule)?.[1];

  return glob === undefined
    ? undefined
    : new RegExp(
        `^${glob
          .split('**')
          .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '[^/]*'))
          .join('.*')}$`,
      );
};

const matching = (rules: readonly string[], file: string): string[] =>
  rules.filter((rule) => pathOf(rule)?.test(file) === true);

/** The command a permission rule on the shell names, as a pattern: `*` stands for anything, nothing included. */
const commandOf = (rule: string): RegExp | undefined => {
  const glob = /^Bash\((.+)\)$/.exec(rule)?.[1];

  return glob === undefined
    ? undefined
    : new RegExp(`^${glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')}$`);
};

const askedFor = (rules: readonly string[], command: string): string[] =>
  rules.filter((rule) => commandOf(rule)?.test(command) === true);

const ASKED = [
  'Bash(git push *)',
  'Bash(npm publish *)',
  'Bash(npx ddd-ts-kit check --baseline write*)',
  'Bash(npx ddd-ts-kit check --baseline=write*)',
  'Bash(npx ddd-ts-kit check * --baseline write*)',
  'Bash(npx ddd-ts-kit check * --baseline=write*)',
  'Bash(npx ddd-ts-kit generate --force*)',
  'Bash(npx ddd-ts-kit generate * --force*)',
  'Bash(npx ddd-ts-kit init --force*)',
  'Bash(npx ddd-ts-kit init * --force*)',
  ...GENERATED,
  'Edit(./ddd-ts-kit.config.json)',
  'Edit(./ddd-ts-kit-baseline.json)',
  'Edit(./REVIEW.md)',
  'Edit(./eslint.config.mjs)',
  'Edit(./biome.json)',
  'Edit(./.dependency-cruiser.cjs)',
  'Edit(./knip.json)',
  'Edit(./lefthook.yml)',
  'Edit(./.gitlab-ci.yml)',
  'Edit(./.gitlab/**)',
  'Edit(./.github/workflows/**)',
  'Edit(./.github/actions/**)',
  'Edit(./.github/scripts/**)',
  'Edit(./.github/dependabot.yml)',
  'Edit(./renovate.json)',
  'Edit(./stryker.config.mjs)',
  'Edit(./pnpm-workspace.yaml)',
  'Edit(./.claude/hooks/**)',
  'Edit(./.claude/settings.json)',
  'Edit(./.github/copilot/settings.json)',
  'Edit(./migrations/**)',
  'Edit(./Dockerfile)',
  'Edit(./docker-compose.yml)',
  'Edit(./docker/**)',
];

describe('agent settings', () => {
  it('holds permissions only: what runs without asking, what never happens, what is asked', () => {
    const root = initProject(...NPM);

    const allowed = [
      'Bash(npx ddd-ts-kit check *)',
      'Bash(npx ddd-ts-kit verify-slice *)',
      'Bash(npx ddd-ts-kit cited *)',
      'Bash(npx ddd-ts-kit verify-merge)',
      'Bash(npx ddd-ts-kit verify-merge *)',
      'Bash(npx ddd-ts-kit story-check *)',
      'Bash(npx ddd-ts-kit digest *)',
      'Bash(npx ddd-ts-kit merge-trunk)',
      'Bash(npx ddd-ts-kit merge-trunk *)',
      'Bash(npx ddd-ts-kit generate *)',
      'Bash(npx ddd-ts-kit rules)',
      'Bash(npm run verify)',
      'Bash(npm run lint *)',
      'Bash(npm test *)',
      'Bash(npm run regenerate)',
      'Bash(npm run docs:check)',
      'Bash(npm run events:check)',
    ];

    expect(keysAt(readJson(root, SETTINGS))).toEqual(['permissions']);
    expect(keysAt(readJson(root, SETTINGS), 'permissions')).toEqual(['allow', 'deny', 'ask']);
    expect(permissions(root, 'allow')).toEqual(expect.arrayContaining(allowed));
    expect(permissions(root, 'allow')).toHaveLength(32);
    expect(permissions(root, 'deny')).toEqual(DENIED);
    expect(permissions(root, 'ask')).toEqual(ASKED);
  });

  it('names the secret files, and no rule negates a pattern inside its parentheses: the sandbox ignores the negation', () => {
    const root = initProject(...NPM);
    const rules = ['allow', 'deny', 'ask'].flatMap((kind) => permissions(root, kind));

    expect(rules.filter((rule) => /\(.*!/.test(rule))).toEqual([]);

    expect(permissions(root, 'deny').filter((rule) => rule.startsWith('Read('))).toEqual([
      'Read(./.env)',
      'Read(./.env.local)',
      'Read(./.env.*.local)',
      'Read(./.env.production)',
      'Read(./.env.development)',
      'Read(./.env.test)',
    ]);
  });
});

describe('agent settings on --force', () => {
  const root = initProject(...NPM);
  const ask = permissions(root, 'ask');

  it.each([
    'npx ddd-ts-kit generate aggregate billing Order --force',
    'npx ddd-ts-kit generate --force aggregate billing Order',
    'npx ddd-ts-kit init --force',
    'npx ddd-ts-kit init --logger pino --force',
  ])('asks before `%s`, wherever the flag stands', (command) => {
    expect(askedFor(ask, command)).not.toEqual([]);
  });

  it('asks nothing of a generate without it', () => {
    expect(askedFor(ask, 'npx ddd-ts-kit generate aggregate billing Order')).toEqual([]);
  });
});

describe('agent settings on the baseline of the errors', () => {
  const root = initProject(...NPM);
  const ask = permissions(root, 'ask');

  it.each([
    'npx ddd-ts-kit check --baseline write',
    'npx ddd-ts-kit check --baseline=write',
    'npx ddd-ts-kit check --cwd . --baseline write',
    'npx ddd-ts-kit check --cwd . --baseline=write',
  ])('asks before `%s`, which the allow rule of check would let through', (command) => {
    expect(askedFor(ask, command)).not.toEqual([]);
    expect(askedFor(permissions(root, 'allow'), command)).toEqual(['Bash(npx ddd-ts-kit check *)']);
  });

  it('asks nothing of a check that writes no baseline', () => {
    expect(askedFor(ask, 'npx ddd-ts-kit check --rule config/valid')).toEqual([]);
    expect(askedFor(ask, 'npx ddd-ts-kit check --baseline prune')).toEqual([]);
  });
});

describe('agent settings under the sandbox of Claude Code', () => {
  it('denies no Edit of a file a command of the kit writes, which the sandbox would make read-only to that command, and asks for each instead', () => {
    const root = initProject(...NPM);
    const deny = permissions(root, 'deny');
    const ask = permissions(root, 'ask');
    // What docs:generate (openapi:generate, then events:generate) writes, in YAML or JSON, split
    // into documents and with the form of a route, then the lock `acceptance <story> --lock` writes.
    const contracts = ['openapi/openapi.yaml', 'docs/integration/asyncapi.yaml', 'docs/integration/event-catalog.md'];

    const written = [
      ...contracts,
      'openapi/openapi.json',
      'openapi/back-office.yaml',
      'openapi/forms/createOrder.json',
      'docs/integration/asyncapi.json',
      lockFileOf('US-5'),
    ];

    expect(contracts.filter((file) => read(root, file) === '')).toEqual([]);
    expect(deny.filter((rule) => rule.startsWith('Edit('))).toEqual([]);

    for (const file of written) {
      expect(matching(deny, file), file).toEqual([]);
      expect(matching(ask, file), file).not.toEqual([]);
    }
  });

  it('takes the Edit deny rules of an earlier version out of the deny list, asks for them, and says why', () => {
    const root = initProject(...NPM);
    const settings = readJson(root, SETTINGS) as { permissions: Record<string, string[]> };
    const ask = settings.permissions['ask'] ?? [];

    write(
      root,
      SETTINGS,
      JSON.stringify({
        permissions: {
          ...settings.permissions,
          deny: [...DENIED, ...GENERATED],
          ask: ask.filter((rule) => !GENERATED.includes(rule)),
        },
      }),
    );

    const notes = stringsAt(cli(root, 'init', '--json').json(), 'notes').join('\n');

    expect(permissions(root, 'deny')).toEqual(DENIED);
    expect(permissions(root, 'ask')).toEqual(expect.arrayContaining(GENERATED));
    expect(notes).toContain(`.claude/settings.json no longer denies ${GENERATED.join(', ')}`);
    expect(notes).toContain('docs:generate and acceptance --lock included');
  });
});

describe('agent settings of the files that reach production', () => {
  it('asks before a migration of the ORM of the project, and never names a folder the project has no migration in', () => {
    const prisma = permissions(initProject(...NPM, '--orm', 'prisma'), 'ask');
    const knex = permissions(initProject(...NPM, '--orm', 'knex'), 'ask');
    const none = permissions(initProject(...NPM, '--orm', 'none'), 'ask');

    expect(prisma).toContain('Edit(./prisma/migrations/**)');
    expect(prisma).not.toContain('Edit(./migrations/**)');
    expect(knex).toContain('Edit(./migrations/**)');
    expect(none.filter((rule) => rule.includes('migrations'))).toEqual([]);
    expect(none).toContain('Edit(./docker/**)');
  });

  it('keeps the settings a project already has, adds what is missing and says what', () => {
    const root = tempDir('settings');

    write(
      root,
      SETTINGS,
      JSON.stringify({
        model: 'a-model',
        permissions: { allow: ['Bash(make *)', 'Bash(npm run verify)'], deny: ['Read(./secrets/**)'] },
      }),
    );

    const report = cli(root, 'init', ...NPM, '--json').json();

    expect(stringsAt(report, 'updated')).toContain(SETTINGS);
    expect(jsonAt(readJson(root, SETTINGS), 'model')).toBe('a-model');
    expect(permissions(root, 'allow').slice(0, 2)).toEqual(['Bash(make *)', 'Bash(npm run verify)']);
    expect(permissions(root, 'allow').filter((rule) => rule === 'Bash(npm run verify)')).toHaveLength(1);
    expect(permissions(root, 'deny')[0]).toBe('Read(./secrets/**)');
    expect(permissions(root, 'ask')).toContain('Edit(./openapi/**)');

    expect(stringsAt(report, 'notes').join('\n')).toMatch(
      /\.claude\/settings\.json gained 75 permission\(s\): allow Bash\(npx ddd-ts-kit check \*\)/,
    );

    expect(stringsAt(cli(root, 'init', '--json').json(), 'updated')).not.toContain(SETTINGS);
  });

  it('leaves alone a settings file it cannot read', () => {
    const root = tempDir('settings');

    write(root, SETTINGS, '{ not json');

    const report = cli(root, 'init', '--json').json();

    expect(read(root, SETTINGS)).toBe('{ not json');
    expect(stringsAt(report, 'notes').join('\n')).toContain('is not a JSON object');
  });
});
