import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../project/linted-file';
import { defineRule } from '../support/rule/define-rule';
import { inSourceRoot } from '../support/imports/in-source-root';
import { BOUNDARY_NAMES } from '../support/standard-interfaces/boundary-names';
import { parallelNames } from '../support/standard-interfaces/parallel-names';
import { standardNamesIn } from '../support/standard-interfaces/standard-names-in';

type Declaration = TSESTree.ClassDeclaration | TSESTree.TSInterfaceDeclaration | TSESTree.TSTypeAliasDeclaration;

export const standardNoParallelInterface = defineRule<'parallel'>({
  id: 'standard/no-parallel-interface',
  type: 'suggestion',
  recommended: 'warn',
  description:
    'No home-made copy of a standard interface of the kernel (ILogger, UserContext, PaginatedResult): use the kernel one and extend it by declaration merging.',
  messages: {
    parallel:
      '{{name}} is a home-made copy of a standard interface: use {{instead}}. Standard interfaces come from @ddd-ts-kit/kernel: import the one named here, and add the fields of the project by declaration merging of the extension interface it leaves open (SessionExtensions, ExecutionContextExtensions, ActorExtensions, LogFields, MetricLabels); an implementation is a class named after its technology (`PinoLogger implements Logger`).',
  },
  create({ file, report }) {
    if (file.isTest || !inSourceRoot(file)) {
      return {};
    }

    const names = parallelNames(file.config.standardInterfaces);

    const judge = (node: Declaration): void => {
      const name = node.id?.name ?? '';
      const instead = names.get(name);

      if (
        instead === undefined ||
        node.id === null ||
        isAtTheBoundary(file, name) ||
        isImplementation(node, standardNamesIn(instead))
      ) {
        return;
      }

      report({ node: node.id, messageId: 'parallel', data: { name, instead } });
    };

    return { ClassDeclaration: judge, TSInterfaceDeclaration: judge, TSTypeAliasDeclaration: judge };
  },
});

function isAtTheBoundary({ location }: LintedFile, name: string): boolean {
  if (!BOUNDARY_NAMES.includes(name)) {
    return false;
  }

  return location.area === 'platform' || (location.area === 'context' && location.layer === 'presentation');
}

/** A class that implements or extends the standard interface is an implementation of it, not a second interface. */
function isImplementation(node: Declaration, standardNames: readonly string[]): boolean {
  if (node.type !== AST_NODE_TYPES.ClassDeclaration) {
    return false;
  }

  const heritage = [node.superClass, ...node.implements.map((port) => port.expression)];

  return heritage.some((type) => type !== null && standardNames.includes(lastName(type) ?? ''));
}

/** `Logger` for `Logger` and for `kernel.Logger`. */
function lastName(type: TSESTree.Expression): string | undefined {
  if (type.type === AST_NODE_TYPES.Identifier) {
    return type.name;
  }

  return type.type === AST_NODE_TYPES.MemberExpression && type.property.type === AST_NODE_TYPES.Identifier
    ? type.property.name
    : undefined;
}
