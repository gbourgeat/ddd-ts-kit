import type { Injection } from '../injection.js';
import { PATHS } from '../paths.js';

const { VALUE_OBJECT } = PATHS;

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
  },
];
