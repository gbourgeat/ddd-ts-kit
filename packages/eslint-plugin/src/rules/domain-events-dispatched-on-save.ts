import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../project/linted-file.js';
import { propertyName } from '../support/globals/property-name.js';
import { dependencyListListener } from '../support/ports/dependency-list-listener.js';
import { defineRule } from '../support/rule/define-rule.js';
import { parameterTypeName } from '../support/types/parameter-type-name.js';

const DISPATCHER = 'DomainEventDispatcher';
const PULL = 'pullEvents';
const ON_SAVE = 'events leave with the save: `await repository.save(aggregate)` and nothing else; a removal that announces an event takes the aggregate.';

/** What a file of a context is held to: every judged file calls no `pullEvents()`, some also know no dispatcher. */
interface Judged {
  readonly place: string;
  readonly refusesDispatcher: boolean;
}

export const domainEventsDispatchedOnSave = defineRule<'pulled' | 'dispatcher'>({
  id: 'domain-events/dispatched-on-save',
  type: 'problem',
  recommended: 'error',
  description: 'Domain events leave with the save: no `pullEvents()` in application/ or infrastructure/, no DomainEventDispatcher in a command, a query or a repository adapter.',
  messages: {
    pulled: `\`${PULL}()\` is called in {{place}}: ${ON_SAVE}`,
    dispatcher: `${DISPATCHER} is {{how}} in {{place}}: ${ON_SAVE}`,
  },
  create({ file, sourceCode, report }) {
    const judged = judgedAs(file);

    if (judged === undefined) return {};

    const { place } = judged;
    const refuse = (node: TSESTree.Node, how: string): void => report({ node, messageId: 'dispatcher', data: { how, place } });

    const lists = dependencyListListener(sourceCode.ast, (dependency) => {
      if (judged.refusesDispatcher && dependency.name === DISPATCHER) refuse(dependency, 'named in a dependency list');
    });

    return {
      ...lists,
      CallExpression(node) {
        lists.CallExpression?.(node);

        if (isPull(node)) report({ node, messageId: 'pulled', data: { place } });
      },
      ImportDeclaration(node) {
        for (const specifier of judged.refusesDispatcher ? node.specifiers.filter(importsDispatcher) : []) refuse(specifier, 'imported');
      },
      MethodDefinition(node) {
        if (!judged.refusesDispatcher || node.kind !== 'constructor') return;

        for (const parameter of node.value.params.filter((candidate) => parameterTypeName(candidate) === DISPATCHER)) refuse(parameter, 'a constructor parameter');
      },
    };
  },
});

/** Production files of application/ and infrastructure/; the module file, the tests and everything outside a context are not judged. */
function judgedAs(file: LintedFile): Judged | undefined {
  const { location } = file;

  if (location.area !== 'context' || file.isTest) return undefined;

  const [folder = ''] = location.inside;

  if (location.layer === 'application') return { place: `application/${folder}`, refusesDispatcher: folder === 'commands' || folder === 'queries' };
  if (location.layer !== 'infrastructure') return undefined;

  return { place: `infrastructure/${folder}`, refusesDispatcher: folder === 'persistence' && file.path.endsWith('.repository.ts') };
}

function isPull(node: TSESTree.CallExpression): boolean {
  return node.callee.type === AST_NODE_TYPES.MemberExpression && propertyName(node.callee) === PULL;
}

function importsDispatcher(specifier: TSESTree.ImportClause): boolean {
  if (specifier.type !== AST_NODE_TYPES.ImportSpecifier) return false;

  const { imported } = specifier;

  return (imported.type === AST_NODE_TYPES.Identifier ? imported.name : imported.value) === DISPATCHER;
}
