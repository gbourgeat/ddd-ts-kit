import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import plugin, { dddTsKit, rules, standardRules, VERSION } from '../src/index.js';
import { docsOf } from '../src/support/rule/docs-of.js';
import { eslintName } from '../src/support/rule/define-rule.js';

const read = (file: string): string => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
const names = Object.keys(rules);
/** `clean/blank-lines` is held by rules of `@stylistic/eslint-plugin`: a page, no rule of this plugin. */
const LAYOUT_PAGE = 'clean-blank-lines';

describe('the plugin', () => {
  it('names every rule after its architecture id, but the companion that holds a ceiling', () => {
    const renamed = Object.entries(rules).filter(([name, rule]) => name !== eslintName(docsOf(rule).ruleId));

    expect(renamed.map(([name, rule]) => [name, docsOf(rule).ruleId])).toEqual([['clean-function-ceiling', 'clean/function-size']]);

    for (const [name, rule] of Object.entries(rules)) expect(name).toBe(docsOf(rule).name);
  });

  it.each(names)('documents %s', (name) => {
    const rule = rules[name];

    expect(rule?.meta.docs?.url).toBe(`https://github.com/gbourgeat/ddd-ts-kit/blob/main/packages/eslint-plugin/docs/rules/${name}.md`);
    expect(rule?.meta.docs?.description.length).toBeGreaterThan(20);
    const page = read(`../docs/rules/${name}.md`);

    expect(page).toContain(`# ddd-ts-kit/${name}`);
    expect(page).toContain(`Default severity: \`${rule?.meta.docs?.recommended ?? ''}\``);
  });

  it.each(names)('lists %s in the README with its default severity', (name) => {
    const row = read('../README.md').split('\n').find((line) => line.includes(`\`ddd-ts-kit/${name}\``));

    expect(row).toContain(`| \`${rules[name]?.meta.docs?.recommended ?? ''}\` |`);
  });

  it('has no documentation page without a rule', () => {
    const pages = fs.readdirSync(new URL('../docs/rules', import.meta.url)).map((file) => file.replace(/\.md$/, ''));

    expect(pages.sort()).toEqual([...names, LAYOUT_PAGE].sort());
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
    expect(Object.keys(recommended?.plugins ?? {})).toContain('@stylistic');
  });
});

describe('the dddTsKit helper', () => {
  it('reads rule severities from ddd-ts-kit.config.json', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-eslint-'));

    try {
      fs.writeFileSync(path.join(root, 'ddd-ts-kit.config.json'), JSON.stringify({ contextsDir: 'modules', rules: { 'clean/stepdown': 'warn', 'test/no-mocks': 'off' } }));
      const config = dddTsKit({ tsconfigRootDir: root });
      const architecture = config.find((entry) => entry.name === 'ddd-ts-kit/architecture');

      expect(architecture?.rules).toMatchObject({ 'ddd-ts-kit/clean-stepdown': 'warn', 'ddd-ts-kit/test-no-mocks': 'off', 'ddd-ts-kit/layer-domain-purity': 'error' });
      expect(config.find((entry) => entry.name === 'ddd-ts-kit/inner-layers')?.files).toEqual(['modules/*/domain/**/*.ts', 'modules/*/application/**/*.ts']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('enables the layout rules at the severity of clean/blank-lines, and leaves them out when it is off', () => {
    const layout = (rules: Record<string, string>): unknown => inProject({ rules }, (root) => architectureOf(root)?.rules?.['@stylistic/padded-blocks']);

    expect(layout({})).toEqual(['error', 'never']);
    expect(layout({ 'clean/blank-lines': 'warn' })).toEqual(['warn', 'never']);
    expect(layout({ 'clean/blank-lines': 'off' })).toBeUndefined();
    expect(inProject({}, (root) => Object.keys(architectureOf(root)?.plugins ?? {}))).toEqual(['ddd-ts-kit', '@stylistic']);
  });

  it('keeps the function ceiling an error unless clean/function-size is off', () => {
    const ceiling = (rules: Record<string, string>): unknown => inProject({ rules }, (root) => architectureOf(root)?.rules?.['ddd-ts-kit/clean-function-ceiling']);

    expect(ceiling({})).toBe('error');
    expect(ceiling({ 'clean/function-size': 'warn' })).toBe('error');
    expect(ceiling({ 'clean/function-size': 'off' })).toBe('off');
  });

  it('names no type-aware rule when types are not requested', () => {
    const typed = new Set(['no-floating-promises', 'no-misused-promises', 'prefer-readonly', 'switch-exhaustiveness-check', 'require-await', 'dot-notation', 'unbound-method']);
    const own = dddTsKit({ typeChecked: false }).filter((entry) => entry.name?.startsWith('ddd-ts-kit/') === true);
    const named = own.flatMap((entry) => Object.keys(entry.rules ?? {}));

    expect(named.filter((rule) => typed.has(rule.replace('@typescript-eslint/', '')))).toEqual([]);
    expect(own.some((entry) => entry.languageOptions?.parserOptions?.projectService !== undefined)).toBe(false);
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
