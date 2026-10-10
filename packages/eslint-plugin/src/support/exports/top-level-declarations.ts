import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { DeclarationKind, TopLevelDeclaration } from './top-level-declaration.js';

type Found = Omit<TopLevelDeclaration, 'exported'>;

const KINDS: Readonly<Partial<Record<AST_NODE_TYPES, DeclarationKind>>> = {
  [AST_NODE_TYPES.ClassDeclaration]: 'class',
  [AST_NODE_TYPES.TSInterfaceDeclaration]: 'interface',
  [AST_NODE_TYPES.FunctionDeclaration]: 'function',
  [AST_NODE_TYPES.TSDeclareFunction]: 'function',
  [AST_NODE_TYPES.TSTypeAliasDeclaration]: 'type',
  [AST_NODE_TYPES.TSEnumDeclaration]: 'other',
  [AST_NODE_TYPES.TSModuleDeclaration]: 'other',
};

/** What a module declares at its top, with whether it exports it: inline, by `export { a }` or by `export default a`. */
export function topLevelDeclarations(program: TSESTree.Program): TopLevelDeclaration[] {
  const later = new Set(program.body.flatMap(namesExportedLater));

  return program.body.flatMap((statement) => {
    const inline = isInlineExport(statement);
    const declared = inline ? statement.declaration : statement;

    return declared === null
      ? []
      : declarationsOf(declared).map((found) => ({ ...found, exported: inline || later.has(found.name) }));
  });
}

function isInlineExport(
  statement: TSESTree.ProgramStatement,
): statement is TSESTree.ExportNamedDeclaration | TSESTree.ExportDefaultDeclaration {
  return (
    statement.type === AST_NODE_TYPES.ExportNamedDeclaration ||
    statement.type === AST_NODE_TYPES.ExportDefaultDeclaration
  );
}

function declarationsOf(node: TSESTree.Node): Found[] {
  if (node.type === AST_NODE_TYPES.VariableDeclaration) {
    return node.declarations.flatMap(variableOf);
  }

  const kind = KINDS[node.type];
  const name = 'id' in node && node.id?.type === AST_NODE_TYPES.Identifier ? node.id.name : 'default';

  return kind === undefined ? [] : [{ name, kind, node }];
}

function variableOf(declarator: TSESTree.VariableDeclarator): Found[] {
  return declarator.id.type === AST_NODE_TYPES.Identifier
    ? [{ name: declarator.id.name, kind: 'variable', node: declarator }]
    : [];
}

function namesExportedLater(statement: TSESTree.ProgramStatement): string[] {
  if (statement.type === AST_NODE_TYPES.ExportDefaultDeclaration) {
    return statement.declaration.type === AST_NODE_TYPES.Identifier ? [statement.declaration.name] : [];
  }

  if (statement.type !== AST_NODE_TYPES.ExportNamedDeclaration || statement.source !== null) {
    return [];
  }

  return statement.specifiers.map((specifier) => specifier.local.name);
}
