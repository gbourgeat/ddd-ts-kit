import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import plugin, { dddTsKit, rules, VERSION } from '../src/index.js';
import { docsOf, eslintName } from '../src/support/define-rule.js';

const read = (file: string): string => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
const names = Object.keys(rules);

describe('the plugin', () => {
  it('names every rule after its architecture id', () => {
    for (const [name, rule] of Object.entries(rules)) expect(name).toBe(eslintName(docsOf(rule).ruleId));
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
    expect(pages.sort()).toEqual([...names].sort());
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

  it('names no type-aware rule when types are not requested', () => {
    const typed = new Set(['no-floating-promises', 'no-misused-promises', 'prefer-readonly', 'switch-exhaustiveness-check', 'require-await', 'dot-notation', 'unbound-method']);
    const own = dddTsKit({ typeChecked: false }).filter((entry) => entry.name?.startsWith('ddd-ts-kit/') === true);
    const named = own.flatMap((entry) => Object.keys(entry.rules ?? {}));
    expect(named.filter((rule) => typed.has(rule.replace('@typescript-eslint/', '')))).toEqual([]);
    expect(own.some((entry) => entry.languageOptions?.parserOptions?.projectService !== undefined)).toBe(false);
  });
});
