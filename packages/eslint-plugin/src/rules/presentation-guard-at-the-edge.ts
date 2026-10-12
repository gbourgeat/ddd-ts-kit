import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { defineRule } from '../support/rule/define-rule.js';

type MessageId = 'reachesInside' | 'reachesName';

const INSIDE = /(?:^|\/)(domain|infrastructure)\//;
/** What a guard has no business holding, by the name it is imported under. */
const FORBIDDEN_NAME = /(?:Repository|UnitOfWork)$|^CommandBus$/;

export const presentationGuardAtTheEdge = defineRule<MessageId>({
  id: 'presentation/guard-at-the-edge',
  type: 'problem',
  recommended: 'error',
  description:
    'A guard controls the caller at the edge and nothing else: a `*.guard.ts` file imports nothing from `domain/` or `infrastructure/`, no repository, no unit of work and no command bus.',
  messages: {
    reachesInside:
      'This guard imports "{{specifier}}", from {{layer}}/. A guard reads the caller and the request: the role, the tenant, a key, a parameter of the path. A right that depends on an element of the model is a permission of the use case (`@Requires`, a policy), held for every caller of the use case, a job and an event handler included. Remove the import and move the decision there.',
    reachesName:
      'This guard imports {{name}}. A guard never loads an aggregate and never changes anything: what needs {{name}} is a decision of the use case (`@Requires`, a policy). A guard may ask a port of application/ports a question about the caller, and nothing more.',
  },
  create({ file, report }) {
    if (file.isTest || !file.path.endsWith('.guard.ts')) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        const specifier = node.source.value;
        const layer = INSIDE.exec(specifier)?.[1];

        if (layer !== undefined) {
          report({ node, messageId: 'reachesInside', data: { specifier, layer } });

          return;
        }

        for (const imported of node.specifiers) {
          const name =
            imported.type === AST_NODE_TYPES.ImportSpecifier && imported.imported.type === AST_NODE_TYPES.Identifier
              ? imported.imported.name
              : imported.local.name;

          if (FORBIDDEN_NAME.test(name)) {
            report({ node: imported, messageId: 'reachesName', data: { name } });
          }
        }
      },
    };
  },
});
