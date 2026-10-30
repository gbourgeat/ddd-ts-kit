import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runCheck } from '../src/check/engine/run-check';
import { KNOWN_CONFIG_KEYS, KNOWN_STACK_KEYS } from '../src/config';
import { parseConfig } from '../src/config/parse-config';
import { parseStack } from '../src/config/parse-stack';
import { loadProject } from '../src/check/project/load-project';
import { changeConfig } from './check-support';
import { cli, exists, tempDir } from './helpers';
import { projectWith, reported } from './rules-support';
import { initProject } from './support/init-project';
import { NPM } from './support/npm';

describe('config/valid on the contexts and the rules a team wrote', () => {
  it('reports a context upstream of itself, an unknown relationship, a missing classification and folder, and unknown severities', () => {
    const root = projectWith(
      { 'src/contexts/billing/README.md': 'Billing.\n' },
      {
        contexts: {
          billing: {
            classification: 'core',
            upstreams: [
              { context: 'billing', relationship: 'conformist' },
              { context: 'shipping', relationship: 'friendship' },
            ],
          },
          shipping: { upstreams: [] },
        },
        rules: {
          'clean/blank-lines': 'loud',
          'clean/no-hash-private': { severity: 'quiet', files: ['src/**'] },
        },
      },
    );

    expect(reported(root, 'config/valid').map(({ message }) => message)).toEqual([
      'The context "billing" lists itself as an upstream.',
      'The context "shipping" has the classification "".',
      'The context "shipping" is declared but src/contexts/shipping does not exist.',
      'The relationship "friendship" between "billing" and "shipping" is unknown.',
      'The rule "clean/blank-lines" has the severity "loud".',
      'The rule "clean/no-hash-private" has the severity "quiet".',
    ]);
  });
});

describe('config/valid on the profile of the agents', () => {
  const aboutProfile = (root: string): string[] =>
    reported(root, 'config/valid')
      .map(({ message }) => message)
      .filter((message) => message.includes('agents.profile'));

  it('reports a profile init does not write, and accepts the regulated one or none', () => {
    expect(aboutProfile(projectWith({}, { agents: { profile: 'lax' } }))).toEqual(['"agents.profile" is "lax".']);
    expect(aboutProfile(projectWith({}, { agents: { profile: 'none' } }))).toEqual(['"agents.profile" is "none".']);
    expect(aboutProfile(projectWith({}, { agents: { profile: 'regulated' } }))).toEqual([]);
    expect(aboutProfile(projectWith({}, {}))).toEqual([]);
  });
});

describe('config/valid on the directories the generators write in', () => {
  const aboutDirectories = (root: string): string[] =>
    reported(root, 'config/valid')
      .map(({ message }) => message)
      .filter((message) => message.includes('leads out of the project'));

  it('reports a directory that leads out of the project once "." and ".." are resolved, or that is absolute', () => {
    const root = projectWith({}, { contextsDir: 'src/../../escaped', platformDir: '/srv/platform', sourceRoot: 'src' });

    expect(aboutDirectories(root)).toEqual([
      '"contextsDir" is "src/../../escaped", which leads out of the project once "." and ".." are resolved: the generators would write there.',
      '"platformDir" is "/srv/platform", which leads out of the project once "." and ".." are resolved: the generators would write there.',
    ]);
  });

  it('gives as the example of the fix the directory under the source root of the project', () => {
    const root = projectWith({}, { sourceRoot: 'lib', contextsDir: '../contexts' });

    expect(cli(root, 'check', '--rule', 'config/valid').stdout).toContain(
      'Write it inside the project, relative to its root, such as "lib/contexts".',
    );

    expect(cli(root, 'list').stderr).toContain('such as "lib/contexts".');
  });

  it('accepts a directory written with "./", a doubled slash or a ".." that stays inside', () => {
    expect(aboutDirectories(projectWith({}, { contextsDir: './src//domains/../contexts/' }))).toEqual([]);
  });

  it('makes generate refuse, with exit code 2, and write nothing out of the project', () => {
    const parent = tempDir('escaping');
    const root = initProject(...NPM);

    changeConfig(root, { contextsDir: `src/../../${path.basename(parent)}/escaped` });

    const refused = cli(root, 'generate', 'context', 'ordering', '--classification', 'core');

    expect(refused.code).toBe(2);

    expect(refused.stderr).toContain(
      `ddd-ts-kit.config.json: "contextsDir" is "src/../../${path.basename(parent)}/escaped"`,
    );

    expect(refused.stderr).toContain('Write it inside the project, relative to its root, such as "src/contexts".');
    expect(exists(parent, 'escaped')).toBe(false);
  });

  it('lets every reading entry of check judge such a config, the per-file check of the editor hook included', () => {
    const root = initProject(...NPM);

    changeConfig(root, { sourceRoot: '../src' });

    expect(cli(root, 'check-file', 'src/main.ts').code).not.toBe(2);
    expect(cli(root, 'rules').code).toBe(0);

    const reported = cli(root, 'check', '--rule', 'config/valid');

    expect(reported.code).toBe(1);
    expect(reported.stdout).toContain('"sourceRoot" is "../src", which leads out of the project');
  });

  it('reads a directory written otherwise as its normalised path', () => {
    const root = initProject(...NPM);

    changeConfig(root, { contextsDir: './src//contexts/' });

    expect(cli(root, 'generate', 'context', 'ordering', '--classification', 'core').code).toBe(0);
    expect(exists(root, 'src/contexts/ordering/CONTEXT.md')).toBe(true);
  });
});

