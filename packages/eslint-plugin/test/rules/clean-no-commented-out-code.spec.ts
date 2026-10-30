import { cleanNoCommentedOutCode } from '../../src/rules/clean-no-commented-out-code';
import { ruleTester } from '../support/rule-tester';

const PROSE = [
  '// The outbox is drained after the transaction commits, never inside it.',
  '// TODO(domain): declare the rest of the state of Invoice with value objects (a Money, a Period), not primitives.',
  '// timeout (ms)',
  '// name: the business name, as printed on the invoice',
  '// see https://www.rfc-editor.org/rfc/rfc9457 (problem details)',
  '// e.g. (a, b) => a + b',
  '// returns true when x > 0',
  '// key = value pairs, one per line, as the vendor sends them',
  '// string | undefined',
  '// [1] the first reference',
  '// "quoted text"',
  '// - an item (optional)',
  '// let go',
  '// return value',
  '// A directory import (`../billing/published-language`) names the layer without a file.',
  '// eslint-disable-next-line no-console -- the CLI prints',
  '// ddd-ts-kit-disable-next-line clean/stepdown -- kept next to its table',
  '// @ts-expect-error the fixture is wrong on purpose',
  '// istanbul ignore next',
  "// `key = '...'`, `key: '...'` and `key: string = '...'`.",
  '// Depth of `{` inside each open `${ ... }`, so the matching `}` returns to the template.',
  '/* why: the vendor rounds half up (see contract 4.2) */',
  '/**\n * Adds the tax.\n * @example\n * const total = addTax(amount);\n */',
  '/**\n * Usage:\n * ```ts\n * const bus = createBus();\n * ```\n */',
  '/** `findProject(directory)` walks up to the config. */',
  '// One sentence saying what to do instead; written for whoever has to repair the code.',
  '// Only a template without interpolation is a usable module specifier.',
  '// <reference types="node" />',
  '// Copyright (c) 2026 the authors',
];

ruleTester.run('clean-no-commented-out-code', cleanNoCommentedOutCode, {
  valid: PROSE.map((comment) => `${comment}\nexport const value = 1;`),
  invalid: [
    {
      code: '// const total = lines.reduce(add, 0);\nexport const value = 1;',
      errors: [{ messageId: 'code', line: 1 }],
    },
    {
      code: '// const total = lines\n//   .map(price)\n//   .reduce(add, 0);\nexport const value = 1;',
      errors: [{ messageId: 'code', line: 1 }],
    },
    {
      code: '// the previous version:\n// await repository.save(invoice);\nexport const value = 1;',
      errors: [{ messageId: 'code', line: 2 }],
    },
    {
      code: '// if (invoice.isPaid()) {\n//   return;\n// }\nexport const value = 1;',
      errors: [{ messageId: 'code', line: 1 }],
    },
    { code: '// if (invoice.isPaid()) {\nexport const value = 1;', errors: [{ messageId: 'code', line: 1 }] },
    { code: "// import { z } from 'zod';\nexport const value = 1;", errors: [{ messageId: 'code' }] },
    { code: '// return this.total;\nexport const value = 1;', errors: [{ messageId: 'code' }] },
    { code: '// private guard(): void { this.check(); }\nexport const value = 1;', errors: [{ messageId: 'code' }] },
    {
      code: '/*\nexport function old(): void {\n  run();\n}\n*/\nexport const value = 1;',
      errors: [{ messageId: 'code', line: 2 }],
    },
    { code: 'export const value = 1; // counter += 1;', errors: [{ messageId: 'code' }] },
    { code: '// validate(input);\nexport const value = 1;', errors: [{ messageId: 'code' }] },
    {
      code: '// first();\n\n// second();\nexport const value = 1;',
      errors: [
        { messageId: 'code', line: 1 },
        { messageId: 'code', line: 3 },
      ],
    },
    {
      code: '// export class Invoice extends AggregateRoot<string> {\nexport const value = 1;',
      errors: [{ messageId: 'code' }],
    },
    { code: '// items.forEach((item) => {\nexport const value = 1;', errors: [{ messageId: 'code' }] },
    { code: "// throw new Error('boom');\nexport const value = 1;", errors: [{ messageId: 'code' }] },
    { code: '// let total: number;\nexport const value = 1;', errors: [{ messageId: 'code' }] },
  ],
});
