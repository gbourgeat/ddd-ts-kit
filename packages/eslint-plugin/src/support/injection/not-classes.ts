import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';

const KINDS: Readonly<Partial<Record<AST_NODE_TYPES, string>>> = {
  [AST_NODE_TYPES.TSInterfaceDeclaration]: 'an interface',
  [AST_NODE_TYPES.TSTypeAliasDeclaration]: 'a type alias',
  [AST_NODE_TYPES.TSEnumDeclaration]: 'an enum',
};

/** The names a program declares at its top level as an interface, a type alias or an enum, with what each is. */
export function notClasses(program: TSESTree.Program): ReadonlyMap<string, string> {
  const declared = program.body.flatMap((statement): [string, string][] => {
    const declaration =
      statement.type === AST_NODE_TYPES.ExportNamedDeclaration && statement.declaration !== null
        ? statement.declaration
        : statement;

    const what = KINDS[declaration.type];

    return what !== undefined && 'id' in declaration && declaration.id?.type === AST_NODE_TYPES.Identifier
      ? [[declaration.id.name, what]]
      : [];
  });

  return new Map(declared);
}
