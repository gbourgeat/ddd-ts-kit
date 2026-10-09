import type { TSESLint } from '@typescript-eslint/utils';

type Rules = TSESLint.FlatConfig.Rules;

/**
 * The part of clean/no-escape-hatch that typescript-eslint already holds: these three rules
 * are enabled by every preset instead of being written a second time.
 */
export const ESCAPE_HATCH_RULES: Rules = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-non-null-assertion': 'error',
  '@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true, 'ts-nocheck': true, 'ts-check': false, minimumDescriptionLength: 3 }],
};

/** Standard rules backing section 6 of docs/ARCHITECTURE.md that need no type information. */
export const CLEAN_CODE_RULES: Rules = {
  eqeqeq: ['error', 'always'],
  'no-else-return': ['error', { allowElseIf: false }],
  'no-param-reassign': 'error',
  complexity: ['warn', { max: 10 }],
  'max-depth': ['warn', { max: 3 }],
  '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'separate-type-imports' }],
};

/** The same, for rules that read types: only with `typeChecked`. */
export const TYPED_CLEAN_CODE_RULES: Rules = {
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-misused-promises': 'error',
  '@typescript-eslint/no-unnecessary-condition': 'error',
  '@typescript-eslint/switch-exhaustiveness-check': ['error', { considerDefaultExhaustiveForUnions: true, requireDefaultForNonUnion: true }],
  '@typescript-eslint/prefer-readonly': 'error',
};

/**
 * Where typescript-eslint strict and the conventions of the kit disagree, the kit wins, for a
 * reason stated on each line. Everything else of the strict presets applies unchanged.
 */
export const KIT_CONVENTIONS: Rules = {
  // A port is asynchronous by contract; its in-memory adapter and its fake have nothing to await.
  '@typescript-eslint/require-await': 'off',
  // The id type of an aggregate is part of its declaration, even when it is the default one.
  '@typescript-eslint/no-unnecessary-type-arguments': 'off',
  // Props are type aliases, states and ports are interfaces: both read well, neither is safer.
  '@typescript-eslint/consistent-type-definitions': 'off',
  // `interface InvoiceRepository extends Repository<Invoice> {}` names a port; `{}` as a type stays forbidden.
  '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'always' }],
  // A domain service or a fake starts empty and is filled with behaviour; a class of statics only stays forbidden.
  '@typescript-eslint/no-extraneous-class': ['error', { allowEmpty: true, allowWithDecorator: true }],
  // An adapter implements the whole signature of its port, whether it reads every parameter or not.
  '@typescript-eslint/no-unused-vars': ['error', { args: 'none', caughtErrors: 'all', ignoreRestSiblings: true }],
  // `process.env['PORT']` is what `noPropertyAccessFromIndexSignature` asks for.
  '@typescript-eslint/dot-notation': ['error', { allowIndexSignaturePropertyAccess: true }],
  '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
  // A count or a port printed in a message is not a coercion bug.
  '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
  '@typescript-eslint/restrict-plus-operands': ['error', { allowNumberAndString: true }],
};

/** The state of an aggregate is replaced by its intention methods: it cannot be readonly, even before the first one is written. */
export const AGGREGATE_RULES: Rules = {
  '@typescript-eslint/prefer-readonly': 'off',
};

/** No output argument where the model lives: a method of the domain or a use case answers or changes itself. */
export const INNER_LAYER_RULES: Rules = {
  'no-param-reassign': ['error', { props: true }],
};

/** A test may hold an untyped probe: it cannot reach production. */
export const TEST_RULES: Rules = {
  '@typescript-eslint/no-explicit-any': 'warn',
  '@typescript-eslint/no-non-null-assertion': 'warn',
  '@typescript-eslint/unbound-method': 'off',
  '@typescript-eslint/no-unsafe-assignment': 'off',
  '@typescript-eslint/no-unsafe-member-access': 'off',
  '@typescript-eslint/no-unsafe-call': 'off',
  '@typescript-eslint/no-unsafe-argument': 'off',
  '@typescript-eslint/no-unsafe-return': 'off',
  '@typescript-eslint/require-await': 'off',
  'ddd-ts-kit/clean-no-escape-hatch': ['error', { typeAssertions: false }],
  complexity: 'off',
};
