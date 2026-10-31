import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { ambientName } from '../globals/ambient-name';
import { propertyName } from '../globals/property-name';

/** The functions of a test runner that declare a test, Vitest and Jest alike. */
const TESTS = new Set(['it', 'test']);

/** The functions that declare a group of tests. */
const GROUPS = new Set(['describe', 'suite']);

/** The focused and the skipped forms Jest kept from Jasmine: `fit`, `xit`, `xdescribe`. */
const PREFIXED = /^[fx](it|test|describe)$/;

/** What a runner chains on `it` or `describe` before the title: `it.each(rows)(title, fn)`, `describe.skip(title, fn)`. */
const MODIFIERS = new Set([
  'each',
  'for',
  'skip',
  'only',
  'todo',
  'concurrent',
  'sequential',
  'shuffle',
  'skipIf',
  'runIf',
  'fails',
]);

/** The modifiers that take their own arguments first, the title and the body coming in a second call. */
const CURRIED = new Set(['each', 'for', 'skipIf', 'runIf']);

/** A test or a group of tests a call declares. */
export interface TestCall {
  readonly kind: 'test' | 'group';
  /** The function of the runner the call is made under: `it`, `test`, `describe`, `suite`, `fit`, `xit`, `xdescribe`. */
  readonly root: string;
  /** The modifiers chained on it, in order: `['concurrent', 'only']`, `['each']`. */
  readonly modifiers: readonly string[];
  /** Where a report on the declaration points: `it.only`, `describe.each(rows)`. */
  readonly head: TSESTree.Node;
  readonly title: TSESTree.CallExpressionArgument | undefined;
  readonly body: TSESTree.CallExpressionArgument | undefined;
}

interface Head {
  readonly root: TSESTree.Identifier;
  readonly modifiers: readonly string[];
}

/**
 * The test or the group `node` declares, when it is one: `it(title, fn)`, `describe.each(rows)(title, fn)`,
 * `test.todo(title)`, `xit(title, fn)`, also under an alias of the runner (`import { it as scenario }`).
 * Nothing for `it.each(rows)` alone, whose own call declares the test, nor when `it` is a local of
 * the file instead of the runner's.
 */
export function testCall(
  sourceCode: Readonly<TSESLint.SourceCode>,
  node: TSESTree.CallExpression,
): TestCall | undefined {
  const head = headOf(node.callee);

  if (head === undefined) {
    return undefined;
  }

  const { root, modifiers } = head;
  const runner = ambientName(sourceCode, root);
  const kind = runner === undefined ? undefined : kindOf(runner);

  if (runner === undefined || kind === undefined) {
    return undefined;
  }

  const [title, body] = node.arguments;

  return { kind, root: runner, modifiers, head: node.callee, title, body };
}

/** The runner function and the modifiers a callee chains, or nothing when the chain holds anything else. */
function headOf(callee: TSESTree.Expression): Head | undefined {
  if (callee.type === AST_NODE_TYPES.Identifier) {
    return { root: callee, modifiers: [] };
  }

  if (callee.type === AST_NODE_TYPES.CallExpression) {
    const inner = chainOf(callee.callee);

    return inner !== undefined && CURRIED.has(inner.modifiers.at(-1) ?? '') ? inner : undefined;
  }

  const chain = chainOf(callee);

  return chain !== undefined && !CURRIED.has(chain.modifiers.at(-1) ?? '') ? chain : undefined;
}

/** `it.concurrent.only` read as its root and its modifiers. */
function chainOf(callee: TSESTree.Expression): Head | undefined {
  const modifiers: string[] = [];
  let current: TSESTree.Expression = callee;

  while (current.type === AST_NODE_TYPES.MemberExpression) {
    const name = propertyName(current);

    if (name === undefined || !MODIFIERS.has(name)) {
      return undefined;
    }

    modifiers.unshift(name);
    current = current.object;
  }

  return current.type === AST_NODE_TYPES.Identifier ? { root: current, modifiers } : undefined;
}

function kindOf(root: string): TestCall['kind'] | undefined {
  const bare = PREFIXED.exec(root)?.[1] ?? root;

  if (TESTS.has(bare)) {
    return 'test';
  }

  return GROUPS.has(bare) ? 'group' : undefined;
}
