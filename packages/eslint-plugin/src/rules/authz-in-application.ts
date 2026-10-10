import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { ancestors } from '../support/ancestors.js';
import { accessedName } from '../support/calls/accessed-name.js';
import { DECLARATIONS_ENTRY } from '../support/declarations/declaration-reader.js';
import { isDeclaredStyle } from '../support/declarations/is-declared-style.js';
import { defineRule, type Report } from '../support/rule/define-rule.js';
import { propertyName } from '../support/globals/property-name.js';
import { importListener, type ImportedName, type ImportSite } from '../support/imports/import-listener.js';
import { inContext } from '../support/imports/in-context.js';
import type { LintedFile } from '../project/linted-file.js';
import { declaredTypeName } from '../support/types/declared-type-name.js';
import { startsAtThis } from '../support/members/starts-at-this.js';

type MessageId =
  | 'declaredOutside'
  | 'rights'
  | 'roleTest'
  | 'authorizerImport'
  | 'decision'
  | 'refusal'
  | 'authInDomain'
  | 'actorInDomain'
  | 'rightsInDomain';
type Tell = Report<MessageId>;
type Source = Readonly<TSESLint.SourceCode>;

const AUTH = '@ddd-ts-kit/auth';
const KERNEL = '@ddd-ts-kit/kernel';
const RIGHTS = new Set(['roles', 'permissions']);
const RIGHTS_AT_THE_BOUNDARY = new Set([...RIGHTS, 'isAdmin']);
const EQUALITY = new Set(['===', '!==', '==', '!=']);

/** What a route needs of the auth package: the actor and the session of the request, and the errors it may map. */
const REQUEST_GLUE = new Set([
  'actorOf',
  'sessionOf',
  'resolveSession',
  'SessionAuthenticator',
  'bearerCredential',
  'inActorContext',
  'principalResolver',
  'HeaderValues',
  'FORBIDDEN',
  'UNAUTHORIZED',
]);

const DECISIONS = new Set(['authorize', 'decide', 'check']);
const AUTHORIZER_NAME = /^#?access$|authorizer/i;
const AUTHORIZER_TYPE = /^Access$|Authorizer$/;
const ACTOR_MODEL = new Set(['Actor', 'Actored', 'ActorContext', 'Session', 'ExecutionContext']);
/** The declarations that say or decide who may do what: they belong on a message or a policy of application/. */
const ACCESS_DECLARATIONS = new Set(['Requires', 'Public', 'Policy']);

/** The ports a handler asks for a decision: the class is the type and the injection token. */
const ACCESS_PORTS = new Set(['Access', 'PolicyAccess']);

const IN_APPLICATION =
  'Declare the permission on the use case (`.requires(...)` in the module, or `@Requires(...)` on the message) and, for a rule that needs loaded state, write a policy in application/authorization evaluated by the handler through `Access`.';

export const authzInApplication = defineRule<MessageId>({
  id: 'authz/in-application',
  type: 'problem',
  recommended: 'error',
  description:
    'The permission is decided in the application layer through the Authorizer and Access ports: no role test in presentation/, no authorization in infrastructure/, no knowledge of rights in domain/.',
  messages: {
    declaredOutside: `{{layer}}/ imports {{name}} from "{{specifier}}": who may do what is declared and decided in application/. Put \`@Requires(...)\` or \`@Public()\` on the command or query, write a rule that needs loaded state as a \`@Policy\` class of application/authorization, and name \`Access\` in the dependency list of a handler only.`,
    rights: `presentation/ reads {{access}}: a route maps a request to a command and decides nothing. Put the actor in the command or query and remove the test. ${IN_APPLICATION}`,
    roleTest: `presentation/ compares {{access}} with a role name. Put the actor in the command or query and remove the test. ${IN_APPLICATION}`,
    authorizerImport: `presentation/ imports {{name}} from "${AUTH}", which decides access. Keep only the request glue here (actorOf, sessionOf, resolveSession, a SessionAuthenticator, inActorContext, the error classes). ${IN_APPLICATION}`,
    decision: `infrastructure/ asks {{call}}() for a decision: an adapter does what it is told. Receive an access scope computed by the handler as a parameter of the port instead. ${IN_APPLICATION}`,
    refusal: `infrastructure/ raises ForbiddenError: refusing is a decision of the application layer. Return what was found (or nothing) and let the handler refuse. ${IN_APPLICATION}`,
    authInDomain: `domain/ imports "${AUTH}": the domain knows nothing of who may do what. Keep invariants here ("an invoice cannot be paid twice") and move the rule about the actor to a policy in application/authorization.`,
    actorInDomain: `domain/ imports {{name}} from "${KERNEL}": the domain never sees the actor, its session or the execution context. Pass the fact the model needs as its own value (an author id, a tenant id) and keep the actor in the handler.`,
    rightsInDomain:
      'domain/ reads {{access}}: rights are not part of the model. Let a policy of application/authorization decide and call the aggregate only once the decision is taken.',
  },
  create({ file, sourceCode, report }) {
    const here = inContext(file);

    if (here === undefined || file.isTest) {
      return {};
    }

    if (here.layer === 'presentation') {
      return presentation(file, sourceCode, report);
    }

    if (here.layer === 'infrastructure') {
      return infrastructure(file, sourceCode, report);
    }

    return here.layer === 'domain' ? domain(file, sourceCode, report) : {};
  },
});

