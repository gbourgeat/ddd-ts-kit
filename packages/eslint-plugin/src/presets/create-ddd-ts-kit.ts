import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import type { TSESLint } from '@typescript-eslint/utils';
import tseslint from 'typescript-eslint';
import { configuredSeverity } from '../project/configured-severity.js';
import { parseConfig } from '../project/parse-config.js';
import type { Config, Severity } from '../project/config.js';
import { findProject } from '../project/find-project.js';
import { rules as pluginRules } from '../rules/rules.js';
import { docsOf, type DddRule } from '../support/rule/docs-of.js';
import { eslintName } from '../support/rule/define-rule.js';
import { bracesRules } from './braces-rules.js';
import { layoutRules } from './layout-rules.js';
import {
  AGGREGATE_RULES,
  CLEAN_CODE_RULES,
  ESCAPE_HATCH_RULES,
  INNER_LAYER_RULES,
  KIT_CONVENTIONS,
  TEST_RULES,
  TYPED_CLEAN_CODE_RULES,
} from './standard-rules.js';
import type { Rules } from './flat-rules.js';

type ConfigArray = TSESLint.FlatConfig.ConfigArray;

type Plugin = TSESLint.FlatConfig.Plugin;

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

const DEFAULT_IGNORES = [
  '**/dist/**',
  '**/coverage/**',
  '**/node_modules/**',
  '**/reports/**',
  '**/.worktrees/**',
  '**/*.d.ts',
];

/** The sources of the clients `ddd-ts-kit sdk` generates from the contract, in a project whose config asks for them ("sdk"). */
const CLIENT_SOURCES = 'clients/*/src/**';

/** The architecture id whose severity drives the layout rules of `@stylistic/eslint-plugin`. */
const LAYOUT_ID = 'clean/blank-lines';

/** The architecture id whose severity drives `curly`. */
const BRACES_ID = 'clean/braces';

const JAVASCRIPT_FILES = ['**/*.js', '**/*.mjs', '**/*.cjs'];

const DEFAULT_PROJECT_FILES = ['*.config.ts', '*.config.mts'];

/**
 * A complete flat config: typescript-eslint strict and stylistic, the standard rules backing
 * the clean code section of the architecture reference, and the rules of this plugin at the
 * severities of `ddd-ts-kit.config.json`.
 */
export function createDddTsKit(plugin: Plugin, options: DddTsKitOptions = {}): ConfigArray {
  const root = options.tsconfigRootDir ?? process.cwd();
  const config = findProject(root)?.config ?? parseConfig({});

  const standard =
    options.typeChecked === false ? untyped() : typed(root, options.allowDefaultProject ?? DEFAULT_PROJECT_FILES);

  return [
    { name: 'ddd-ts-kit/ignores', ignores: ignoresOf(config, options) },
    js.configs.recommended,
    ...standard.presets,
    { name: 'ddd-ts-kit/clean-code', files: TYPESCRIPT_FILES, rules: standard.rules },
    {
      name: 'ddd-ts-kit/architecture',
      files: TYPESCRIPT_FILES,
      plugins: { 'ddd-ts-kit': plugin, '@stylistic': stylistic },
      rules: configuredLevels(config),
    },
    ...fileSettings(config),
    { name: 'ddd-ts-kit/scripts', files: JAVASCRIPT_FILES, rules: configuredBraces(config) },
    { name: 'ddd-ts-kit/inner-layers', files: innerLayerFiles(config), rules: INNER_LAYER_RULES },
    { name: 'ddd-ts-kit/aggregates', files: aggregateFiles(config), rules: standard.aggregateRules },
    { name: 'ddd-ts-kit/tests', files: testFiles(config), rules: standard.testRules },
  ];
}

function ignoresOf(config: Config, options: DddTsKitOptions): string[] {
  return [...DEFAULT_IGNORES, ...(config.sdk !== undefined ? [CLIENT_SOURCES] : []), ...(options.ignores ?? [])];
}

interface StandardRules {
  readonly presets: ConfigArray;
  readonly rules: Rules;
  readonly aggregateRules: Rules;
  readonly testRules: Rules;
}

