import type { TSESTree } from '@typescript-eslint/utils';
import { defineRule } from '../support/define-rule.js';
import { propertyName } from '../support/globals.js';
import { importListener, innerLayer } from '../support/imports.js';
import { parameterTypeName } from '../support/types.js';

const AMBIENT = new Set(['ActorContext', 'ACTOR_CONTEXT', 'AsyncLocalStorageActorContext', 'AsyncLocalStorage']);

const INSTEAD =
  'Read the actor from the command or query (`command.actor`, a message extending AuthorizedCommand or AuthorizedQuery) and pass what the model needs as a value; only infrastructure reads the ambient actor, for audit columns and tenant scoping.';

export const authzActorExplicit = defineRule<'imported' | 'used' | 'injected'>({
  id: 'authz/actor-explicit',
  type: 'problem',
  recommended: 'error',
  description: 'Use cases receive the actor in the command or query: domain/ and application/ never read an ambient actor.',
  messages: {
    imported: `{{name}} is imported in the {{layer}} layer: it gives the actor of the current request without anybody passing it. ${INSTEAD}`,
    used: `{{name}} is used in the {{layer}} layer: it gives the actor of the current request without anybody passing it. ${INSTEAD}`,
    injected: `{{className}} is given an ActorContext: a use case whose actor is ambient cannot be called from a consumer, a job or a test without setting a global. ${INSTEAD}`,
  },
  create({ file, report }) {
    const layer = innerLayer(file);
    if (layer === undefined) return {};
    const used = (node: TSESTree.Node, name: string | undefined): void => {
      if (name !== undefined && AMBIENT.has(name)) report({ node, messageId: 'used', data: { name, layer } });
    };
    return {
      ...importListener(file, ({ names }) => {
        for (const ambient of names.filter((imported) => AMBIENT.has(imported.name))) report({ node: ambient.node, messageId: 'imported', data: { name: ambient.name, layer } });
      }),
      MemberExpression: (node) => used(node.property, propertyName(node)),
      TSQualifiedName: (node) => used(node.right, node.right.name),
      MethodDefinition(node) {
        if (node.kind !== 'constructor') return;
        const owner = node.parent.parent;
        for (const parameter of node.value.params.filter((candidate) => parameterTypeName(candidate) === 'ActorContext')) {
          report({ node: parameter, messageId: 'injected', data: { className: owner.id?.name ?? 'The class' } });
        }
      },
    };
  },
});
