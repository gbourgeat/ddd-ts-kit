import { ASTUtils, AST_NODE_TYPES, TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { defineRule } from '../support/rule/define-rule';
import { ambientName } from '../support/globals/ambient-name';

/** The constructors of the language: none of them says what was refused, nor carries a code. */
const GENERIC_ERRORS = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'EvalError',
  'URIError',
  'AggregateError',
]);

export const domainNoGenericError = defineRule<'generic' | 'genericNamed'>({
  id: 'domain/no-generic-error',
  type: 'problem',
  recommended: 'error',
  description:
    'No `throw new Error(...)` in domain/ or application/, nor of `TypeError`, `RangeError` or another error of the language, thrown directly or through a `const`: an expected failure is a DomainError with a stable code.',
  messages: {
    generic:
      'A generic Error says nothing a caller can act on. Throw a DomainError with a stable code, built by a factory of the error class of its concept (`ddd-ts-kit generate error {{context}} <Concept> <refusal>`): presentation maps the code to a status in one place.',
    genericNamed:
      'A generic Error says nothing a caller can act on. Throw a refusal with a stable code, a class named after what is refused and built by a factory named after what it is about, `throw <Refusal>.for<Subject>(...)` (`ddd-ts-kit generate error {{context}} <Refusal> for<Subject>`): presentation maps the code to a status in one place.',
  },
  create({ file, sourceCode, report }) {
    const { location } = file;

    if (
      location.area !== 'context' ||
      file.isTest ||
      (location.layer !== 'domain' && location.layer !== 'application')
    ) {
      return {};
    }

    const messageId = file.config.stack.refusals === 'named' ? 'genericNamed' : 'generic';

    return {
      ThrowStatement(node) {
        const built = construction(sourceCode, node.argument);

        if (built !== undefined && GENERIC_ERRORS.has(ambientName(sourceCode, built.callee) ?? '')) {
          report({ node: node.argument, messageId, data: { context: location.context } });
        }
      },
    };
  },
});

type Construction = TSESTree.NewExpression | TSESTree.CallExpression;

/** What a throw builds: `new Error(..)` itself, or the `const` it throws, `const failure = new Error(..)`. */
function construction(
  sourceCode: Readonly<TSESLint.SourceCode>,
  thrown: TSESTree.Expression,
): Construction | undefined {
  const value = thrown.type === AST_NODE_TYPES.Identifier ? constValue(sourceCode, thrown) : thrown;

  return value !== undefined && isConstruction(value) ? value : undefined;
}

/** What a `const` declared once holds. */
function constValue(
  sourceCode: Readonly<TSESLint.SourceCode>,
  identifier: TSESTree.Identifier,
): TSESTree.Expression | undefined {
  const [definition, ...others] = ASTUtils.findVariable(sourceCode.getScope(identifier), identifier.name)?.defs ?? [];

  if (
    definition?.type !== TSESLint.Scope.DefinitionType.Variable ||
    others.length > 0 ||
    definition.parent.kind !== 'const'
  ) {
    return undefined;
  }

  return definition.node.init ?? undefined;
}

function isConstruction(node: TSESTree.Expression): node is Construction {
  return node.type === AST_NODE_TYPES.NewExpression || node.type === AST_NODE_TYPES.CallExpression;
}
