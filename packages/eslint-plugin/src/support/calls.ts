import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { keyName } from './classes.js';
import { propertyName } from './globals.js';
import { staticString } from './imports.js';

export interface ChainLink {
  readonly name: string;
  readonly call: TSESTree.CallExpression;
}

/** `builder.command(X).requires(p).handledBy(H)` read from its last call: `command`, `requires`, `handledBy`. */
export function methodChain(last: TSESTree.CallExpression): ChainLink[] {
  const links: ChainLink[] = [];
  let current: TSESTree.Node = last;
  while (current.type === AST_NODE_TYPES.CallExpression && current.callee.type === AST_NODE_TYPES.MemberExpression) {
    links.unshift({ name: propertyName(current.callee) ?? '', call: current });
    current = current.callee.object;
  }
  return links;
}

/** The name a call is made under: `resolve` for `resolve(x)`, `bind` for `builder.bind(x)`. */
export function calleeName(node: TSESTree.CallExpression | TSESTree.NewExpression): string | undefined {
  const { callee } = node;
  if (callee.type === AST_NODE_TYPES.Identifier) return callee.name;
  return callee.type === AST_NODE_TYPES.MemberExpression ? propertyName(callee) : undefined;
}

/** The last name of an access: `access` for `access`, `this.access` and `this.#access` (with its hash). */
export function accessedName(node: TSESTree.Node): string | undefined {
  if (node.type === AST_NODE_TYPES.Identifier) return node.name;
  if (node.type !== AST_NODE_TYPES.MemberExpression) return undefined;
  return node.computed ? propertyName(node) : keyName(node.property);
}

export function propertyOf(object: TSESTree.ObjectExpression, key: string): TSESTree.Property | undefined {
  return object.properties.filter((property) => property.type === AST_NODE_TYPES.Property).find((property) => !property.computed && keyName(property.key) === key);
}

/** With `{ ...defaults }` a key may be there without being written: the object cannot be judged for what it lacks. */
export function hasSpread(object: TSESTree.ObjectExpression): boolean {
  return object.properties.some((property) => property.type === AST_NODE_TYPES.SpreadElement);
}

/**
 * The keys of `required` an options argument visibly lacks. An argument that is not an object
 * literal, or that spreads another object, is not judged: nothing is reported as missing.
 */
export function missingKeys(options: TSESTree.Node | undefined, required: readonly string[]): string[] {
  if (options === undefined) return [...required];
  if (options.type !== AST_NODE_TYPES.ObjectExpression || hasSpread(options)) return [];
  return required.filter((key) => !isGiven(propertyOf(options, key)));
}

function isGiven(property: TSESTree.Property | undefined): boolean {
  if (property === undefined) return false;
  const { value } = property;
  if (value.type === AST_NODE_TYPES.Identifier && value.name === 'undefined') return false;
  return staticString(value) !== '';
}
