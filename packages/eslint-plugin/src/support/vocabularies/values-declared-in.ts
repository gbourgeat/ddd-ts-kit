import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { Location } from '../../project/location';
import type { DeclaredValue } from './declared-value';

/** A source of the project: its path from the root, and where it stands. */
export interface Declaring {
  readonly path: string;
  readonly location: Location;
}

interface Entry {
  readonly key: string;
  readonly value: string;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * The values one parsed source declares: the entries of an exported object `as const` of string
 * values next to the union type of the same name, `export type X = (typeof X)[keyof typeof X]`,
 * comments, either quote and `satisfies` allowed; and the ids of a permission set
 * (`definePermissions('billing', { 'invoice.issue': .. })` declares `billing:invoice.issue`).
 */
export function valuesDeclaredIn(file: Declaring, program: TSESTree.Program): [string, DeclaredValue][] {
  const unions = new Set(program.body.flatMap(unionTypeName));

  return program.body.flatMap(exportedConstant).flatMap(({ name, init }): [string, DeclaredValue][] => {
    if (unions.has(name)) {
      const readBy = readerOf(file.location);

      return objectEntries(asConstObject(init)).map(({ key, value }) => [
        value,
        { written: writtenAs(name, key), vocabulary: name, file: file.path, readBy },
      ]);
    }

    return permissionIds(init).map(({ key, value }) => [
      value,
      { written: `${name}['${key}'].id`, vocabulary: name, file: file.path, readBy: 'everywhere' },
    ]);
  });
}

interface Constant {
  readonly name: string;
  readonly init: TSESTree.Expression;
}

function exportedConstant(statement: TSESTree.ProgramStatement): Constant[] {
  const declaration = statement.type === AST_NODE_TYPES.ExportNamedDeclaration ? statement.declaration : null;

  if (declaration?.type !== AST_NODE_TYPES.VariableDeclaration || declaration.kind !== 'const') {
    return [];
  }

  return declaration.declarations.flatMap(({ id, init }) =>
    id.type === AST_NODE_TYPES.Identifier && init !== null ? [{ name: id.name, init }] : [],
  );
}

/** `export type X = (typeof X)[keyof typeof X]`: the name of the vocabulary it closes. */
function unionTypeName(statement: TSESTree.ProgramStatement): string[] {
  const alias = statement.type === AST_NODE_TYPES.ExportNamedDeclaration ? statement.declaration : null;

  if (alias?.type !== AST_NODE_TYPES.TSTypeAliasDeclaration) {
    return [];
  }

  const { typeAnnotation: type } = alias;
  const name = alias.id.name;

  const closes =
    type.type === AST_NODE_TYPES.TSIndexedAccessType &&
    queries(type.objectType, name) &&
    type.indexType.type === AST_NODE_TYPES.TSTypeOperator &&
    type.indexType.operator === 'keyof' &&
    type.indexType.typeAnnotation !== undefined &&
    queries(type.indexType.typeAnnotation, name);

  return closes ? [name] : [];
}

function queries(type: TSESTree.TypeNode, name: string): boolean {
  return (
    type.type === AST_NODE_TYPES.TSTypeQuery &&
    type.exprName.type === AST_NODE_TYPES.Identifier &&
    type.exprName.name === name
  );
}

/** `{ .. } as const`, or `{ .. } as const satisfies ..`. */
function asConstObject(init: TSESTree.Expression): TSESTree.ObjectExpression | undefined {
  const asserted = init.type === AST_NODE_TYPES.TSSatisfiesExpression ? init.expression : init;

  const isConst =
    asserted.type === AST_NODE_TYPES.TSAsExpression &&
    asserted.typeAnnotation.type === AST_NODE_TYPES.TSTypeReference &&
    asserted.typeAnnotation.typeName.type === AST_NODE_TYPES.Identifier &&
    asserted.typeAnnotation.typeName.name === 'const';

  return isConst && asserted.expression.type === AST_NODE_TYPES.ObjectExpression ? asserted.expression : undefined;
}

/** Every entry, or none when one of them is not a key with a string value: the object is then not a vocabulary. */
function objectEntries(object: TSESTree.ObjectExpression | undefined): Entry[] {
  const entries = (object?.properties ?? []).map(entryOf);

  return entries.every((entry): entry is Entry => entry !== undefined) ? entries : [];
}

function entryOf(property: TSESTree.ObjectLiteralElement): Entry | undefined {
  const key = property.type === AST_NODE_TYPES.Property && !property.computed ? keyOf(property.key) : undefined;
  const value = property.type === AST_NODE_TYPES.Property ? stringOf(property.value) : undefined;

  return key === undefined || value === undefined ? undefined : { key, value };
}

function permissionIds(init: TSESTree.Expression): Entry[] {
  const [context, permissions] = definesPermissions(init) ? init.arguments : [];
  const prefix = context === undefined ? undefined : stringOf(context);

  if (prefix === undefined || permissions?.type !== AST_NODE_TYPES.ObjectExpression) {
    return [];
  }

  return permissions.properties.flatMap((property) => {
    const key = property.type === AST_NODE_TYPES.Property ? keyOf(property.key) : undefined;

    return key === undefined ? [] : [{ key, value: `${prefix}:${key}` }];
  });
}

function definesPermissions(init: TSESTree.Expression): init is TSESTree.CallExpression {
  return (
    init.type === AST_NODE_TYPES.CallExpression &&
    init.callee.type === AST_NODE_TYPES.Identifier &&
    init.callee.name === 'definePermissions'
  );
}

function keyOf(key: TSESTree.Node): string | undefined {
  return key.type === AST_NODE_TYPES.Identifier ? key.name : stringOf(key);
}

function stringOf(node: TSESTree.Node): string | undefined {
  if (node.type === AST_NODE_TYPES.Literal) {
    return typeof node.value === 'string' ? node.value : undefined;
  }

  const [only] = node.type === AST_NODE_TYPES.TemplateLiteral && node.expressions.length === 0 ? node.quasis : [];

  return only?.value.cooked ?? undefined;
}

function writtenAs(name: string, key: string): string {
  return IDENTIFIER.test(key) ? `${name}.${key}` : `${name}['${key}']`;
}

/** A context speaks its own language; the shared kernel is read by every layer; the platform by itself and by the edges of the contexts. */
function readerOf(location: Location): DeclaredValue['readBy'] {
  if (location.area === 'context') {
    return { context: location.context };
  }

  return location.area === 'shared-kernel' ? 'everywhere' : 'platform';
}
