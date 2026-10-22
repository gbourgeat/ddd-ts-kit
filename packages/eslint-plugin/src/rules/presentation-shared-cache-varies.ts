import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import { calleeName } from '../support/calls/callee-name';
import { propertyOf } from '../support/calls/property-of';
import { defineRule, type Report } from '../support/rule/define-rule';

type MessageId = 'sharedWithoutVary';

const DECLARATIONS = new Set(['Controller', 'RouteGroup', 'defineRoute']);
const SHARED = 'public';
const OPEN_GUARD = 'Public';

export const presentationSharedCacheVaries = defineRule<MessageId>({
  id: 'presentation/shared-cache-varies',
  type: 'problem',
  recommended: 'error',
  description:
    'A route, a controller or a route group that knows its caller (behind a guard other than `Public`, or naming security schemes) and declares a `public` cache policy names in `vary` the request headers its answer depends on: a shared cache never hands the answer of one caller to the next.',
  messages: {
    sharedWithoutVary:
      'This {{what}} keeps its answers in shared caches (`scope: public`) and {{why}}. A shared cache files an answer by its URL and hands it to the next caller: declare `scope: CacheScope.private`, or name in `vary` the request headers the answer depends on (`Authorization`, a tenant header). Never cache a decision of authorization across actors.',
  },
  create({ file, report }) {
    if (file.isTest) {
      return {};
    }

    return { CallExpression: (node) => judgeDeclaration(node, report) };
  },
});

function judgeDeclaration(node: TSESTree.CallExpression, report: Report<MessageId>): void {
  const name = calleeName(node) ?? '';
  const [spec] = node.arguments;

  if (!DECLARATIONS.has(name) || spec?.type !== AST_NODE_TYPES.ObjectExpression) {
    return;
  }

  const cache = sharedWithoutVary(spec);
  const why = name === 'defineRoute' ? namesSchemes(spec) : guarded(spec);

  if (cache !== undefined && why !== undefined) {
    report({ node: cache, messageId: 'sharedWithoutVary', data: { what: whatOf(name), why } });
  }
}

/** The cache policy of a declaration, when shared caches keep its answers and it names nothing they vary on. */
function sharedWithoutVary(spec: TSESTree.ObjectExpression): TSESTree.ObjectExpression | undefined {
  const cache = propertyOf(spec, 'cache')?.value;

  if (cache?.type !== AST_NODE_TYPES.ObjectExpression || !isShared(cache) || varies(cache)) {
    return undefined;
  }

  return cache;
}

/** `scope: CacheScope.public` or `scope: 'public'`. */
function isShared(cache: TSESTree.ObjectExpression): boolean {
  const scope = propertyOf(cache, 'scope')?.value;

  if (scope?.type === AST_NODE_TYPES.Literal) {
    return scope.value === SHARED;
  }

  return (
    scope?.type === AST_NODE_TYPES.MemberExpression &&
    scope.property.type === AST_NODE_TYPES.Identifier &&
    scope.property.name === SHARED
  );
}

/** A `vary` written as anything but an empty list: what it holds is judged at run time. */
function varies(cache: TSESTree.ObjectExpression): boolean {
  const vary = propertyOf(cache, 'vary')?.value;

  return vary !== undefined && !(vary.type === AST_NODE_TYPES.ArrayExpression && vary.elements.length === 0);
}

/** A function route that names security schemes knows its caller; `security: false` does not. */
function namesSchemes(spec: TSESTree.ObjectExpression): string | undefined {
  const security = propertyOf(spec, 'security')?.value;

  return security?.type === AST_NODE_TYPES.ArrayExpression && security.elements.length > 0
    ? 'it names security schemes'
    : undefined;
}

/** Guards written here, other than `Public` alone; a declaration that inherits its guards from its group is judged at run time. */
function guarded(spec: TSESTree.ObjectExpression): string | undefined {
  const guards = propertyOf(spec, 'guards')?.value;

  if (guards?.type !== AST_NODE_TYPES.ArrayExpression) {
    return undefined;
  }

  const names = guards.elements.map((guard) => (guard?.type === AST_NODE_TYPES.Identifier ? guard.name : 'a guard'));

  return names.length === 0 || (names.length === 1 && names[0] === OPEN_GUARD)
    ? undefined
    : `it stands behind ${names.join(', ')}`;
}

function whatOf(name: string): string {
  if (name === 'RouteGroup') {
    return 'route group';
  }

  return name === 'Controller' ? 'controller' : 'route';
}
