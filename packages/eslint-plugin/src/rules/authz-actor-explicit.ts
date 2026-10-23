import { ASTUtils, AST_NODE_TYPES, TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { accessedName } from '../support/calls/accessed-name';
import { declaredTypeName } from '../support/types/declared-type-name';
import { defineRule, type Report } from '../support/rule/define-rule';
import { propertyName } from '../support/globals/property-name';
import { importListener, type ImportedName } from '../support/imports/import-listener';
import { innerLayer } from '../support/imports/inner-layer';
import { parameterTypeName } from '../support/types/parameter-type-name';

type MessageId = 'imported' | 'used' | 'helper' | 'injected' | 'read';
type Source = Readonly<TSESLint.SourceCode>;

/** The two ports that answer "who, in which unit of work" without being handed it. */
const AMBIENT_PORTS = new Set(['ActorContext', 'ExecutionScope']);

/** The ports, their adapters of the kernel and what those are built on: a class is a type and an injection token at once, so naming one is reading the ambient context. */
const AMBIENT = new Set([
  ...AMBIENT_PORTS,
  'AsyncLocalStorageExecutionScope',
  'ScopedActorContext',
  'AsyncLocalStorage',
]);

/** Kernel helpers that read the execution scope for a repository adapter: audit columns and the tenant of a statement. */
const INFRASTRUCTURE_HELPERS = new Set(['tenantScopeOf', 'stampCreation', 'stampUpdate']);
const READS = new Set(['current', 'require']);
/** What an ambient context is called when its declaration is not in the file. */
const AMBIENT_RECEIVER = /^#?(?:actors|scopes?)$|actorContext$|executionScope$/i;

const INSTEAD =
  'Read the actor from the command or query (`command.actor`, a message extending AuthorizedCommand or AuthorizedQuery) and pass what the model needs as a value; audit columns, tenant scoping and correlation are read from the execution scope by infrastructure and the platform only.';

export const authzActorExplicit = defineRule<MessageId>({
  id: 'authz/actor-explicit',
  type: 'problem',
  recommended: 'error',
  description:
    'Use cases receive the actor in the command or query: domain/ and application/ never read the ambient ExecutionScope or ActorContext.',
  messages: {
    imported: `{{name}} is imported in the {{layer}} layer, as a type or as the port named in a dependency list: it gives the actor or the execution context of the current unit of work without anybody passing it. ${INSTEAD}`,
    used: `{{name}} is used in the {{layer}} layer: it gives the actor or the execution context of the current unit of work without anybody passing it. ${INSTEAD}`,
    helper: `{{name}} is used in the {{layer}} layer: it reads the execution scope to stamp audit columns or to scope a statement by tenant, which is the work of a repository adapter. ${INSTEAD}`,
    injected: `{{className}} is given {{port}}: a use case whose actor is ambient cannot be called from an integration event handler, a job or a test without setting a global. ${INSTEAD}`,
    read: `{{read}}() reads the ambient context in the {{layer}} layer. ${INSTEAD}`,
  },
  create({ file, sourceCode, report }) {
    const layer = innerLayer(file);

    if (layer === undefined) {
      return {};
    }

    const named = (node: TSESTree.Node, name: string | undefined): void => {
      if (name !== undefined && AMBIENT.has(name)) {
        report({ node, messageId: 'used', data: { name, layer } });
      }
    };

    return {
      ...importListener(file, ({ names }) => importedNames(names, layer, report)),
      MemberExpression(node) {
        named(node.property, propertyName(node));

        if (isHelperOfNamespace(sourceCode, node)) {
          report({ node: node.property, messageId: 'helper', data: { name: propertyName(node), layer } });
        }
      },
      TSQualifiedName: (node) => named(node.right, node.right.name),
      MethodDefinition: (node) => injectedPorts(node, report),
      CallExpression(node) {
        if (isAmbientRead(sourceCode, node)) {
          report({ node, messageId: 'read', data: { read: sourceCode.getText(node.callee), layer } });
        }
      },
    };
  },
});

function importedNames(names: readonly ImportedName[], layer: string, report: Report<MessageId>): void {
  for (const { name, node } of names.filter((imported) => AMBIENT.has(imported.name))) {
    report({ node, messageId: 'imported', data: { name, layer } });
  }

  for (const { name, node } of names.filter((imported) => INFRASTRUCTURE_HELPERS.has(imported.name))) {
    report({ node, messageId: 'helper', data: { name, layer } });
  }
}

function injectedPorts(node: TSESTree.MethodDefinition, report: Report<MessageId>): void {
  if (node.kind !== 'constructor') {
    return;
  }

  const className = node.parent.parent.id?.name ?? 'The class';

  for (const parameter of node.value.params) {
    const port = parameterTypeName(parameter);

    if (port !== undefined && AMBIENT_PORTS.has(port)) {
      report({ node: parameter, messageId: 'injected', data: { className, port } });
    }
  }
}

/** `kernel.stampCreation` where `kernel` is an import: a method of the project that happens to carry the name is not the helper. */
function isHelperOfNamespace(sourceCode: Source, node: TSESTree.MemberExpression): boolean {
  if (node.object.type !== AST_NODE_TYPES.Identifier || !INFRASTRUCTURE_HELPERS.has(propertyName(node) ?? '')) {
    return false;
  }

  const definitions = ASTUtils.findVariable(sourceCode.getScope(node), node.object.name)?.defs ?? [];

  return definitions.some((definition) => definition.type === TSESLint.Scope.DefinitionType.ImportBinding);
}

/**
 * `.current()` or `.require()` without argument on an ambient context. The declared type of the
 * receiver decides when the file shows it; otherwise its name does.
 */
function isAmbientRead(sourceCode: Source, node: TSESTree.CallExpression): boolean {
  const { callee } = node;

  if (
    callee.type !== AST_NODE_TYPES.MemberExpression ||
    node.arguments.length > 0 ||
    !READS.has(propertyName(callee) ?? '')
  ) {
    return false;
  }

  const declared = declaredTypeName(sourceCode, callee.object);

  return declared === undefined ? AMBIENT_RECEIVER.test(accessedName(callee.object) ?? '') : AMBIENT.has(declared);
}
