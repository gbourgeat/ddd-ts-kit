import type { Rule, Violation } from '../types.js';
import { inContext, reporter } from './helpers.js';

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
  description: "No vi.mock, jest.mock, vi.fn, jest.fn, vi.spyOn, jest.spyOn or mocking library in a context's tests: use the fake of the port.",
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (!inContext(file.location) || !file.isTest) continue;
      for (const match of file.scan.code.matchAll(MOCK_CALL)) {
        violations.push(report({ file: file.path, line: file.scan.lineAt(match.index) }, `The test uses ${match[1] ?? ''}.${match[2] ?? ''}.`, FIX));
      }
      for (const { target, line } of file.imports) {
        if (target.kind !== 'package' || !MOCKING_LIBRARIES.has(target.name)) continue;
        violations.push(report({ file: file.path, line }, `The test imports the mocking library "${target.name}".`, FIX));
      }
    }
    return violations;
  },
};
