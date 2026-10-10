import type { Rule } from '../model/rule.js';
import { inContext } from '../support/in-context.js';
import { perFile } from '../support/per-file.js';

const MOCK_CALL = /(?<![\w$.])(vi|jest)\s*\.\s*(mock|doMock|unstable_mockModule|fn|spyOn|mocked)(?![\w$])/g;

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

      const calls = [...file.scan.code.matchAll(MOCK_CALL)].map((match) => ({
        line: file.scan.lineAt(match.index),
        message: `The test uses ${match[1] ?? ''}.${match[2] ?? ''}.`,
        fix: FIX,
      }));

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
