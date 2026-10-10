import { bin, type Invocation } from './run-in.js';

/** The three analyzers of the generated pipeline next to `ddd-ts-kit check`, as its scripts call them. */
export const ESLINT: Invocation = { command: bin('eslint'), args: ['.'] };
export const DEPCRUISE: Invocation = {
  command: bin('depcruise'),
  args: ['src', '--config', '.dependency-cruiser.cjs'],
};
export const KNIP: Invocation = { command: bin('knip'), args: [] };

/** ESLint on some files only: one typed program instead of the whole project. */
export function eslintOn(...files: string[]): Invocation {
  return { command: bin('eslint'), args: files };
}

/** The rules this wave added to the preset: a project is linted with every one of them. */
export const NEW_ESLINT_RULES = [
  'ddd-ts-kit/ports-abstract-class',
  'ddd-ts-kit/ports-implements-never-extends',
  'ddd-ts-kit/ports-no-token-constant',
  'ddd-ts-kit/ports-no-concrete-dependency',
  'ddd-ts-kit/ports-value-import',
  'ddd-ts-kit/clean-no-hash-private',
  'ddd-ts-kit/clean-one-export-per-file',
  'ddd-ts-kit/clean-file-size',
  'ddd-ts-kit/clean-function-ceiling',
  'ddd-ts-kit/scheduling-job-triggers-use-case',
  'ddd-ts-kit/scheduling-job-name',
  'ddd-ts-kit/imports-alias-only',
  '@stylistic/padding-line-between-statements',
  '@stylistic/lines-between-class-members',
];
