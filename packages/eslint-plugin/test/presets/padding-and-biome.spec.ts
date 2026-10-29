import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import stylistic from '@stylistic/eslint-plugin';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { standardRules } from '../../src';

/**
 * Issue #74: the padding rules of the preset and the formatter that `init` writes (Biome, with the
 * `biome.json` of a generated project) must agree on spec-shaped files. Each fixture is one shape; both
 * orders (the formatter then the rules, the rules then the formatter) are played for three rounds. The fixtures
 * are stored as `.ts.txt` so that no tool of the repository formats or lints them. The Biome run is the root's,
 * which formatter-config.spec.ts holds equal to the pin of a generated project.
 */
const FIXTURES = resolve(__dirname, '../fixtures/padding-and-biome');
const BIOME_CONFIG = resolve(__dirname, '../../../cli/templates/pipeline/biome.json.tpl');
const BIOME_BIN = resolve(__dirname, '../../../../node_modules/@biomejs/biome/bin/biome');
const ROUNDS = 3;
const LAYOUT_RULES = new Set(['@stylistic/padding-line-between-statements', '@stylistic/lines-between-class-members']);

const linter = new Linter();

const config = [
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    plugins: { '@stylistic': stylistic },
    rules: standardRules.layout,
  },
];

const names = readdirSync(FIXTURES)
  .filter((file) => file.endsWith('.ts.txt'))
  .map((file) => file.replace(/\.ts\.txt$/, ''))
  .sort();

type Step = 'biome' | 'rules';
type Order = readonly Step[];

const BIOME_THEN_RULES: Order = ['biome', 'rules'];
const RULES_THEN_BIOME: Order = ['rules', 'biome'];

/** The text of every fixture after each round: `rounds[0]` is the input, `rounds[n]` follows round n. */
type Trace = Record<string, string[]>;

let workspace = '';
const traces: Record<string, Trace> = {};

const read = (directory: string): Record<string, string> =>
  Object.fromEntries(names.map((name) => [name, readFileSync(join(directory, `${name}.ts`), 'utf8')]));

const biomeFormat = (directory: string): void => {
  const run = spawnSync(process.execPath, [BIOME_BIN, 'format', '--write', '--config-path', workspace, directory], {
    cwd: workspace,
    encoding: 'utf8',
  });

  if (run.status !== 0) {
    throw new Error(`biome format failed in ${directory}\n${run.stdout}\n${run.stderr}`);
  }
};

const layoutFindings = (code: string): string[] =>
  linter
    .verify(code, config, 'sample.ts')
    .filter((message) => LAYOUT_RULES.has(message.ruleId ?? ''))
    .map((message) => `${message.ruleId}:${message.line}`);

const ruleFix = (directory: string): void => {
  for (const name of names) {
    const file = join(directory, `${name}.ts`);

    writeFileSync(file, linter.verifyAndFix(readFileSync(file, 'utf8'), config, 'sample.ts').output);
  }
};

const play = (order: Order, label: string): Trace => {
  const directory = join(workspace, label);

  mkdirSync(directory);

  for (const name of names) {
    cpSync(join(FIXTURES, `${name}.ts.txt`), join(directory, `${name}.ts`));
  }

  const trace: Trace = Object.fromEntries(Object.entries(read(directory)).map(([name, code]) => [name, [code]]));

  for (let round = 1; round <= ROUNDS; round += 1) {
    for (const step of order) {
      if (step === 'biome') {
        biomeFormat(directory);
      } else {
        ruleFix(directory);
      }
    }

    for (const [name, code] of Object.entries(read(directory))) {
      trace[name]?.push(code);
    }
  }

  return trace;
};

const textAt = (trace: Trace, name: string, round: number): string => trace[name]?.[round] ?? '';

beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), 'padding-and-biome-'));
  writeFileSync(join(workspace, 'biome.json'), readFileSync(BIOME_CONFIG, 'utf8'));
  writeFileSync(join(workspace, '.gitignore'), 'node_modules\n');
  traces.biomeThenRules = play(BIOME_THEN_RULES, 'biome-then-rules');
  traces.rulesThenBiome = play(RULES_THEN_BIOME, 'rules-then-biome');
}, 120_000);

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe('the padding rules of the preset and Biome with the biome.json of init', () => {
  it('holds a corpus of shapes', () => {
    expect(names.length).toBeGreaterThanOrEqual(20);
  });

  describe.each(names)('on %s', (name) => {
    it('Biome then the rules reach a fixed point in one round', () => {
      const trace = traces.biomeThenRules ?? {};

      expect(textAt(trace, name, 2)).toBe(textAt(trace, name, 1));
      expect(textAt(trace, name, 3)).toBe(textAt(trace, name, 1));
    });

    it('the rules then Biome settle within two rounds', () => {
      const trace = traces.rulesThenBiome ?? {};

      expect(textAt(trace, name, 3)).toBe(textAt(trace, name, 2));
    });

    it('no padding report remains once Biome and the rules have both run', () => {
      expect(layoutFindings(textAt(traces.biomeThenRules ?? {}, name, ROUNDS))).toEqual([]);
      expect(layoutFindings(textAt(traces.rulesThenBiome ?? {}, name, ROUNDS))).toEqual([]);
    });
  });
});
