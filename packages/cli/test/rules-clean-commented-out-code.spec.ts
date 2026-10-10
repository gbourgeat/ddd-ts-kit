import { describe, expect, it } from 'vitest';
import { lines, projectWith, reported } from './rules-support.js';

const FILE = 'src/platform/sample.ts';

describe('clean/no-commented-out-code, the samples of a JSDoc block', () => {
  it('accepts code shown in a JSDoc block: indented, fenced or under @example', () => {
    const source = lines(
      '/**',
      ' * The attributes a project names by declaration merging.',
      ' *',
      " *     declare module '@ddd-ts-kit/kernel' {",
      ' *       interface ActorExtensions { readonly department: string }',
      ' *     }',
      ' */',
      'export interface ActorExtensions {}',
      '',
      '/**',
      ' * Reports every failed run.',
      ' *',
      ' *     const options: ExecuteOptions = { onError: reportHttpErrors(errors) };',
      ' *',
      ' * ```ts',
      ' * new Scheduler({ onRun: reportFailedRuns(errors) });',
      ' * ```',
      ' * @example',
      ' * await report(run);',
      ' */',
      'export const reported = 1;',
    );

    expect(reported(projectWith({ [FILE]: source }), 'clean/no-commented-out-code')).toEqual([]);
  });

  it('still reports code left in a line comment or in a plain block comment', () => {
    const source = lines(
      '// const total = lines.reduce((sum, line) => sum + line.amount, 0);',
      'export const kept = 1;',
      '',
      '/*',
      'if (invoice.issued) {',
      '  return invoice;',
      '}',
      '*/',
      'export const other = 2;',
    );

    expect(reported(projectWith({ [FILE]: source }), 'clean/no-commented-out-code').map(({ line }) => line)).toEqual([
      1, 5,
    ]);
  });
});
