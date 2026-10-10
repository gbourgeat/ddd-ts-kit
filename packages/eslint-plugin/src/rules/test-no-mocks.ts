import { defineRule } from '../support/rule/define-rule.js';
import { ambientName } from '../support/globals/ambient-name.js';
import { propertyName } from '../support/globals/property-name.js';
import { importListener } from '../support/imports/import-listener.js';

const MOCKING_MEMBERS = new Set(['mock', 'doMock', 'unstable_mockModule', 'fn', 'spyOn', 'mocked']);
const MOCKING_GLOBALS = new Set(['vi', 'jest']);
const MOCKING_LIBRARIES = new Set(['sinon', 'ts-mockito', 'jest-mock', 'jest-mock-extended', 'vitest-mock-extended', 'testdouble', 'ts-auto-mock', 'typemoq', 'moq.ts', '@golevelup/ts-jest', '@golevelup/ts-vitest']);

const INSTEAD =
  'Use the fake of the port from test/fakes (a working in-memory implementation) and assert its state, the events on the in-memory bus or the returned value instead of calls.';

export const testNoMocks = defineRule<'mock' | 'library'>({
  id: 'test/no-mocks',
  type: 'suggestion',
  recommended: 'warn',
  description: "No vi.mock, jest.mock, vi.fn, jest.fn, vi.spyOn, jest.spyOn or mocking library in a context's tests: use the fake of the port.",
  messages: {
    mock: `The test uses {{what}}. ${INSTEAD}`,
    library: `The test imports the mocking library "{{name}}". ${INSTEAD}`,
  },
  create({ file, sourceCode, report }) {
    if (file.location.area !== 'context' || !file.isTest) return {};

    return {
      ...importListener(file, ({ node, target }) => {
        if (target.kind === 'package' && MOCKING_LIBRARIES.has(target.name)) report({ node, messageId: 'library', data: { name: target.name } });
      }),
      MemberExpression(node) {
        const object = ambientName(sourceCode, node.object) ?? '';
        const member = propertyName(node) ?? '';

        if (MOCKING_GLOBALS.has(object) && MOCKING_MEMBERS.has(member)) report({ node, messageId: 'mock', data: { what: `${object}.${member}` } });
      },
    };
  },
});
