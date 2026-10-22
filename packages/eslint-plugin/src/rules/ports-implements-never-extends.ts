import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { calleeName } from '../support/calls/callee-name';
import { className, type ClassNode } from '../support/classes/class-name';
import { declarationReader } from '../support/declarations/declaration-reader';
import { defineRule, type Report } from '../support/rule/define-rule';
import { inContext } from '../support/imports/in-context';
import { importedBindings } from '../support/ports/imported-bindings';
import { isPortFile } from '../support/ports/is-port-file';
import { classFinder, type ClassFinder } from '../support/classes/class-finder';

type MessageId = 'notImplemented' | 'extended';
type Finding = TSESLint.ReportDescriptor<MessageId>;

const ADAPTER_DECLARATIONS = new Set(['Repository', 'Gateway', 'Adapter']);
const BINDERS = new Set(['bind', 'rebind']);

export const portsImplementsNeverExtends = defineRule<MessageId>({
  id: 'ports/implements-never-extends',
  type: 'problem',
  recommended: 'error',
  description: 'An adapter implements its port and never extends it: the port is a contract, not a base class.',
  messages: {
    notImplemented:
      '{{className}} is the adapter of {{port}} but does not implement it. Write `class {{className}} implements {{port}}`: the compiler then checks the adapter against the port, and a reader sees which contract the class honours.',
    extended:
      '{{className}} extends {{port}}, which is a port. Write `class {{className}} implements {{port}}`: a port has abstract members only and is never a base class, so that a fake, an in-memory class or a remote client fits the same contract.',
  },
  create({ file, sourceCode, context, report }) {
    const declarationsOf = declarationReader(sourceCode.ast);
    const findClass = classFinder(file, sourceCode.ast, context.languageOptions.parser);
    const imported = importedBindings(file, sourceCode.ast);
    const isAdapterLayer = inContext(file)?.layer === 'infrastructure' && !file.isTest;

    const importedPort = (node: ClassNode): TSESTree.Identifier[] => {
      const parent = node.superClass?.type === AST_NODE_TYPES.Identifier ? node.superClass : undefined;
      const target = parent === undefined ? undefined : imported.get(parent.name)?.target;

      return parent !== undefined && isAdapterLayer && target?.kind === 'file' && isPortFile(file.config, target.path)
        ? [parent]
        : [];
    };

    const judgeClass = (node: ClassNode): void => {
      const ports = declarationsOf(node).flatMap((declaration) =>
        ADAPTER_DECLARATIONS.has(declaration.name) ? portNames(declaration.arguments[0]) : [],
      );

      const findings = ports.flatMap((port) => defectsOf(node, port, node.id ?? node));
      const extended = findings.length > 0 ? [] : importedPort(node);

      for (const parent of extended) {
        report({ node: parent, messageId: 'extended', data: { className: className(node), port: parent.name } });
      }

      findings.forEach(report);
    };

    return {
      ClassDeclaration: judgeClass,
      ClassExpression: judgeClass,
      CallExpression: (node) => judgeBinding(node, findClass, report),
    };
  },
});

function judgeBinding(node: TSESTree.CallExpression, findClass: ClassFinder, report: Report<MessageId>): void {
  const [bound] = boundPair(node);
  const [implementation] = node.arguments;

  const site =
    bound === undefined || implementation?.type !== AST_NODE_TYPES.Identifier || implementation.name === bound
      ? undefined
      : findClass(implementation.name);

  if (bound !== undefined && site !== undefined) {
    defectsOf(site.node, bound, implementation ?? node).forEach(report);
  }
}

function portNames(port: TSESTree.Node | undefined): string[] {
  return port?.type === AST_NODE_TYPES.Identifier ? [port.name] : [];
}

/** `bind(Port).toClass(..)` and `rebind(Port).toClass(..)`, plain or on a builder: the name of the port. */
function boundPair(node: TSESTree.CallExpression): string[] {
  const { callee } = node;

  if (
    callee.type !== AST_NODE_TYPES.MemberExpression ||
    calleeName(node) !== 'toClass' ||
    callee.object.type !== AST_NODE_TYPES.CallExpression
  ) {
    return [];
  }

  return BINDERS.has(calleeName(callee.object) ?? '') ? portNames(callee.object.arguments[0]) : [];
}

function defectsOf(node: ClassNode, port: string, at: TSESTree.Node): Finding[] {
  const data = { className: className(node), port };
  const isExtended = node.superClass?.type === AST_NODE_TYPES.Identifier && node.superClass.name === port;

  const isImplemented = node.implements.some(
    (implemented) => implemented.expression.type === AST_NODE_TYPES.Identifier && implemented.expression.name === port,
  );

  if (isExtended) {
    return [{ node: at, messageId: 'extended', data }];
  }

  return isImplemented ? [] : [{ node: at, messageId: 'notImplemented', data }];
}
