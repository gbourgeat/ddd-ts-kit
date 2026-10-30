import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import plugin, { dddTsKit, rules, standardRules, VERSION } from '../src';
import { docsOf } from '../src/support/rule/docs-of';
import { eslintName } from '../src/support/rule/define-rule';

const read = (file: string): string => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
const names = Object.keys(rules);
/** Held by rules of `@stylistic/eslint-plugin`, by `curly` of ESLint and by the formatter: a page each, no rule of this plugin. */
const DELEGATED_PAGES = ['clean-blank-lines', 'clean-braces', 'clean-formatted'];

describe('the plugin', () => {
  it('names every rule after its architecture id, but the companion that holds a ceiling', () => {
    const renamed = Object.entries(rules).filter(([name, rule]) => name !== eslintName(docsOf(rule).ruleId));

    expect(renamed.map(([name, rule]) => [name, docsOf(rule).ruleId])).toEqual([
      ['clean-function-ceiling', 'clean/function-size'],
    ]);

    for (const [name, rule] of Object.entries(rules)) {
      expect(name).toBe(docsOf(rule).name);
    }
  });

  it.each(names)('documents %s', (name) => {
    const rule = rules[name];

    expect(rule?.meta.docs?.url).toBe(
      `https://github.com/gbourgeat/ddd-ts-kit/blob/main/packages/eslint-plugin/docs/rules/${name}.md`,
    );

    expect(rule?.meta.docs?.description.length).toBeGreaterThan(20);
    const page = read(`../docs/rules/${name}.md`);

    expect(page).toContain(`# ddd-ts-kit/${name}`);
    expect(page).toContain(`Default severity: \`${rule?.meta.docs?.recommended ?? ''}\``);
  });

  it.each(names)('lists %s in the README with its default severity', (name) => {
    const row = read('../README.md')
      .split('\n')
      .find((line) => line.includes(`\`ddd-ts-kit/${name}\``));

    expect(row).toContain(`| \`${rules[name]?.meta.docs?.recommended ?? ''}\` |`);
  });

  it('keeps a rule in transition a warning, until a version given in full', () => {
    const inTransition = Object.values(rules).filter((rule) => docsOf(rule).transition !== undefined);

    for (const rule of inTransition) {
      expect(docsOf(rule)).toMatchObject({ recommended: 'warn', transition: expect.stringMatching(/^\d+\.\d+\.\d+$/) });
    }
  });

  it('has no documentation page without a rule', () => {
    const pages = fs
      .readdirSync(new URL('../docs/rules', import.meta.url))
      .filter((file) => !file.endsWith('.fr.md'))
      .map((file) => file.replace(/\.md$/, ''));

    expect(pages.sort()).toEqual([...names, ...DELEGATED_PAGES].sort());
  });

  it('carries the version of its package', () => {
    expect(JSON.parse(read('../package.json'))).toMatchObject({ version: VERSION });
    expect(plugin.meta?.version).toBe(VERSION);
  });

  it('gives every rule its default severity in recommended and error in strict', () => {
    const [recommended] = plugin.configs.recommended;
    const [strict] = plugin.configs.strict;

    for (const [name, rule] of Object.entries(rules)) {
      expect(recommended?.rules?.[`ddd-ts-kit/${name}`]).toBe(docsOf(rule).recommended);
      expect(strict?.rules?.[`ddd-ts-kit/${name}`]).toBe('error');
    }

    expect(recommended?.rules).toHaveProperty(['@typescript-eslint/no-explicit-any'], 'error');
    expect(recommended?.rules).toMatchObject(standardRules.layout);
    expect(strict?.rules).toMatchObject(standardRules.layout);
    expect(recommended?.rules).toMatchObject(standardRules.braces);
    expect(strict?.rules).toMatchObject(standardRules.braces);
    expect(Object.keys(recommended?.plugins ?? {})).toContain('@stylistic');
  });
});