describe('config/valid on the keys of the file', () => {
  const aboutKeys = (root: string): [string, string][] =>
    runCheck(loadProject(root), { rules: ['config/valid'] })
      .violations.filter(({ message }) => message.includes('is not a key'))
      .map(({ message, fix }) => [message, fix]);

  it('names a key the kit does not read, at the root and under stack, in the order of the file, with the nearest key it reads', () => {
    const root = projectWith({}, { contextDir: 'src/ctx', stack: { ormm: 'knex' }, flavour: 'vanilla' });

    expect(aboutKeys(root)).toEqual([
      [
        '"contextDir" is not a key of ddd-ts-kit.config.json: nothing reads it.',
        'Write "contextsDir", the nearest key the kit reads, or remove it.',
      ],
      [
        '"stack.ormm" is not a key of ddd-ts-kit.config.json: nothing reads it.',
        'Write "stack.orm", the nearest key the kit reads, or remove it.',
      ],
      [
        '"flavour" is not a key of ddd-ts-kit.config.json: nothing reads it.',
        'Remove it, or write the key as docs/CONFIG.md spells it.',
      ],
    ]);
  });

  it('points a key written at the other level to its level, and leaves $schema and the // comment keys alone', () => {
    const root = projectWith(
      {},
      { orm: 'knex', $schema: './config.schema.json', '//': 'why', stack: { contextsDir: 'src/ctx', '//': 'why' } },
    );

    expect(aboutKeys(root)).toEqual([
      [
        '"orm" is not a key of ddd-ts-kit.config.json: nothing reads it.',
        'Move it under "stack": the kit reads it there.',
      ],
      [
        '"stack.contextsDir" is not a key of ddd-ts-kit.config.json: nothing reads it.',
        'Move it to the root of the file: the kit reads it there.',
      ],
    ]);
  });

  it('places each finding on the line of its key, a key of stack after the stack object, a root key named like one of stack on its own line', () => {
    const root = projectWith({}, { stack: { orm: 'drizzle', ormm: 'knex' }, orm: 'knex' });
    const found = reported(root, 'config/valid').filter(({ message }) => message.includes('is not a key'));

    expect(found.map(({ message, line }) => [message.split(' ')[0], line])).toEqual([
      ['"stack.ormm"', lineOfText(root, '"ormm"')],
      ['"orm"', lineOfText(root, '"orm": "knex"')],
    ]);
  });

  it('knows exactly the keys the parser reads, at the root and under stack', () => {
    expect([...KNOWN_CONFIG_KEYS].sort()).toEqual(Object.keys(parseConfig({}, { leaving: 'default' })).sort());
    expect([...KNOWN_STACK_KEYS].sort()).toEqual(Object.keys(parseStack({})).sort());
  });

  it('reads every key a fresh project writes', () => {
    expect(aboutKeys(initProject())).toEqual([]);
  });
});

function lineOfText(root: string, needle: string): number {
  const text = fs.readFileSync(path.join(root, 'ddd-ts-kit.config.json'), 'utf8');

  return text.slice(0, text.indexOf(needle)).split('\n').length;
}
