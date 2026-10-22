import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { descendants } from '../descendants';

/** Generic types of the language, and the stored shapes the kit keeps readable across its releases. */
const NOT_DECLARED = new Set([
  ...['Array', 'ReadonlyArray', 'Readonly', 'Record', 'Partial', 'Required', 'Pick', 'Omit', 'NonNullable', 'Date'],
  'PersonalValue',
]);

/**
 * The named types the data type `root` reaches, through the declarations of the file, that the
 * file does not declare: a change of theirs would change the stored shape and not its fingerprint.
 */
export function unresolvedTypes(root: string, declared: ReadonlyMap<string, TSESTree.Node>): string[] {
  const unresolved: string[] = [];
  const seen = new Set([root]);
  const pending = referencesOf(declared.get(root));

  for (let name = pending.shift(); name !== undefined; name = pending.shift()) {
    if (seen.has(name) || NOT_DECLARED.has(name)) {
      continue;
    }

    seen.add(name);

    const declaration = declared.get(name);

    if (declaration === undefined) {
      unresolved.push(name);
    } else {
      pending.push(...referencesOf(declaration));
    }
  }

  return unresolved;
}

/** The names of the types a declaration uses, its own type parameters aside; the members of an enum are values, never types. */
function referencesOf(declaration: TSESTree.Node | undefined): string[] {
  if (declaration === undefined || declaration.type === AST_NODE_TYPES.TSEnumDeclaration) {
    return [];
  }

  const parameters = new Set(
    [...descendants(declaration)].flatMap((node) =>
      node.type === AST_NODE_TYPES.TSTypeParameter ? [node.name.name] : [],
    ),
  );

  return namedIn(declaration).filter((name) => !parameters.has(name));
}

function namedIn(declaration: TSESTree.Node): string[] {
  return [...descendants(declaration)].flatMap((node) => {
    if (node.type === AST_NODE_TYPES.TSTypeReference && node.typeName.type === AST_NODE_TYPES.Identifier) {
      return [node.typeName.name];
    }

    return node.type === AST_NODE_TYPES.TSInterfaceHeritage && node.expression.type === AST_NODE_TYPES.Identifier
      ? [node.expression.name]
      : [];
  });
}
