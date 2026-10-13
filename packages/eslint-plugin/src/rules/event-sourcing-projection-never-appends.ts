import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../project/linted-file.js';
import { kernelNamesListener } from '../support/event-sourcing/kernel-names-listener.js';
import { importListener, type ImportedName } from '../support/imports/import-listener.js';
import { defineRule } from '../support/rule/define-rule.js';

const APPENDING = new Set(['EventStore', 'EventSourcedRepository']);

export const eventSourcingProjectionNeverAppends = defineRule<'appends'>({
  id: 'event-sourcing/projection-never-appends',
  type: 'problem',
  recommended: 'error',
  description:
    'A projection never appends to a stream: it names no event store, and a projection fed by the event store names no repository of domain/repositories/ either.',
  messages: {
    appends:
      'The projection names {{name}}: it could append to a stream, and would append again at every rebuild. A projection writes its read model through its port; a fact worth keeping is decided by a command.',
  },
  create({ file, report }) {
    const { location } = file;

    if (location.area !== 'context' || file.isTest) {
      return {};
    }

    const named: ImportedName[] = [];
    const repositoryNames: ImportedName[] = [];

    const listeners = [
      kernelNamesListener(file, APPENDING, (imported) => named.push(imported)),
      repositories(file, repositoryNames),
    ];

    let declared = location.layer === 'application' && location.inside[0] === 'projections';
    let storeFed = false;

    return {
      ImportDeclaration(node) {
        listeners.forEach((listener) => listener.ImportDeclaration?.(node));
      },
      Decorator(node) {
        declared ||= isProjectionDecorator(node);
        storeFed ||= isProjectionDecorator(node) && feedsFromStore(node);
      },
      'Program:exit'() {
        const appending = [...named, ...(storeFed ? repositoryNames : [])];

        for (const { name, node } of declared ? appending : []) {
          report({ node, messageId: 'appends', data: { name } });
        }
      },
    };
  },
});

/** Notes what the file imports from `domain/repositories/`. */
function repositories(file: LintedFile, named: ImportedName[]): TSESLint.RuleListener {
  return importListener(file, ({ target, names }) => {
    const isRepository =
      target.kind === 'file' &&
      target.location.area === 'context' &&
      target.location.layer === 'domain' &&
      target.location.inside[0] === 'repositories';

    if (isRepository) {
      named.push(...names);
    }
  });
}

/** `@Projection(name, { feed: 'event-store' })`: replayed from position zero at every rebuild. */
function feedsFromStore({ expression }: TSESTree.Decorator): boolean {
  const options = expression.type === AST_NODE_TYPES.CallExpression ? expression.arguments[1] : undefined;

  return (
    options?.type === AST_NODE_TYPES.ObjectExpression &&
    options.properties.some(
      (property) =>
        property.type === AST_NODE_TYPES.Property &&
        property.key.type === AST_NODE_TYPES.Identifier &&
        property.key.name === 'feed' &&
        property.value.type === AST_NODE_TYPES.Literal &&
        property.value.value === 'event-store',
    )
  );
}

function isProjectionDecorator(node: TSESTree.Decorator): boolean {
  const { expression } = node;

  return (
    expression.type === AST_NODE_TYPES.CallExpression &&
    expression.callee.type === AST_NODE_TYPES.Identifier &&
    expression.callee.name === 'Projection'
  );
}
