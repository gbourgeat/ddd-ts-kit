import { AST_NODE_TYPES, type TSESTree } from '@typescript-eslint/utils';
import type { ContextLocation } from '../project/location';
import { className } from '../support/classes/class-name';
import { type Callable, isCallable } from '../support/classes/is-callable';
import { memberName } from '../support/classes/member-name';
import { visibilityOf } from '../support/classes/visibility-of';
import { defineRule } from '../support/rule/define-rule';

export const cleanNoFlagArgument = defineRule<'flag'>({
  id: 'clean/no-flag-argument',
  type: 'suggestion',
  recommended: 'warn',
  description: 'No boolean parameter on a public method of the domain or a use case: two intentions are two methods.',
  messages: {
    flag: '{{className}}.{{method}} takes the flag "{{flag}}". Split {{method}} into two methods named after each intention, so that a call site says what it does without a true or false to decode.',
  },
  create({ file, report }) {
    if (file.location.area !== 'context' || file.isTest) {
      return {};
    }

    const location = file.location;

    return {
      ClassBody(body) {
        const owner = className(body.parent);

        // Messages carry data: a command or a query is exempt.
        if (/(?:Command|Query)$/.test(owner)) {
          return;
        }

        for (const member of body.body.filter(isCallable)) {
          const method = memberName(member) ?? '';

          if (visibilityOf(member) !== 'public' || !isJudged(location, method)) {
            continue;
          }

          for (const flag of flagsOf(member)) {
            report({ node: flag, messageId: 'flag', data: { className: owner, method, flag: flag.name } });
          }
        }
      },
    };
  },
});

/** Public behaviour of the domain, and the `execute` of a use case. */
function isJudged(location: ContextLocation, method: string): boolean {
  return location.layer === 'domain' || (location.layer === 'application' && method === 'execute');
}

function flagsOf(member: Callable): TSESTree.Identifier[] {
  return member.value.params.flatMap((parameter) => {
    const flag = flagOf(parameter);

    return flag === undefined ? [] : [flag];
  });
}

function flagOf(parameter: TSESTree.Parameter): TSESTree.Identifier | undefined {
  if (parameter.type === AST_NODE_TYPES.Identifier) {
    return isBooleanType(parameter.typeAnnotation?.typeAnnotation) ? parameter : undefined;
  }

  if (parameter.type !== AST_NODE_TYPES.AssignmentPattern || parameter.left.type !== AST_NODE_TYPES.Identifier) {
    return undefined;
  }

  const defaultsToBoolean =
    parameter.right.type === AST_NODE_TYPES.Literal && typeof parameter.right.value === 'boolean';

  return defaultsToBoolean || isBooleanType(parameter.left.typeAnnotation?.typeAnnotation) ? parameter.left : undefined;
}

function isBooleanType(type: TSESTree.TypeNode | undefined): boolean {
  if (type === undefined) {
    return false;
  }

  if (type.type === AST_NODE_TYPES.TSBooleanKeyword) {
    return true;
  }

  if (type.type !== AST_NODE_TYPES.TSUnionType) {
    return false;
  }

  const meaningful = type.types.filter(
    (member) => member.type !== AST_NODE_TYPES.TSUndefinedKeyword && member.type !== AST_NODE_TYPES.TSNullKeyword,
  );

  return meaningful.length > 0 && meaningful.every((member) => member.type === AST_NODE_TYPES.TSBooleanKeyword);
}
