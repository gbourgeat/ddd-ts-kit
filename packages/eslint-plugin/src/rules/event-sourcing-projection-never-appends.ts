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
    'A projection never appends to a stream: it names neither the event store nor a repository of domain/repositories/.',
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

    const listeners = [
      kernelNamesListener(file, APPENDING, (imported) => named.push(imported)),
      repositories(file, named),
    ];

    let declared = location.layer === 'application' && location.inside[0] === 'projections';

    return {
      ImportDeclaration(node) {
        listeners.forEach((listener) => listener.ImportDeclaration?.(node));
      },
      Decorator(node) {
        declared ||= isProjectionDecorator(node);
      },
      'Program:exit'() {
        for (const { name, node } of declared ? named : []) {
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

function isProjectionDecorator(node: TSESTree.Decorator): boolean {
  const { expression } = node;

  return (
    expression.type === AST_NODE_TYPES.CallExpression &&
    expression.callee.type === AST_NODE_TYPES.Identifier &&
    expression.callee.name === 'Projection'
  );
}
