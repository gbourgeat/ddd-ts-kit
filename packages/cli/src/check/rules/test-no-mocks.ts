import type { Rule } from '../model/rule';
import { inContext } from '../support/in-context';
import { perFile } from '../support/per-file';

const MOCK_CALL = /(?<![\w$.])([A-Za-z_$][\w$]*)\s*\.\s*(mock|doMock|unstable_mockModule|fn|spyOn|mocked)(?![\w$])/g;

/** `vi as mocks` in the braces of an import: the runner under another name. */
const RUNNER_ALIAS = /(?<![\w$.])(vi|jest)\s+as\s+([A-Za-z_$][\w$]*)/g;
const IMPORT_BRACES = /\bimport\s+(?:type\s+)?\{([^{}]*)\}/g;

const MOCKING_LIBRARIES = new Set([
  'sinon',
  'ts-mockito',
  'jest-mock',
  'jest-mock-extended',
  'vitest-mock-extended',
  'testdouble',
  'ts-auto-mock',
  'typemoq',
  'moq.ts',
  '@golevelup/ts-jest',
  '@golevelup/ts-vitest',
]);

const FIX =
  'Use the fake of the port from test/fakes (a working in-memory implementation) and assert its state, the events on the in-memory bus or the returned value instead of calls.';

export const testNoMocks: Rule = {
  id: 'test/no-mocks',
  description:
    "No vi.mock, jest.mock, vi.fn, jest.fn, vi.spyOn, jest.spyOn or mocking library in a context's tests: use the fake of the port.",
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      if (!inContext(file.location) || !file.isTest) {
        return [];
      }

      const runners = runnersOf(file.scan.code);

      const calls = [...file.scan.code.matchAll(MOCK_CALL)].flatMap((match) => {
        const runner = runners.get(match[1] ?? '');

        return runner === undefined
          ? []
          : [{ line: file.scan.lineAt(match.index), message: `The test uses ${runner}.${match[2] ?? ''}.`, fix: FIX }];
      });

      const libraries = file.imports.flatMap(({ target, line }) => {
        if (target.kind !== 'package' || !MOCKING_LIBRARIES.has(target.name)) {
          return [];
        }

        return [{ line, message: `The test imports the mocking library "${target.name}".`, fix: FIX }];
      });

      return [...calls, ...libraries];
    });
  },
};

/** The names the mocking runners go by in the file, to the runner: `vi` and `jest`, and their import aliases. */
function runnersOf(code: string): ReadonlyMap<string, string> {
  const aliases = [...code.matchAll(IMPORT_BRACES)].flatMap(([, braces = '']) =>
    [...braces.matchAll(RUNNER_ALIAS)].map(([, runner = '', alias = '']) => [alias, runner] as const),
  );

  return new Map([['vi', 'vi'], ['jest', 'jest'], ...aliases]);
}
