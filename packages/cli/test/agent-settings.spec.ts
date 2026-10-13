import { describe, expect, it } from 'vitest';
import { cli, read, tempDir, write } from './helpers.js';
import { initProject } from './support/init-project.js';
import { NPM } from './support/npm.js';
import { jsonAt } from './support/json-at.js';
import { keysAt } from './support/keys-at.js';
import { readJson } from './support/read-json.js';
import { stringsAt } from './support/strings-at.js';

const SETTINGS = '.claude/settings.json';
const permissions = (root: string, kind: string): string[] => stringsAt(readJson(root, SETTINGS), 'permissions', kind);

const DENIED = [
  'Read(./.env)',
  'Read(./.env.*)',
  'Read(!./.env.example)',
  'Edit(./openapi/**)',
  'Edit(./docs/integration/asyncapi.*)',
  'Edit(./docs/integration/event-catalog.md)',
];

const ASKED = [
  'Bash(git push *)',
  'Bash(npm publish *)',
  'Edit(./ddd-ts-kit.config.json)',
  'Edit(./eslint.config.mjs)',
  'Edit(./biome.json)',
  'Edit(./.dependency-cruiser.cjs)',
  'Edit(./knip.json)',
  'Edit(./lefthook.yml)',
  'Edit(./.gitlab-ci.yml)',
  'Edit(./.github/workflows/**)',
  'Edit(./.claude/settings.json)',
  'Edit(./.github/copilot/settings.json)',
];

describe('agent settings', () => {
  it('holds permissions only: what runs without asking, what never happens, what is asked', () => {
    const root = initProject(...NPM);

    const allowed = [
      'Bash(npx ddd-ts-kit check *)',
      'Bash(npx ddd-ts-kit generate *)',
      'Bash(npx ddd-ts-kit rules)',
      'Bash(npm run verify)',
      'Bash(npm run lint *)',
      'Bash(npm test *)',
      'Bash(npm run docs:check)',
      'Bash(npm run events:check)',
    ];

    expect(keysAt(readJson(root, SETTINGS))).toEqual(['permissions']);
    expect(keysAt(readJson(root, SETTINGS), 'permissions')).toEqual(['allow', 'deny', 'ask']);
    expect(permissions(root, 'allow')).toEqual(expect.arrayContaining(allowed));
    expect(permissions(root, 'allow')).toHaveLength(17);
    expect(permissions(root, 'deny')).toEqual(DENIED);
    expect(permissions(root, 'ask')).toEqual(ASKED);
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
      /\.claude\/settings\.json gained 34 permission\(s\): allow Bash\(npx ddd-ts-kit check \*\)/,
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