describe('the dddTsKit helper', () => {
  it('reads rule severities from ddd-ts-kit.config.json', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-eslint-'));

    try {
      fs.writeFileSync(
        path.join(root, 'ddd-ts-kit.config.json'),
        JSON.stringify({ contextsDir: 'modules', rules: { 'clean/stepdown': 'warn', 'test/no-mocks': 'off' } }),
      );

      const config = dddTsKit({ tsconfigRootDir: root });
      const architecture = config.find((entry) => entry.name === 'ddd-ts-kit/architecture');

      expect(architecture?.rules).toMatchObject({
        'ddd-ts-kit/clean-stepdown': 'warn',
        'ddd-ts-kit/test-no-mocks': 'off',
        'ddd-ts-kit/layer-domain-purity': 'error',
      });

      expect(config.find((entry) => entry.name === 'ddd-ts-kit/inner-layers')?.files).toEqual([
        'modules/*/domain/**/*.ts',
        'modules/*/*/domain/**/*.ts',
        'modules/*/application/**/*.ts',
        'modules/*/*/application/**/*.ts',
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('leaves out the build products and the ignores a project adds, and the sources of the clients only when it asks for them', () => {
    const ignores = (config: Record<string, unknown>): unknown =>
      inProject(
        config,
        (root) =>
          dddTsKit({ tsconfigRootDir: root, typeChecked: false, ignores: ['generated/**'] }).find(
            (entry) => entry.name === 'ddd-ts-kit/ignores',
          )?.ignores,
      );

    expect(ignores({})).toEqual(expect.arrayContaining(['**/dist/**', 'generated/**']));
    expect(ignores({})).not.toContain('clients/*/src/**');
    expect(ignores({ sdk: { name: '{project}-{document}-client' } })).toContain('clients/*/src/**');
  });

  it('enables curly at the severity of clean/braces, in TypeScript and in scripts, and leaves it out when it is off', () => {
    const braces = (rules: Record<string, string>): unknown[] =>
      inProject({ rules }, (root) => {
        const config = dddTsKit({ tsconfigRootDir: root });
        const scripts = config.find((entry) => entry.name === 'ddd-ts-kit/scripts');

        return [architectureOf(root)?.rules?.['curly'], scripts?.rules?.['curly']];
      });

    expect(braces({})).toEqual([
      ['error', 'all'],
      ['error', 'all'],
    ]);

    expect(braces({ 'clean/braces': 'warn' })).toEqual([
      ['warn', 'all'],
      ['warn', 'all'],
    ]);

    expect(braces({ 'clean/braces': 'off' })).toEqual([undefined, undefined]);
  });

  it('enables the layout rules at the severity of clean/blank-lines, and leaves them out when it is off', () => {
    const layout = (rules: Record<string, string>): unknown =>
      inProject(
        { rules },
        (root) => [architectureOf(root)?.rules?.['@stylistic/lines-between-class-members']].flat()[0],
      );

    expect(layout({})).toBe('error');
    expect(layout({ 'clean/blank-lines': 'warn' })).toBe('warn');
    expect(layout({ 'clean/blank-lines': 'off' })).toBeUndefined();

    expect(inProject({}, (root) => Object.keys(architectureOf(root)?.plugins ?? {}))).toEqual([
      'ddd-ts-kit',
      '@stylistic',
    ]);
  });

  it('keeps the function ceiling an error unless clean/function-size is off', () => {
    const ceiling = (rules: Record<string, string>): unknown =>
      inProject({ rules }, (root) => architectureOf(root)?.rules?.['ddd-ts-kit/clean-function-ceiling']);

    expect(ceiling({})).toBe('error');
    expect(ceiling({ 'clean/function-size': 'warn' })).toBe('error');
    expect(ceiling({ 'clean/function-size': 'off' })).toBe('off');
  });

  it('names no type-aware rule when types are not requested', () => {
    const typed = new Set([
      'no-floating-promises',
      'no-misused-promises',
      'prefer-readonly',
      'switch-exhaustiveness-check',
      'require-await',
      'dot-notation',
      'unbound-method',
    ]);

    const own = dddTsKit({ typeChecked: false }).filter((entry) => entry.name?.startsWith('ddd-ts-kit/') === true);
    const named = own.flatMap((entry) => Object.keys(entry.rules ?? {}));

    expect(named.filter((rule) => typed.has(rule.replace('@typescript-eslint/', '')))).toEqual([]);
    expect(own.some((entry) => entry.languageOptions?.parserOptions?.projectService !== undefined)).toBe(false);
  });
});

describe('a rule set for some files', () => {
  it('has a block of its own, after the architecture block', () => {
    const rules = {
      'clean/stepdown': { severity: 'off', files: ['src/legacy/**'] },
      'clean/blank-lines': { severity: 'warn', files: ['test/**'] },
      'clean/function-size': { severity: 'off', files: [] },
      'clean/braces': { severity: 'off', files: ['scripts/**'] },
    };

    const config = inProject({ rules }, (root) => dddTsKit({ tsconfigRootDir: root }));
    const names = config.map((entry) => entry.name);
    const blankLines = config.find((entry) => entry.name === 'ddd-ts-kit/rules/clean/blank-lines');

    expect(names.indexOf('ddd-ts-kit/rules/clean/stepdown')).toBeGreaterThan(names.indexOf('ddd-ts-kit/architecture'));

    expect(config.find((entry) => entry.name === 'ddd-ts-kit/rules/clean/stepdown')).toMatchObject({
      files: ['src/legacy/**'],
      rules: { 'ddd-ts-kit/clean-stepdown': 'off' },
    });

    expect(blankLines?.files).toEqual(['test/**']);
    expect(blankLines?.rules?.['@stylistic/padding-line-between-statements']).toEqual(expect.arrayContaining(['warn']));
    expect(names).not.toContain('ddd-ts-kit/rules/clean/function-size');

    expect(config.find((entry) => entry.name === 'ddd-ts-kit/rules/clean/braces')).toMatchObject({
      files: ['scripts/**'],
      rules: { curly: 'off' },
    });

    expect(
      config.find((entry) => entry.name === 'ddd-ts-kit/architecture')?.rules?.['ddd-ts-kit/clean-stepdown'],
    ).not.toBe('off');
  });
});

describe('the config file', () => {
  it('reads one that is not JSON as an empty config', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-eslint-'));

    try {
      fs.writeFileSync(path.join(root, 'ddd-ts-kit.config.json'), '{ "contexts": ');

      expect(architectureOf(root)?.rules).toEqual(inProject({}, (other) => architectureOf(other))?.rules);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

type Entry = ReturnType<typeof dddTsKit>[number];

function architectureOf(root: string): Entry | undefined {
  return dddTsKit({ tsconfigRootDir: root }).find((entry) => entry.name === 'ddd-ts-kit/architecture');
}

function inProject<T>(config: Record<string, unknown>, read: (root: string) => T): T {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-eslint-'));

  try {
    fs.writeFileSync(path.join(root, 'ddd-ts-kit.config.json'), JSON.stringify(config));

    return read(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
