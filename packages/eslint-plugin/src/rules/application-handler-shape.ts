import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { className, isCallable, memberName, visibilityOf, type ClassNode } from '../support/classes.js';
import { defineRule } from '../support/define-rule.js';

export const applicationHandlerShape = defineRule<'noHandler' | 'severalClasses' | 'missingExecute' | 'extraPublicMethod'>({
  id: 'application/handler-shape',
  type: 'problem',
  recommended: 'error',
  description: 'A `*.handler.ts` file exports exactly one class whose single public method is `execute`.',
  messages: {
    noHandler: 'This handler file exports no class. Export one class named after the use case, with a single public method `execute`.',
    severalClasses: 'This handler file also exports {{className}}. Keep one handler per file: move {{className}} to its own use case folder.',
    missingExecute: '{{className}} has no public `execute` method. A handler is called by the bus through `execute(command)` or `execute(query)`: name its entry point that way.',
    extraPublicMethod:
      '{{className}} exposes {{name}} besides `execute`. Make it private if it is a step of the use case, or move it to the domain if it is a business decision: a handler has one entry point.',
  },
  create({ file, report }) {
    const { location } = file;
    if (location.area !== 'context' || location.layer !== 'application' || file.isTest || !file.path.endsWith('.handler.ts')) return {};
    return {
      Program(program) {
        const [handler, ...others] = exportedClasses(program);
        if (handler === undefined) {
          report({ loc: { line: 1, column: 0 }, messageId: 'noHandler' });
          return;
        }
        for (const other of others) report({ node: other.id ?? other, messageId: 'severalClasses', data: { className: className(other) } });
        const publicMethods = handler.body.body.filter((member) => isCallable(member) && visibilityOf(member) === 'public');
        const owner = className(handler);
        if (!publicMethods.some((member) => memberName(member) === 'execute')) report({ node: handler.id ?? handler, messageId: 'missingExecute', data: { className: owner } });
        for (const member of publicMethods.filter((candidate) => memberName(candidate) !== 'execute')) {
          report({ node: member, messageId: 'extraPublicMethod', data: { className: owner, name: memberName(member) ?? 'a computed method' } });
        }
      },
    };
  },
});

function exportedClasses(program: TSESTree.Program): ClassNode[] {
  const exportedNames = new Set(program.body.flatMap(exportedLocalNames));
  return program.body.flatMap((statement) => {
    const exportedInline = statement.type === AST_NODE_TYPES.ExportNamedDeclaration || statement.type === AST_NODE_TYPES.ExportDefaultDeclaration;
    const declaration = exportedInline ? statement.declaration : statement;
    if (declaration?.type !== AST_NODE_TYPES.ClassDeclaration) return [];
    return exportedInline || exportedNames.has(declaration.id?.name ?? '') ? [declaration] : [];
  });
}

/** Names exported after their declaration: `export { IssueInvoiceHandler }` and `export default IssueInvoiceHandler`. */
function exportedLocalNames(statement: TSESTree.ProgramStatement): string[] {
  if (statement.type === AST_NODE_TYPES.ExportDefaultDeclaration) return statement.declaration.type === AST_NODE_TYPES.Identifier ? [statement.declaration.name] : [];
  if (statement.type !== AST_NODE_TYPES.ExportNamedDeclaration || statement.source !== null) return [];
  return statement.specifiers.map((specifier) => specifier.local.name);
}
