import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { constructorOf } from './classes/constructor-of';
import type { ClassNode } from './classes/class-name';
import { descendants } from './descendants';
import { parameterName } from './members/parameter-name';
import { parameterProperties } from './members/parameter-properties';

type Source = Readonly<TSESLint.SourceCode>;
type Private = TSESTree.PrivateIdentifier;

/**
 * The rewriting of every `#name` of one class into a `private name`, or undefined when it is
 * not safe: the class already has a member called `name`, the file tests `#name in value`,
 * another class declares the same `#name`, or a use is not `this.#name` or `<identifier>.#name`
 * inside the class.
 */
export function hashPrivateFix(
  sourceCode: Source,
  owner: ClassNode,
  name: string,
): TSESLint.ReportFixFunction | undefined {
  const all = [...descendants(sourceCode.ast)].filter(
    (node): node is Private => node.type === AST_NODE_TYPES.PrivateIdentifier && node.name === name,
  );

  const keys = all.filter((node) => isMemberKey(node));
  const uses = all.filter((node) => !isMemberKey(node));

  const safe =
    keys.every((key) => key.parent.parent === owner.body) &&
    uses.every((use) => isPlainUse(use, owner)) &&
    !hasMemberNamed(owner, name);

  if (!safe) {
    return undefined;
  }

  return (fixer) => [
    ...keys.flatMap((key) => [
      fixer.insertTextBefore(firstModifier(sourceCode, key), 'private '),
      fixer.replaceText(key, name),
    ]),
    ...uses.map((use) => fixer.replaceText(use, name)),
  ];
}

function isMemberKey(node: Private): boolean {
  return node.parent.type !== AST_NODE_TYPES.MemberExpression && node.parent.type !== AST_NODE_TYPES.BinaryExpression;
}

function isPlainUse(use: Private, owner: ClassNode): boolean {
  const access = use.parent;

  if (
    access.type !== AST_NODE_TYPES.MemberExpression ||
    use.range[0] < owner.range[0] ||
    use.range[1] > owner.range[1]
  ) {
    return false;
  }

  return access.object.type === AST_NODE_TYPES.ThisExpression || access.object.type === AST_NODE_TYPES.Identifier;
}

function hasMemberNamed(owner: ClassNode, name: string): boolean {
  const members = owner.body.body.some(
    (member) =>
      'key' in member && !member.computed && member.key.type === AST_NODE_TYPES.Identifier && member.key.name === name,
  );

  return (
    members || parameterProperties(constructorOf(owner.body)).some((parameter) => parameterName(parameter) === name)
  );
}

/** `private` goes before `static`, `readonly`, `async`, `get`, and after the decorators. */
function firstModifier(sourceCode: Source, key: Private): TSESTree.Node | TSESTree.Token {
  const member = key.parent;
  const last = 'decorators' in member ? member.decorators.at(-1) : undefined;

  return (last === undefined ? sourceCode.getFirstToken(member) : sourceCode.getTokenAfter(last)) ?? key;
}
