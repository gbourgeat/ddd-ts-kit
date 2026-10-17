import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { typeRootName } from './type-root-name.js';

const WRAPPERS = new Set(['Readonly', 'Partial', 'Required']);

/**
 * Whether the type of a string literal says it is a word of another language, one of `names`
 * (the names a file reads from another language): the literal is written `'x' satisfies T`, or it
 * is a key of an object typed `Record<T, ..>` or the whole value of an entry of one typed
 * `Record<.., T>`, by the annotation of its declaration or by `satisfies`. `T` is one reference.
 */
export function typedByOtherLanguage(node: TSESTree.Node, names: ReadonlyMap<string, string>): boolean {
  const type = satisfiedBy(node) ?? tableSide(node);
  const root = type === undefined ? undefined : typeRootName(type);

  return root !== undefined && names.has(root);
}

/** The type an expression is written to satisfy: `T` in `x satisfies T`. */
function satisfiedBy(expression: TSESTree.Node): TSESTree.TypeNode | undefined {
  const { parent } = expression;

  return parent?.type === AST_NODE_TYPES.TSSatisfiesExpression && parent.expression === expression
    ? parent.typeAnnotation
    : undefined;
}

/** The key type of the table a literal is a key of, or its value type when the literal is the value of an entry. */
function tableSide(node: TSESTree.Node): TSESTree.TypeNode | undefined {
  const entry = entryOf(node);
  const isKey = entry?.key === node && !entry.computed;
  const record = isKey || entry?.value === node ? recordArguments(tableType(entry.parent)) : undefined;

  return isKey ? record?.[0] : record?.[1];
}

/** The entry of an object literal a node is written in directly, a method or an accessor left out. */
function entryOf(node: TSESTree.Node): TSESTree.Property | undefined {
  const { parent } = node;

  return parent?.type === AST_NODE_TYPES.Property &&
    parent.parent.type === AST_NODE_TYPES.ObjectExpression &&
    parent.kind === 'init' &&
    !parent.method
    ? parent
    : undefined;
}

/** The type of an object: the annotation of what it initializes, or what it satisfies, `as const` or not. */
function tableType(object: TSESTree.Node): TSESTree.TypeNode | undefined {
  const { parent } = object;

  if (parent?.type === AST_NODE_TYPES.TSAsExpression) {
    return isConstAssertion(parent) ? satisfiedBy(parent) : undefined;
  }

  return satisfiedBy(object) ?? annotated(object)?.typeAnnotation?.typeAnnotation;
}

/** What holds the annotation of the declaration an object initializes: a variable, a class field or a parameter with a default. */
function annotated(
  object: TSESTree.Node,
): { readonly typeAnnotation?: TSESTree.TSTypeAnnotation | undefined } | undefined {
  const { parent } = object;

  switch (parent?.type) {
    case AST_NODE_TYPES.VariableDeclarator:
      return parent.init === object ? parent.id : undefined;
    case AST_NODE_TYPES.PropertyDefinition:
    case AST_NODE_TYPES.AccessorProperty:
      return parent.value === object ? parent : undefined;
    case AST_NODE_TYPES.AssignmentPattern:
      return parent.right === object ? parent.left : undefined;
    default:
      return undefined;
  }
}

function isConstAssertion(assertion: TSESTree.TSAsExpression): boolean {
  const { typeAnnotation } = assertion;

  return (
    typeAnnotation.type === AST_NODE_TYPES.TSTypeReference &&
    typeAnnotation.typeName.type === AST_NODE_TYPES.Identifier &&
    typeAnnotation.typeName.name === 'const'
  );
}

/**
 * The key and the value types of `Record<K, V>`, when `type` is one, alone or wrapped whole in
 * `Readonly`, `Partial` or `Required`: `Readonly<Record<K, V>> & Other` is not one.
 */
function recordArguments(
  type: TSESTree.TypeNode | undefined,
): readonly [TSESTree.TypeNode, TSESTree.TypeNode] | undefined {
  let current = type;

  while (current !== undefined && WRAPPERS.has(referenceName(current) ?? '')) {
    const [only, ...more] = typeArguments(current);

    current = more.length === 0 ? only : undefined;
  }

  const [key, value, ...more] =
    current !== undefined && referenceName(current) === 'Record' ? typeArguments(current) : [];

  return key !== undefined && value !== undefined && more.length === 0 ? [key, value] : undefined;
}

function referenceName(type: TSESTree.TypeNode): string | undefined {
  return type.type === AST_NODE_TYPES.TSTypeReference && type.typeName.type === AST_NODE_TYPES.Identifier
    ? type.typeName.name
    : undefined;
}

function typeArguments(type: TSESTree.TypeNode): readonly TSESTree.TypeNode[] {
  return type.type === AST_NODE_TYPES.TSTypeReference ? (type.typeArguments?.params ?? []) : [];
}
