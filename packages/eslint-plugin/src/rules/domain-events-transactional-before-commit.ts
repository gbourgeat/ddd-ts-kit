import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { ImportTarget } from '../project/resolve-import.js';
import { propertyOf } from '../support/calls/property-of.js';
import { className, type ClassNode } from '../support/classes/class-name.js';
import { constructorOf } from '../support/classes/constructor-of.js';
import { declarationReader, type Declaration } from '../support/declarations/declaration-reader.js';
import { inContext } from '../support/imports/in-context.js';
import { staticString } from '../support/imports/static-string.js';
import type { ImportedBinding } from '../support/ports/imported-binding.js';
import { importedBindings } from '../support/ports/imported-bindings.js';
import { defineRule } from '../support/rule/define-rule.js';
import { parameterTypeName } from '../support/types/parameter-type-name.js';

type MessageId = 'beforeCommit' | 'afterCommit';

/** A name a handler is given, where the file writes it: in the dependency list or as the type of a constructor parameter. */
interface Dependency {
  readonly name: string;
  readonly node: TSESTree.Node;
}

const DECORATOR = 'DomainEventHandler';
const KERNEL = '@ddd-ts-kit/kernel';
const TRUSTED_PACKAGES = new Set([KERNEL, '@ddd-ts-kit/auth']);
/** The ports of the kernel whose effect no transaction covers. */
const OUTSIDE_THE_TRANSACTION = new Set(['Cache', 'Lock', 'RateLimiter', 'JobScheduler', 'EventBus']);
const PUBLISHER = 'IntegrationEventPublisher';

const ROLLED_BACK =
  "A handler that runs before the commit runs inside the transaction, and the commit can still fail after it ran: it may only have effects the rollback undoes. Declare the handler `phase: 'after-commit'` when its effect may be lost on a crash (it then runs at most once), or publish an integration event from a publisher (outbox, at least once) and do the work in the handler of that event when it must not be lost.";

export const domainEventsTransactionalBeforeCommit = defineRule<MessageId>({
  id: 'domain-events/transactional-before-commit',
  type: 'problem',
  recommended: 'error',
  description:
    'A declared domain event handler that runs before the commit has only effects the rollback undoes: no Cache, Lock, RateLimiter, JobScheduler or EventBus of the kernel, nothing from infrastructure/, another context, the platform or a foreign package; an after-commit handler never depends on IntegrationEventPublisher.',
  messages: {
    beforeCommit: `{{handler}} runs before the commit and depends on {{name}}, {{why}}: its effect would survive a rollback. ${ROLLED_BACK}`,
    afterCommit: `{{handler}} runs after the commit and depends on {{name}}: the event it publishes would be committed apart from the state change it announces. Send a command through the \`CommandBus\` port and let the publisher of the event that command records write to the outbox, or leave this handler before the commit.`,
  },
  create({ file, sourceCode, report }) {
    const context = inContext(file)?.context;

    if (context === undefined || file.isTest) return {};

    const declarationsOf = declarationReader(sourceCode.ast);
    const imported = importedBindings(file, sourceCode.ast);

    const judgeClass = (node: ClassNode): void => {
      const declaration = declarationsOf(node).find((candidate) => candidate.name === DECORATOR);

      if (declaration === undefined) return;

      const handler = className(node);
      const isAfterCommit = runsAfterCommit(declaration);

      for (const { name, node: where } of dependenciesOf(node, declaration)) {
        const origin = originOf(imported.get(name));

        if (origin === undefined) continue;

        if (isAfterCommit && isKernel(origin, PUBLISHER)) report({ node: where, messageId: 'afterCommit', data: { handler, name } });

        const why = isAfterCommit ? undefined : refusedBeforeCommit(context, origin);

        if (why !== undefined) report({ node: where, messageId: 'beforeCommit', data: { handler, name, why } });
      }
    };

    return { ClassDeclaration: judgeClass, ClassExpression: judgeClass };
  },
});

function runsAfterCommit(declaration: Declaration): boolean {
  const [, options] = declaration.arguments;
  const phase = options?.type === AST_NODE_TYPES.ObjectExpression ? propertyOf(options, 'phase') : undefined;

  return phase !== undefined && staticString(phase.value) === 'after-commit';
}

/** Each name once: the dependency list of the decorator first, then the types of the constructor parameters. */
function dependenciesOf(node: ClassNode, declaration: Declaration): Dependency[] {
  const list = declaration.arguments.at(-1);
  const listed = list?.type === AST_NODE_TYPES.ArrayExpression ? list.elements.flatMap((element) => (element?.type === AST_NODE_TYPES.Identifier ? [{ name: element.name, node: element }] : [])) : [];

  const received = (constructorOf(node.body)?.value.params ?? []).flatMap((parameter) => {
    const name = parameterTypeName(parameter);

    return name === undefined ? [] : [{ name, node: parameter }];
  });

  const all: Dependency[] = [...listed, ...received];

  return all.filter((dependency, index) => all.findIndex((other) => other.name === dependency.name) === index);
}

/** What a local name stands for: the name its module exports it under, and where that module is. */
interface Origin {
  readonly exported: string;
  readonly target: ImportTarget;
}

function originOf(binding: ImportedBinding | undefined): Origin | undefined {
  if (binding === undefined) return undefined;

  const { specifier, target } = binding;

  if (specifier.type !== AST_NODE_TYPES.ImportSpecifier) return { exported: specifier.local.name, target };

  return { exported: specifier.imported.type === AST_NODE_TYPES.Identifier ? specifier.imported.name : specifier.imported.value, target };
}

function isKernel({ exported, target }: Origin, name: string): boolean {
  return target.kind === 'package' && target.name === KERNEL && exported === name;
}

/** Why a handler of `context` that runs before the commit may not depend on this; undefined when it may, or when one file cannot tell. */
function refusedBeforeCommit(context: string, origin: Origin): string | undefined {
  const { target } = origin;

  if (target.kind === 'builtin') return `which comes from ${target.name}`;
  if (target.kind === 'package') return fromPackage(origin, target.name);

  const { location } = target;

  if (location.area === 'platform') return 'which comes from the platform';
  if (location.area !== 'context') return undefined;
  if (location.context !== context) return `which belongs to the context ${location.context}`;

  return location.layer === 'infrastructure' ? 'which is imported from infrastructure/' : undefined;
}

function fromPackage({ exported }: Origin, packageName: string): string | undefined {
  if (!TRUSTED_PACKAGES.has(packageName)) return `which comes from the package ${packageName}`;

  return packageName === KERNEL && OUTSIDE_THE_TRANSACTION.has(exported) ? 'a port of the kernel no transaction covers' : undefined;
}
