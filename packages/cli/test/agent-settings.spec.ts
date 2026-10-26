import { describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers';
import { initProject } from './support/init-project';
import { NPM } from './support/npm';
import { jsonAt } from './support/json-at';
import { keysAt } from './support/keys-at';
import { readJson } from './support/read-json';
import { stringsAt } from './support/strings-at';

const SETTINGS = '.claude/settings.json';
const permissions = (root: string, kind: string): string[] => stringsAt(readJson(root, SETTINGS), 'permissions', kind);

const DENIED = [
  'Read(./.env)',
  'Read(./.env.local)',
  'Read(./.env.*.local)',
  'Read(./.env.production)',
  'Read(./.env.development)',
  'Read(./.env.test)',
  'Edit(./openapi/**)',
  'Edit(./docs/integration/asyncapi.*)',
  'Edit(./docs/integration/event-catalog.md)',
  'Edit(./test/acceptance/*.acceptance.lock.json)',
];

const ASKED = [
  'Bash(git push *)',
  'Bash(npm publish *)',
  'Bash(npx ddd-ts-kit check --baseline write*)',
  'Edit(./ddd-ts-kit.config.json)',
  'Edit(./ddd-ts-kit-baseline.json)',
  'Edit(./REVIEW.md)',
  'Edit(./eslint.config.mjs)',
  'Edit(./biome.json)',
  'Edit(./.dependency-cruiser.cjs)',
  'Edit(./knip.json)',
  'Edit(./lefthook.yml)',
  'Edit(./.gitlab-ci.yml)',
  'Edit(./.github/workflows/**)',
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
    expect(permissions(root, 'allow')).toHaveLength(31);
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
    expect(permissions(root, 'deny')).toContain('Edit(./openapi/**)');

    expect(stringsAt(report, 'notes').join('\n')).toMatch(
      /\.claude\/settings\.json gained 59 permission\(s\): allow Bash\(npx ddd-ts-kit check \*\)/,
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
