import js from '@eslint/js';
import type { TSESLint } from '@typescript-eslint/utils';
import tseslint from 'typescript-eslint';
import { configuredSeverity, parseConfig, type Config } from '../project/config.js';
import { findProject } from '../project/linted-file.js';
import { rules as pluginRules } from '../rules/index.js';
import { docsOf } from '../support/define-rule.js';
import { AGGREGATE_RULES, CLEAN_CODE_RULES, ESCAPE_HATCH_RULES, INNER_LAYER_RULES, KIT_CONVENTIONS, TEST_RULES, TYPED_CLEAN_CODE_RULES } from './standard-rules.js';

type ConfigArray = TSESLint.FlatConfig.ConfigArray;
type Plugin = TSESLint.FlatConfig.Plugin;
type Rules = TSESLint.FlatConfig.Rules;

export interface DddTsKitOptions {
  /** Directory of the tsconfig and of `ddd-ts-kit.config.json`. Default: the working directory. */
  readonly tsconfigRootDir?: string;
  /** Adds the rules that read types (slower, needs a tsconfig covering the linted files). Default: true. */
  readonly typeChecked?: boolean;
  /** Files outside the tsconfig that are still linted with types, as `projectService.allowDefaultProject` globs. */
  readonly allowDefaultProject?: readonly string[];
  readonly ignores?: readonly string[];
}

export const TYPESCRIPT_FILES = ['**/*.ts', '**/*.mts', '**/*.cts'];
const DEFAULT_IGNORES = ['**/dist/**', '**/coverage/**', '**/node_modules/**', '**/reports/**', '**/*.d.ts'];
const DEFAULT_PROJECT_FILES = ['*.config.ts', '*.config.mts'];

/** Severity of every rule of this plugin: the documented default, or `error` everywhere. */
export function pluginRuleLevels(level: 'recommended' | 'error'): Rules {
  return Object.fromEntries(Object.entries(pluginRules).map(([name, rule]) => [`ddd-ts-kit/${name}`, level === 'error' ? 'error' : docsOf(rule).recommended]));
}

/**
 * A complete flat config: typescript-eslint strict and stylistic, the standard rules backing
 * the clean code section of the architecture reference, and the rules of this plugin at the
 * severities of `ddd-ts-kit.config.json`.
 */
export function createDddTsKit(plugin: Plugin, options: DddTsKitOptions = {}): ConfigArray {
  const root = options.tsconfigRootDir ?? process.cwd();
  const config = findProject(root)?.config ?? parseConfig({});
  const standard = options.typeChecked === false ? untyped() : typed(root, options.allowDefaultProject ?? DEFAULT_PROJECT_FILES);
  return [
    { name: 'ddd-ts-kit/ignores', ignores: [...DEFAULT_IGNORES, ...(options.ignores ?? [])] },
    js.configs.recommended,
    ...standard.presets,
    { name: 'ddd-ts-kit/clean-code', files: TYPESCRIPT_FILES, rules: standard.rules },
    { name: 'ddd-ts-kit/architecture', files: TYPESCRIPT_FILES, plugins: { 'ddd-ts-kit': plugin }, rules: configuredLevels(config) },
    { name: 'ddd-ts-kit/inner-layers', files: innerLayerFiles(config), rules: INNER_LAYER_RULES },
    { name: 'ddd-ts-kit/aggregates', files: aggregateFiles(config), rules: standard.aggregateRules },
    { name: 'ddd-ts-kit/tests', files: testFiles(config), rules: standard.testRules },
  ];
}

interface StandardRules {
  readonly presets: ConfigArray;
  readonly rules: Rules;
  readonly aggregateRules: Rules;
  readonly testRules: Rules;
}

function typed(root: string, allowDefaultProject: readonly string[]): StandardRules {
  return {
    presets: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked, ...typeInformation(root, allowDefaultProject)],
    rules: { ...CLEAN_CODE_RULES, ...ESCAPE_HATCH_RULES, ...TYPED_CLEAN_CODE_RULES, ...KIT_CONVENTIONS },
    aggregateRules: AGGREGATE_RULES,
    testRules: TEST_RULES,
  };
}

function untyped(): StandardRules {
  return {
    presets: [...tseslint.configs.strict, ...tseslint.configs.stylistic],
    rules: withoutTypedRules({ ...CLEAN_CODE_RULES, ...ESCAPE_HATCH_RULES, ...KIT_CONVENTIONS }),
    aggregateRules: {},
    testRules: withoutTypedRules(TEST_RULES),
  };
}

function typeInformation(root: string, allowDefaultProject: readonly string[]): ConfigArray {
  return [
    { name: 'ddd-ts-kit/type-information', files: TYPESCRIPT_FILES, languageOptions: { parserOptions: { projectService: { allowDefaultProject: [...allowDefaultProject] }, tsconfigRootDir: root } } },
    { name: 'ddd-ts-kit/javascript', files: ['**/*.js', '**/*.mjs', '**/*.cjs'], ...tseslint.configs.disableTypeChecked },
  ];
}

/** `rules.<id>` of ddd-ts-kit.config.json wins over the documented default, as it does for the CLI checker. */
function configuredLevels(config: Config): Rules {
  return Object.fromEntries(Object.entries(pluginRules).map(([name, rule]) => [`ddd-ts-kit/${name}`, configuredSeverity(config, docsOf(rule).ruleId) ?? docsOf(rule).recommended]));
}

function innerLayerFiles(config: Config): string[] {
  return [`${config.contextsDir}/*/domain/**/*.ts`, `${config.contextsDir}/*/application/**/*.ts`];
}

function aggregateFiles(config: Config): string[] {
  return [`${config.contextsDir}/*/domain/aggregates/**/*.ts`, `${config.contextsDir}/*/domain/entities/**/*.ts`];
}

function testFiles(config: Config): string[] {
  return ['**/*.spec.ts', '**/*.test.ts', `${config.contextsDir}/*/test/**/*.ts`, 'test/**/*.ts'];
}

/** Rules of typescript-eslint that need type information: naming them without it is an error. */
const TYPED_RULES = ['unbound-method', 'no-unsafe-assignment', 'no-unsafe-member-access', 'no-unsafe-call', 'no-unsafe-argument', 'no-unsafe-return', 'require-await', 'no-unnecessary-type-arguments', 'dot-notation', 'no-confusing-void-expression', 'restrict-template-expressions', 'restrict-plus-operands'];

function withoutTypedRules(rules: Rules): Rules {
  return Object.fromEntries(Object.entries(rules).filter(([name]) => !TYPED_RULES.some((typed) => name === `@typescript-eslint/${typed}`)));
}