function presentation(file: LintedFile, sourceCode: Source, tell: Tell): TSESLint.RuleListener {
  const tellDeclaredOutside = declaredOutside(file, 'presentation', tell);

  const roleTest = (node: TSESTree.Node, tested: TSESTree.Node): void => {
    if (isRole(tested)) {
      tell({ node, messageId: 'roleTest', data: { access: sourceCode.getText(tested) } });
    }
  };

  return {
    ...importListener(file, (site) => {
      tellDeclaredOutside(site);
      tellAuthorizerImport(site, tell);
    }),
    MemberExpression(node) {
      if (RIGHTS_AT_THE_BOUNDARY.has(propertyName(node) ?? '')) {
        tell({ node, messageId: 'rights', data: { access: sourceCode.getText(node) } });
      }
    },
    BinaryExpression(node) {
      if (!EQUALITY.has(node.operator)) {
        return;
      }

      if (isText(node.right)) {
        roleTest(node, node.left);
      }

      if (isText(node.left)) {
        roleTest(node, node.right);
      }
    },
    SwitchStatement: (node) => roleTest(node.discriminant, node.discriminant),
  };
}

function tellAuthorizerImport({ node, target, names, whole }: ImportSite, tell: Tell): void {
  if (target.kind !== 'package' || target.name !== AUTH) {
    return;
  }

  if (whole) {
    tell({ node, messageId: 'authorizerImport', data: { name: 'the whole module' } });
  }

  for (const decider of names.filter(decidesAccess)) {
    tell({ node: decider.node, messageId: 'authorizerImport', data: { name: decider.name } });
  }
}

/**
 * In a declared-style project the decorators of access and the `Access` port are within reach of
 * every layer: they stay in application/. `Access` in presentation/ is already an `authorizerImport`.
 */
function declaredOutside(
  file: LintedFile,
  layer: 'presentation' | 'infrastructure',
  tell: Tell,
): (site: ImportSite) => void {
  const declares = isDeclaredStyle(file);

  return (site) => {
    for (const taken of declares ? takenOutside(layer, site) : []) {
      tell({
        node: taken.node,
        messageId: 'declaredOutside',
        data: { layer, name: taken.name, specifier: site.specifier },
      });
    }
  };
}

function takenOutside(
  layer: 'presentation' | 'infrastructure',
  { specifier, target, names }: ImportSite,
): ImportedName[] {
  if (specifier === DECLARATIONS_ENTRY) {
    return names.filter((taken) => ACCESS_DECLARATIONS.has(taken.name));
  }

  const fromAuth = target.kind === 'package' && target.name === AUTH;

  return layer === 'infrastructure' && fromAuth ? names.filter((taken) => ACCESS_PORTS.has(taken.name)) : [];
}

function decidesAccess(imported: ImportedName): boolean {
  return !REQUEST_GLUE.has(imported.name) && !imported.name.endsWith('Error');
}

function isRole(node: TSESTree.Node): boolean {
  return node.type === AST_NODE_TYPES.MemberExpression && propertyName(node) === 'role';
}

function isText(node: TSESTree.Node): boolean {
  return node.type === AST_NODE_TYPES.Literal && typeof node.value === 'string';
}

function infrastructure(file: LintedFile, sourceCode: Source, tell: Tell): TSESLint.RuleListener {
  const imports = importListener(file, declaredOutside(file, 'infrastructure', tell));

  return {
    ...imports,
    CallExpression(node) {
      imports.CallExpression?.(node);
      const { callee } = node;

      if (callee.type !== AST_NODE_TYPES.MemberExpression || !DECISIONS.has(propertyName(callee) ?? '')) {
        return;
      }

      if (!isAuthorizer(sourceCode, callee.object) || isAuthorizerAdapter(node)) {
        return;
      }

      tell({ node, messageId: 'decision', data: { call: sourceCode.getText(callee) } });
    },
    NewExpression(node) {
      if (node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === 'ForbiddenError') {
        tell({ node, messageId: 'refusal' });
      }
    },
  };
}

function isAuthorizer(sourceCode: Source, node: TSESTree.Node): boolean {
  return (
    AUTHORIZER_NAME.test(accessedName(node) ?? '') || AUTHORIZER_TYPE.test(declaredTypeName(sourceCode, node) ?? '')
  );
}

/** An adapter of the Authorizer port (a cache, a remote service) decides by definition: it may delegate to another one. */
function isAuthorizerAdapter(node: TSESTree.Node): boolean {
  for (const parent of ancestors(node)) {
    if (parent.type !== AST_NODE_TYPES.ClassDeclaration && parent.type !== AST_NODE_TYPES.ClassExpression) {
      continue;
    }

    return parent.implements.some(
      (port) => port.expression.type === AST_NODE_TYPES.Identifier && port.expression.name.endsWith('Authorizer'),
    );
  }

  return false;
}

function domain(file: LintedFile, sourceCode: Source, tell: Tell): TSESLint.RuleListener {
  return {
    ...importListener(file, ({ node, target, names }) => {
      if (target.kind !== 'package') {
        return;
      }

      if (target.name === AUTH) {
        tell({ node, messageId: 'authInDomain' });
      }

      if (target.name !== KERNEL) {
        return;
      }

      for (const actor of names.filter((imported) => ACTOR_MODEL.has(imported.name))) {
        tell({ node: actor.node, messageId: 'actorInDomain', data: { name: actor.name } });
      }
    }),
    MemberExpression(node) {
      // `this.roles` is the state of a model whose subject is access itself (an identity context), not a test of the caller.
      if (RIGHTS.has(propertyName(node) ?? '') && !startsAtThis(node)) {
        tell({ node, messageId: 'rightsInDomain', data: { access: sourceCode.getText(node) } });
      }
    },
  };
}
