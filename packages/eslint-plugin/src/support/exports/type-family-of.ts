import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { ModuleShape } from './module-shape.js';

/**
 * The one type every exported function of the module returns, when there is one: a type with
 * its constructors or its combinators. The type is declared by the module or imported by it; a
 * function may return a member of the union when the type is a union the module declares.
 */
export function typeFamilyOf(shape: ModuleShape): string | undefined {
  const functions = shape.exports.filter((declaration) => declaration.kind === 'function');
  const returned = functions.map((declaration) => returnedTypeName(declaration.node));
  const [first] = returned;

  if (first === undefined) {
    return undefined;
  }

  const declared = shape.exports
    .filter((declaration) => declaration.kind !== 'function' && declaration.kind !== 'variable')
    .map((declaration) => declaration.name);

  return [...declared, first].find(
    (type) =>
      isKnown(shape, type) && returned.every((name) => name !== undefined && membersOf(shape, type).includes(name)),
  );
}

function returnedTypeName(node: TSESTree.Node): string | undefined {
  const type = 'returnType' in node ? node.returnType?.typeAnnotation : undefined;

  return type?.type === AST_NODE_TYPES.TSTypeReference && type.typeName.type === AST_NODE_TYPES.Identifier
    ? type.typeName.name
    : undefined;
}

/** A global such as `Promise` or `Map` is nobody's family. */
function isKnown(shape: ModuleShape, type: string): boolean {
  const imported = shape.program.body.some(
    (statement) =>
      statement.type === AST_NODE_TYPES.ImportDeclaration &&
      statement.specifiers.some((specifier) => specifier.local.name === type),
  );

  return imported || shape.declarations.some((declaration) => declaration.name === type);
}

function membersOf(shape: ModuleShape, type: string): string[] {
  const aliases = shape.declarations.flatMap((declaration) =>
    declaration.name === type && declaration.node.type === AST_NODE_TYPES.TSTypeAliasDeclaration
      ? [declaration.node.typeAnnotation]
      : [],
  );

  const members = aliases.flatMap((alias) => (alias.type === AST_NODE_TYPES.TSUnionType ? alias.types : []));

  return [
    type,
    ...members.flatMap((member) =>
      member.type === AST_NODE_TYPES.TSTypeReference && member.typeName.type === AST_NODE_TYPES.Identifier
        ? [member.typeName.name]
        : [],
    ),
  ];
}
