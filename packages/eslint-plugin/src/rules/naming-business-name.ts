import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import type { LintedFile } from '../project/linted-file.js';
import { bindingAdvice } from '../support/business-names/binding-advice.js';
import type { BindingKind } from '../support/business-names/binding-kind.js';
import { builtClass } from '../support/business-names/built-class.js';
import { camel } from '../support/business-names/camel.js';
import { collectionElement } from '../support/business-names/collection-element.js';
import { calledMember } from '../support/business-names/called-member.js';
import { conventionalModelName } from '../support/business-names/conventional-model-name.js';
import { isNameFree } from '../support/business-names/is-name-free.js';
import { judgesNames } from '../support/business-names/judges-names.js';
import { patternIdentifiers } from '../support/business-names/pattern-identifiers.js';
import { plural } from '../support/business-names/plural.js';
import type { ProposedName } from '../support/business-names/proposed-name.js';
import { renameFix } from '../support/business-names/rename-fix.js';
import { repositoryConcept } from '../support/business-names/repository-concept.js';
import { singular } from '../support/business-names/singular.js';
import { typedNames, type TypedNames } from '../support/business-names/typed-names.js';
import { wordsOf, type BusinessNameOptions } from '../support/business-names/words-of.js';
import { defineRule, type Report } from '../support/rule/define-rule.js';

type MessageId = 'generic';
type Options = [BusinessNameOptions];
type Context = Readonly<TSESLint.RuleContext<MessageId, Options>>;

/** Everything that declares parameters: functions, methods, abstract and overload signatures, function types. */
const WITH_PARAMETERS = [
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'TSDeclareFunction',
  'TSEmptyBodyFunctionExpression',
  'TSMethodSignature',
  'TSFunctionType',
  'TSCallSignatureDeclaration',
  'TSConstructSignatureDeclaration',
  'TSConstructorType',
].join(', ');

interface Judged {
  readonly context: Context;
  readonly file: LintedFile;
  readonly words: ReadonlySet<string>;
  readonly report: Report<MessageId>;
  /** Undefined without type information: the names of the code decide. */
  readonly typed: TypedNames | undefined;
}

export const namingBusinessName = defineRule<MessageId, Options>({
  id: 'naming/business-name',
  type: 'suggestion',
  fixable: 'code',
  recommended: 'error',
  description:
    'A variable, parameter, property, destructured or loop binding of domain/ and application/ (and of the shared kernel) is named after the concept it holds, never a generic word such as target, data or item.',
  messages: {
    generic:
      'The {{kind}} `{{name}}` is named with a generic word: the code of the model speaks the ubiquitous language of its context, and `{{name}}` hides which concept it holds. {{advice}}',
  },
  schema: [
    {
      type: 'object',
      properties: {
        words: { type: 'array', items: { type: 'string' } },
        allow: { type: 'array', items: { type: 'string' } },
      },
      additionalProperties: false,
    },
  ],
  defaultOptions: [{}],
  create({ context, file, options, report }) {
    const words = wordsOf(file.config, options[0]);

    if (words.size === 0 || !judgesNames(file)) {
      return {};
    }

    return listeners({ context, file, words, report, typed: typedNames(context, file) });
  },
});

/** Every place a name is bound: declarators, parameter lists, class properties and the properties of a declared shape. */
function listeners(judged: Judged): TSESLint.RuleListener {
  return {
    VariableDeclarator(node) {
      if (node.id.type === AST_NODE_TYPES.Identifier) {
        judgeVariable(judged, node, node.id);

        return;
      }

      for (const identifier of patternIdentifiers(node.id)) {
        judgeName(judged, identifier, 'destructured binding');
      }
    },
    [WITH_PARAMETERS](node: { params: readonly TSESTree.Parameter[] }) {
      for (const parameter of node.params) {
        for (const identifier of patternIdentifiers(parameter)) {
          judgeName(judged, identifier, parameterKind(parameter));
        }
      }
    },
    'PropertyDefinition, TSAbstractPropertyDefinition'(
      node: TSESTree.PropertyDefinition | TSESTree.TSAbstractPropertyDefinition,
    ) {
      if (!node.computed && node.key.type === AST_NODE_TYPES.Identifier) {
        judgeName(judged, node.key, 'property');
      }
    },
    TSPropertySignature(node) {
      if (!node.computed && node.key.type === AST_NODE_TYPES.Identifier && declaresAShape(node.parent)) {
        judgeName(judged, node.key, 'property');
      }
    },
  };
}

function parameterKind(parameter: TSESTree.Parameter): BindingKind {
  if (parameter.type === AST_NODE_TYPES.TSParameterProperty) {
    return 'property';
  }

  const bound = parameter.type === AST_NODE_TYPES.AssignmentPattern ? parameter.left : parameter;
  const named = bound.type === AST_NODE_TYPES.RestElement ? bound.argument : bound;

  return named.type === AST_NODE_TYPES.Identifier ? 'parameter' : 'destructured binding';
}

