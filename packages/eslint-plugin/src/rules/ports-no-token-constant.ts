import path from 'node:path';
import { ASTUtils, AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { defineRule, type Report } from '../support/rule/define-rule.js';
import { propertyName } from '../support/globals/property-name.js';
import { inSourceRoot } from '../support/imports/in-source-root.js';
import { bindingCallReader } from '../support/ports/binding-call-reader.js';
import { dependencyListListener } from '../support/ports/dependency-list-listener.js';

type MessageId = 'tokenCall' | 'madeToken' | 'literalToken' | 'constant' | 'tokenFile';
type Source = Readonly<TSESLint.SourceCode>;

const KIT = /^@ddd-ts-kit\//;
const UPPER_SNAKE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const TOKEN_FILE = /(?:\.ports|^tokens)\.ts$/;

const INSTEAD =
  'Declare the port as an abstract class (domain/repositories/*.repository.ts or application/ports/*.port.ts) and name that class wherever the dependency is bound, listed or resolved: the class is the contract and the injection token at once.';

export const portsNoTokenConstant = defineRule<MessageId>({
  id: 'ports/no-token-constant',
  type: 'problem',
  recommended: 'error',
  description:
    'There is no token constant and no token file: a dependency is named by the abstract class of its port, never by `token(..)`, a symbol, a string or an UPPER_SNAKE constant.',
  messages: {
    tokenCall: `\`{{call}}(..)\` makes an injection token. ${INSTEAD}`,
    madeToken: `{{name}} is a symbol used as an injection token. ${INSTEAD}`,
    literalToken: `\`{{call}}(..)\` is given {{what}} as its token. ${INSTEAD}`,
    constant: `{{name}} in this dependency list is a token constant. ${INSTEAD} Write the name of the port class here.`,
    tokenFile: `{{file}} is a token file. ${INSTEAD} Move each port to its own file and delete this one.`,
  },
  create({ file, sourceCode, report }) {
    const bindingCall = bindingCallReader(sourceCode.ast);
    const tokenMakers = importedTokenMakers(sourceCode.ast);
    const tellGivenToken = givenTokenReporter(sourceCode, report);

    const lists = dependencyListListener(sourceCode.ast, (dependency) => {
      if (dependency.name.length > 1 && UPPER_SNAKE.test(dependency.name)) {
        report({ node: dependency, messageId: 'constant', data: { name: dependency.name } });
      }
    });

    return {
      ...lists,
      Program() {
        const base = path.posix.basename(file.path);

        if (inSourceRoot(file) && TOKEN_FILE.test(base)) {
          report({ loc: { line: 1, column: 0 }, messageId: 'tokenFile', data: { file: base } });
        }
      },
      CallExpression(node) {
        lists.CallExpression?.(node);

        if (isTokenMaker(node.callee, tokenMakers)) {
          report({ node, messageId: 'tokenCall', data: { call: sourceCode.getText(node.callee) } });
        }

        const call = bindingCall(node);
        const [given] = node.arguments;

        if (call !== undefined && given !== undefined) {
          tellGivenToken(call, given);
        }
      },
    };
  },
});

/** What a binding call is given instead of a port class: a symbol, a string, or a constant holding a symbol. */
function givenTokenReporter(
  sourceCode: Source,
  report: Report<MessageId>,
): (call: string, given: TSESTree.CallExpressionArgument) => void {
  return (call, given) => {
    if (isSymbol(given)) {
      report({ node: given, messageId: 'literalToken', data: { call, what: 'a symbol' } });
    }

    if (given.type === AST_NODE_TYPES.Literal && typeof given.value === 'string') {
      report({ node: given, messageId: 'literalToken', data: { call, what: 'a string' } });
    }

    if (given.type === AST_NODE_TYPES.Identifier && isDeclaredAsSymbol(sourceCode, given)) {
      report({ node: given, messageId: 'madeToken', data: { name: given.name } });
    }
  };
}

interface TokenMakers {
  readonly named: ReadonlySet<string>;
  readonly namespaces: ReadonlySet<string>;
}

/** The local names of `token` imported from a package of the kit, and the namespaces it can be reached through. */
function importedTokenMakers(program: TSESTree.Program): TokenMakers {
  const imports = program.body.filter(
    (statement) => statement.type === AST_NODE_TYPES.ImportDeclaration && KIT.test(statement.source.value),
  );

  const specifiers = imports.flatMap((statement) =>
    statement.type === AST_NODE_TYPES.ImportDeclaration ? statement.specifiers : [],
  );

  const named = specifiers.filter(
    (specifier) =>
      specifier.type === AST_NODE_TYPES.ImportSpecifier &&
      specifier.imported.type === AST_NODE_TYPES.Identifier &&
      specifier.imported.name === 'token',
  );

  const namespaces = specifiers.filter((specifier) => specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier);

  return {
    named: new Set(named.map((specifier) => specifier.local.name)),
    namespaces: new Set(namespaces.map((specifier) => specifier.local.name)),
  };
}

function isTokenMaker(callee: TSESTree.Expression, makers: TokenMakers): boolean {
  if (callee.type === AST_NODE_TYPES.Identifier) {
    return makers.named.has(callee.name);
  }

  return (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    callee.object.type === AST_NODE_TYPES.Identifier &&
    makers.namespaces.has(callee.object.name) &&
    propertyName(callee) === 'token'
  );
}

/** `Symbol('clock')` and `Symbol.for('clock')`. */
function isSymbol(node: TSESTree.Node | null): boolean {
  if (node?.type !== AST_NODE_TYPES.CallExpression) {
    return false;
  }

  const { callee } = node;

  if (callee.type === AST_NODE_TYPES.Identifier) {
    return callee.name === 'Symbol';
  }

  return (
    callee.type === AST_NODE_TYPES.MemberExpression &&
    callee.object.type === AST_NODE_TYPES.Identifier &&
    callee.object.name === 'Symbol' &&
    propertyName(callee) === 'for'
  );
}

function isDeclaredAsSymbol(sourceCode: Source, identifier: TSESTree.Identifier): boolean {
  const declared = ASTUtils.findVariable(sourceCode.getScope(identifier), identifier.name)?.defs[0]?.node;

  return declared?.type === AST_NODE_TYPES.VariableDeclarator && isSymbol(declared.init);
}
