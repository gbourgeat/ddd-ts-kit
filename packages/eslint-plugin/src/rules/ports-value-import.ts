import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { defineRule } from '../support/rule/define-rule.js';
import { bindingCallReader } from '../support/ports/binding-call-reader.js';
import { dependencyListListener } from '../support/ports/dependency-list-listener.js';
import type { ImportedBinding } from '../support/ports/imported-binding.js';
import { importedBindings } from '../support/ports/imported-bindings.js';

type Source = Readonly<TSESLint.SourceCode>;

const BINDERS = new Set(['bind', 'rebind']);

export const portsValueImport = defineRule<'typeImport'>({
  id: 'ports/value-import',
  type: 'problem',
  recommended: 'error',
  fixable: 'code',
  description: 'A port named in a dependency list or given to bind is imported as a value: the class is the injection token, and a type import erases it.',
  messages: {
    typeImport:
      '{{name}} is used as an injection token but is imported with `import type`. Import it as a value (`import { {{name}} } from ..`): the abstract class is the token, and a type-only import leaves nothing to bind or to resolve when the file runs.',
  },
  create({ file, sourceCode, report }) {
    const imported = importedBindings(file, sourceCode.ast);
    const bindingCall = bindingCallReader(sourceCode.ast);

    const judge = (node: TSESTree.Node | undefined): void => {
      const binding = node?.type === AST_NODE_TYPES.Identifier ? imported.get(node.name) : undefined;

      if (node?.type === AST_NODE_TYPES.Identifier && binding?.typeOnly === true) report({ node, messageId: 'typeImport', data: { name: node.name }, fix: asValueImport(sourceCode, binding) });
    };

    const lists = dependencyListListener(sourceCode.ast, judge);

    return {
      ...lists,
      CallExpression(node) {
        lists.CallExpression?.(node);

        if (BINDERS.has(bindingCall(node) ?? '')) judge(node.arguments[0]);
      },
    };
  },
});

/** `import { type X }` loses its keyword; `import type { X, Y }` becomes `import { X, type Y }`. */
function asValueImport(sourceCode: Source, { declaration, specifier }: ImportedBinding): TSESLint.ReportFixFunction {
  return (fixer) => {
    if (declaration.importKind !== 'type') return typeKeywordOf(sourceCode, specifier).map((keyword) => fixer.removeRange([keyword.range[0], specifier.local.range[0] > keyword.range[1] ? keyword.range[1] + 1 : keyword.range[1]]));

    const others = declaration.specifiers.filter((other) => other !== specifier && other.type === AST_NODE_TYPES.ImportSpecifier);
    const keyword = sourceCode.getFirstToken(declaration, { skip: 1 });

    return keyword === null ? [] : [fixer.removeRange([keyword.range[0], keyword.range[1] + 1]), ...others.map((other) => fixer.insertTextBefore(other, 'type '))];
  };
}

function typeKeywordOf(sourceCode: Source, specifier: TSESTree.ImportClause): TSESTree.Token[] {
  const first = sourceCode.getFirstToken(specifier);

  return first?.value === 'type' ? [first] : [];
}
