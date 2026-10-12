import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../project/linted-file.js';
import type { ImportTarget } from '../project/resolve-import.js';
import type { ClassNode } from '../support/classes/class-name.js';
import { constructorOf } from '../support/classes/constructor-of.js';
import { ACCESS_DECORATORS } from '../support/declarations/access-decorators.js';
import { declarationReader } from '../support/declarations/declaration-reader.js';
import { declaredRoleOf } from '../support/declarations/declared-role-of.js';
import { isDeclaredStyle } from '../support/declarations/is-declared-style.js';
import { dependencyListListener } from '../support/ports/dependency-list-listener.js';
import type { ImportedBinding } from '../support/ports/imported-binding.js';
import { importedBindings } from '../support/ports/imported-bindings.js';
import { defineRule, type Report } from '../support/rule/define-rule.js';

type MessageId = 'concrete' | 'typed';

export const portsNoConcreteDependency = defineRule<MessageId>({
  id: 'ports/no-concrete-dependency',
  type: 'problem',
  recommended: 'error',
  description:
    'A dependency is named by its port, never by the class that implements one: nothing imported from infrastructure/ or from test/fakes/ in a dependency list, nor as the type of a constructor parameter of a declared class.',
  messages: {
    concrete:
      '{{name}} is named in a dependency list but comes from {{where}}: a list names ports, never what implements them. Name the port (the abstract class of domain/repositories or application/ports that {{name}} implements) and let the declaration of the adapter, the module file or a `fake(Port, ..)` of the test say which class stands behind it.',
    typed:
      '{{name}} types a constructor parameter of a declared class but comes from {{where}}: a parameter is typed by a port, never by what implements it. Type it by the port (the abstract class of domain/repositories or application/ports that {{name}} implements): the adapter, or a `fake(Port, ..)` of the test, is bound to that port at the composition root.',
  },
  create({ file, sourceCode, report }) {
    const imported = importedBindings(file, sourceCode.ast);

    const lists = dependencyListListener(sourceCode.ast, (dependency) => {
      const where = concretePlace(imported.get(dependency.name)?.target);

      if (where !== undefined) {
        report({ node: dependency, messageId: 'concrete', data: { name: dependency.name, where } });
      }
    });

    const judgeClass = signatureJudge(file, sourceCode.ast, { imported, report });

    return {
      ...lists,
      ClassDeclaration(node) {
        lists.ClassDeclaration?.(node);
        judgeClass(node);
      },
      ClassExpression(node) {
        lists.ClassExpression?.(node);
        judgeClass(node);
      },
    };
  },
});

interface Judging {
  readonly imported: ReadonlyMap<string, ImportedBinding>;
  readonly report: Report<MessageId>;
}

/** A declared class that lists nothing states its dependencies in its constructor: its parameter types are the list. */
function signatureJudge(
  file: LintedFile,
  program: TSESTree.Program,
  { imported, report }: Judging,
): (node: ClassNode) => void {
  if (file.isTest || !isDeclaredStyle(file) || declaredRoleOf(file) === undefined) {
    return () => undefined;
  }

  const declarationsOf = declarationReader(program);

  return (node) => {
    const [declaration] = declarationsOf(node).filter(({ name }) => !ACCESS_DECORATORS.has(name));

    if (declaration === undefined || declaration.arguments.at(-1)?.type === AST_NODE_TYPES.ArrayExpression) {
      return;
    }

    for (const type of parameterTypes(constructorOf(node.body))) {
      const where = concretePlace(imported.get(type.name)?.target);

      if (where !== undefined) {
        report({ node: type, messageId: 'typed', data: { name: type.name, where } });
      }
    }
  };
}

/** The class name each parameter of a constructor is typed by, when it is typed by one. */
function parameterTypes(written: TSESTree.MethodDefinition | undefined): TSESTree.Identifier[] {
  return (written?.value.params ?? []).flatMap((node) => {
    const parameter = node.type === AST_NODE_TYPES.TSParameterProperty ? node.parameter : node;
    const type = parameter.type === AST_NODE_TYPES.Identifier ? parameter.typeAnnotation?.typeAnnotation : undefined;

    return type?.type === AST_NODE_TYPES.TSTypeReference && type.typeName.type === AST_NODE_TYPES.Identifier
      ? [type.typeName]
      : [];
  });
}

function concretePlace(target: ImportTarget | undefined): string | undefined {
  if (target?.kind !== 'file' || target.location.area !== 'context') {
    return undefined;
  }

  const { layer, inside } = target.location;

  if (layer === 'infrastructure') {
    return 'infrastructure/';
  }

  return layer === 'test' && inside[0] === 'fakes' ? 'test/fakes/' : undefined;
}
