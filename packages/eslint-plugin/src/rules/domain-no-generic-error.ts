import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import { defineRule } from '../support/rule/define-rule';
import { ambientName } from '../support/globals/ambient-name';

export const domainNoGenericError = defineRule<'generic' | 'genericNamed'>({
  id: 'domain/no-generic-error',
  type: 'problem',
  recommended: 'error',
  description:
    'No `throw new Error(...)` in domain/ or application/: an expected failure is a DomainError with a stable code.',
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
        const thrown = node.argument;

        if (thrown.type !== AST_NODE_TYPES.NewExpression && thrown.type !== AST_NODE_TYPES.CallExpression) {
          return;
        }

        if (ambientName(sourceCode, thrown.callee) === 'Error') {
          report({ node: thrown, messageId, data: { context: location.context } });
        }
      },
    };
  },
});