function typed(root: string, allowDefaultProject: readonly string[]): StandardRules {
  return {
    presets: [
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      ...typeInformation(root, allowDefaultProject),
    ],
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
    {
      name: 'ddd-ts-kit/type-information',
      files: TYPESCRIPT_FILES,
      languageOptions: {
        parserOptions: { projectService: { allowDefaultProject: [...allowDefaultProject] }, tsconfigRootDir: root },
      },
    },
    { name: 'ddd-ts-kit/javascript', files: JAVASCRIPT_FILES, ...tseslint.configs.disableTypeChecked },
  ];
}

/** `rules.<id>` of ddd-ts-kit.config.json wins over the documented default, as it does for the CLI checker. */
function configuredLevels(config: Config): Rules {
  const own = Object.fromEntries(
    Object.entries(pluginRules).map(([name, rule]) => [`ddd-ts-kit/${name}`, levelOf(config, rule)]),
  );

  const layout = configuredSeverity(config, LAYOUT_ID) ?? 'error';

  return { ...own, ...(layout === 'off' ? {} : layoutRules(layout)), ...configuredBraces(config) };
}

/** `rules.<id>` set for some files: a block of its own after the architecture block, so that ESLint applies it to those files alone. */
function fileSettings(config: Config): ConfigArray {
  return Object.entries(config.rules).flatMap(([ruleId, setting]) => {
    if (typeof setting === 'string' || setting.files.length === 0 || !isSeverity(setting.severity)) {
      return [];
    }

    const rules = levelsFor(ruleId, setting.severity);

    return Object.keys(rules).length === 0
      ? []
      : [{ name: `ddd-ts-kit/rules/${ruleId}`, files: [...setting.files], rules }];
  });
}

/** The ESLint rules that hold one architecture id, at one severity; a companion rule follows only `off`, as in `levelOf`. */
function levelsFor(ruleId: string, severity: Severity): Rules {
  const own = Object.entries(pluginRules)
    .filter(([, rule]) => {
      const docs = docsOf(rule);

      return docs.ruleId === ruleId && (docs.name === eslintName(ruleId) || severity === 'off');
    })
    .map(([name]): [string, Severity] => [`ddd-ts-kit/${name}`, severity]);

  return {
    ...Object.fromEntries(own),
    ...(ruleId === LAYOUT_ID ? held(layoutRules, severity) : {}),
    ...(ruleId === BRACES_ID ? held(bracesRules, severity) : {}),
  };
}

/** The rules of another plugin that hold one id: at that severity, or each of them off. */
function held(rulesAt: (level: 'error' | 'warn') => Rules, severity: Severity): Rules {
  return severity === 'off'
    ? Object.fromEntries(Object.keys(rulesAt('error')).map((name) => [name, 'off']))
    : rulesAt(severity);
}

function isSeverity(value: string): value is Severity {
  return value === 'error' || value === 'warn' || value === 'off';
}

/** Scripts written in JavaScript carry no layer, but a branch reads the same in them. */
function configuredBraces(config: Config): Rules {
  const braces = configuredSeverity(config, BRACES_ID) ?? 'error';

  return braces === 'off' ? {} : bracesRules(braces);
}

/** A companion rule (the ceiling of `clean/function-size`) keeps its own severity: only `off` reaches it. */
function levelOf(config: Config, rule: DddRule): Severity {
  const { ruleId, name, recommended } = docsOf(rule);
  const configured = configuredSeverity(config, ruleId);

  return name === eslintName(ruleId) || configured === 'off' ? (configured ?? recommended) : recommended;
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
const TYPED_RULES = [
  'unbound-method',
  'no-unsafe-assignment',
  'no-unsafe-member-access',
  'no-unsafe-call',
  'no-unsafe-argument',
  'no-unsafe-return',
  'require-await',
  'no-unnecessary-type-arguments',
  'dot-notation',
  'no-confusing-void-expression',
  'restrict-template-expressions',
  'restrict-plus-operands',
];

function withoutTypedRules(rules: Rules): Rules {
  return Object.fromEntries(
    Object.entries(rules).filter(([name]) => !TYPED_RULES.some((typed) => name === `@typescript-eslint/${typed}`)),
  );
}