/** An interface, or a type alias of an object: a type literal nested in an annotation is not a declaration of the model. */
function declaresAShape(body: TSESTree.Node): boolean {
  return (
    body.type === AST_NODE_TYPES.TSInterfaceBody ||
    (body.type === AST_NODE_TYPES.TSTypeLiteral && body.parent.type === AST_NODE_TYPES.TSTypeAliasDeclaration)
  );
}

function judgeName(judged: Judged, identifier: TSESTree.Identifier, kind: BindingKind): void {
  if (judged.words.has(identifier.name)) {
    reportName(judged, { identifier, kind, suggestion: undefined, fix: undefined });
  }
}

/** One generic name, the business name the code gives to what it holds when it is known, and its renaming when it is safe. */
interface GenericName {
  readonly identifier: TSESTree.Identifier;
  readonly kind: BindingKind;
  readonly suggestion: string | undefined;
  readonly fix: TSESLint.ReportFixFunction | undefined;
}

function reportName(judged: Judged, { identifier, kind, suggestion, fix }: GenericName): void {
  judged.report({
    node: identifier,
    messageId: 'generic',
    data: { kind, name: identifier.name, advice: bindingAdvice(kind, suggestion) },
    ...(fix === undefined ? {} : { fix }),
  });
}

/** A variable: renamed when its initializer says which concept it holds and the name is free, reported otherwise. */
function judgeVariable(judged: Judged, declarator: TSESTree.VariableDeclarator, identifier: TSESTree.Identifier): void {
  if (!judged.words.has(identifier.name)) {
    return;
  }

  const loop = walkedCollection(declarator);

  if (loop !== undefined) {
    const element = judged.typed?.modelOf(loop)?.element ?? collectionElement(loop);

    reportName(judged, { identifier, kind: 'loop variable', suggestion: element, fix: undefined });

    return;
  }

  reportName(judged, { identifier, kind: 'variable', ...renaming(judged, declarator, identifier) });
}

/** The name the initializer of a variable gives to what it holds, and the fix when the variable holds as many as the name says. */
function renaming(
  judged: Judged,
  declarator: TSESTree.VariableDeclarator,
  identifier: TSESTree.Identifier,
): Pick<GenericName, 'suggestion' | 'fix'> {
  const several = singular(identifier.name) !== undefined;
  const proposal = declarator.init === null ? undefined : proposedName(judged, declarator.init, several);

  if (proposal === undefined) {
    return { suggestion: undefined, fix: undefined };
  }

  const name = proposal.many ? plural(proposal.element) : proposal.element;

  return { suggestion: name, fix: proposal.many === several ? safeRename(judged, declarator, name) : undefined };
}

/** The renaming of the variable a declarator declares, unless the name is taken where it is used. */
function safeRename(
  judged: Judged,
  declarator: TSESTree.VariableDeclarator,
  name: string,
): TSESLint.ReportFixFunction | undefined {
  const variable = judged.context.sourceCode.getDeclaredVariables(declarator)[0];

  return variable !== undefined && isNameFree(variable, name) ? renameFix(variable, name) : undefined;
}

/** `due` in `for (const target of due)`. */
function walkedCollection(declarator: TSESTree.VariableDeclarator): TSESTree.Expression | undefined {
  const loop = declarator.parent.parent;

  const walks =
    (loop.type === AST_NODE_TYPES.ForOfStatement || loop.type === AST_NODE_TYPES.ForInStatement) &&
    loop.left === declarator.parent;

  return walks ? loop.right : undefined;
}

/**
 * The concept an initializer holds: the class of the project it builds, or what a repository it
 * reads answers, by its type when the parser has one, by the names of the kit otherwise; for
 * `found ?? X.create(..)`, either side.
 */
function proposedName(judged: Judged, init: TSESTree.Expression, several: boolean): ProposedName | undefined {
  if (init.type === AST_NODE_TYPES.LogicalExpression && init.operator === '??') {
    return proposedName(judged, init.right, several) ?? proposedName(judged, init.left, several);
  }

  const built = builtClass(judged.context.sourceCode, judged.file, init);

  if (built !== undefined) {
    return { element: camel(built), many: false };
  }

  const call = calledMember(init);

  if (call === undefined) {
    return undefined;
  }

  const { typed } = judged;

  if (typed === undefined) {
    return conventionalModelName(call, several);
  }

  const reads = typed.isRepository(call.object) || repositoryConcept(call.object) !== undefined;

  return reads ? typed.modelOf(init) : undefined;
}
