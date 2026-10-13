import type { Injection } from '../injection.js';
import { PATHS } from '../paths.js';

const { VALUE_OBJECT } = PATHS;

const USELESS =
  'A public constructor that only hands its props to super is what TypeScript would write: the compiler-side rule calls it useless, the value object rule calls it a way around the factory.';

/** How a value of the model is written: a class extending ValueObject, built through static factories. */
export const VALUE_OBJECT_INJECTIONS: readonly Injection[] = [
  {
    rule: 'domain/value-object-class',
    what: 'a value object whose constructor is public',
    file: VALUE_OBJECT,
    changes: [
      {
        file: VALUE_OBJECT,
        from: '  private constructor(props: NotificationKindProps) {',
        to: '  constructor(props: NotificationKindProps) {',
      },
    ],
    checker: true,
    eslint: 'ddd-ts-kit/domain-value-object-class',
    alsoReports: [{ tool: 'eslint', rule: '@typescript-eslint/no-useless-constructor', reason: USELESS }],
  },
];
