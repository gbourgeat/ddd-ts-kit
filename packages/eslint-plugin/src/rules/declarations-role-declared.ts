import { AST_NODE_TYPES, type TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { className, exportedClasses, keyName, topLevelClasses, type ClassNode } from '../support/classes.js';
import {
  ACCESS_DECORATORS,
  DECLARATIONS_ENTRY,
  WRITTEN_NAMES,
  declarationReader,
  declaredRoleOf,
  isDeclaredStyle,
  writtenName,
  type Declaration,
  type DeclarationReader,
  type DeclaredRole,
} from '../support/declarations.js';
import { defineRule, type Report } from '../support/define-rule.js';
import { inContext, staticString } from '../support/imports.js';
import { classFinder, type ClassFinder } from '../support/project-classes.js';

type MessageId = 'undeclared' | 'wrongRole' | 'name' | 'eventName' | 'inDomain';
type Finding = TSESLint.ReportDescriptor<MessageId>;

export const declarationsRoleDeclared = defineRule<MessageId>({
  id: 'declarations/role-declared',
  type: 'problem',
  recommended: 'error',
  description: 'In a declared-style project, a role file exports a class carrying the decorator of its role, names are written as string literals, and the domain declares nothing.',
  messages: {
    undeclared: `This file is a role file of the declared style (\`*.{{suffix}}.ts\` under {{folder}}/) but exports no class carrying \`@{{expected}}\`. Put \`@{{expected}}(...)\` from "${DECLARATIONS_ENTRY}" on the exported class: a class that does not say what it is is in no assembly and is never registered.`,
    wrongRole:
      '{{className}} carries `@{{actual}}` in a `*.{{suffix}}.ts` file under {{folder}}/, where a class is declared with `@{{expected}}`. Move the class to the file of its role, or declare it with `@{{expected}}(...)`: the file name, the folder and the decorator say the same thing.',
    name: "`@{{decorator}}` of {{className}} has a `{{key}}` that is {{problem}}. Write `{ {{key}}: '{{context}}.<name>' }` as a string literal: the name is written once, never derived, and survives the renaming of the class.",
    eventName:
      '`@DomainEventHandler` of {{className}} names "{{declared}}", but {{event}} is named "{{actual}}". Write `{ name: \'{{actual}}\' }`: a handler names the domain event it reacts to by the name the event carries.',
    inDomain:
      '{{className}} carries `@{{decorator}}` under domain/: the domain declares nothing. Aggregates, entities, value objects, events, services and repository interfaces carry no decorator and name no token. Remove the decorator and declare the class of application/ or infrastructure/ that plays the role.',
  },
  create({ file, sourceCode, context, report }) {
    const here = inContext(file);
    if (here === undefined || file.isTest || !isDeclaredStyle(file)) return {};
    const declarationsOf = declarationReader(sourceCode.ast);
    if (here.layer === 'domain') return domain(declarationsOf, report);
    const findClass = classFinder(file, sourceCode.ast, context.languageOptions.parser);
    const role = declaredRoleOf(file);
    const judgeClass = (node: ClassNode): void => {
      for (const declaration of declarationsOf(node)) {
        const finding = unwrittenName(node, declaration, here.context) ?? renamedEvent(node, declaration, findClass);
        if (finding !== undefined) report(finding);
      }
    };
    return {
      Program: (program) => (role === undefined ? [] : misdeclaredRole(program, role, declarationsOf)).forEach(report),
      ClassDeclaration: judgeClass,
      ClassExpression: judgeClass,
    };
  },
});

function domain(declarationsOf: DeclarationReader, tell: Report<MessageId>): TSESLint.RuleListener {
  const judgeClass = (node: ClassNode): void => {
    for (const declaration of declarationsOf(node)) tell({ node: declaration.node, messageId: 'inDomain', data: { className: className(node), decorator: declaration.name } });
  };
  return { ClassDeclaration: judgeClass, ClassExpression: judgeClass };
}

/** `authz/declared` holds the two roles whose decorator says who may send a message. */
function misdeclaredRole(program: TSESTree.Program, role: DeclaredRole, declarationsOf: DeclarationReader): Finding[] {
  if (role.decorators.some((decorator) => ACCESS_DECORATORS.has(decorator))) return [];
  const data = { suffix: role.suffix, folder: role.folders.join(' or '), expected: role.decorators.join(' or @') };
  const playsRole = (declaration: Declaration): boolean => role.decorators.includes(declaration.name);
  const misplaced = topLevelClasses(program).flatMap((node) => declarationsOf(node).filter((declaration) => !playsRole(declaration)).map((declaration) => ({ node, declaration })));
  if (misplaced.length > 0) return misplaced.map(({ node, declaration }) => ({ node: declaration.node, messageId: 'wrongRole', data: { ...data, className: className(node), actual: declaration.name } }));
  const exported = exportedClasses(program);
  if (exported.some((node) => declarationsOf(node).some(playsRole))) return [];
  const [first] = exported;
  return [first === undefined ? { loc: { line: 1, column: 0 }, messageId: 'undeclared', data } : { node: first.id ?? first, messageId: 'undeclared', data }];
}

function unwrittenName(node: ClassNode, declaration: Declaration, context: string): Finding | undefined {
  const key = WRITTEN_NAMES[declaration.name];
  const written = key === undefined ? undefined : writtenName(declaration.arguments[1], key);
  if (key === undefined || written === undefined || 'value' in written) return undefined;
  return { node: declaration.node, messageId: 'name', data: { decorator: declaration.name, className: className(node), key, problem: written.problem, context } };
}

/** Compared only when the event class is in view: declared in this file, or imported by name from a file read from disk. */
function renamedEvent(node: ClassNode, declaration: Declaration, findClass: ClassFinder): Finding | undefined {
  const [event, options] = declaration.arguments;
  if (declaration.name !== 'DomainEventHandler' || event?.type !== AST_NODE_TYPES.Identifier) return undefined;
  const declared = writtenName(options, 'name');
  const site = findClass(event.name);
  const actual = site === undefined ? undefined : eventName(site.node);
  if (!('value' in declared) || actual === undefined || actual === declared.value) return undefined;
  return { node: declaration.node, messageId: 'eventName', data: { className: className(node), declared: declared.value, event: event.name, actual } };
}

/** `readonly name = 'billing.invoice.issued';`, with or without `as const`. */
function eventName(event: TSESTree.ClassDeclaration): string | undefined {
  for (const member of event.body.body) {
    if (member.type !== AST_NODE_TYPES.PropertyDefinition || member.computed || keyName(member.key) !== 'name' || member.value === null) continue;
    return staticString(unwrapped(member.value));
  }
  return undefined;
}

function unwrapped(value: TSESTree.Expression): TSESTree.Expression {
  return value.type === AST_NODE_TYPES.TSAsExpression || value.type === AST_NODE_TYPES.TSSatisfiesExpression ? unwrapped(value.expression) : value;
}
