import path from 'node:path';
import { DECLARED_ROLES, declaredRoleOf, type DeclaredRole } from '../../declared/roles.js';
import { classesOf, DECLARATIONS_ENTRY, optionOf, type DeclaredClass, type Decoration } from '../declarations.js';
import { nameOfEventClass } from '../domain-event-names.js';
import { declaredEventHandlers } from '../declared-event-handlers.js';
import { sourceAt } from '../project.js';
import type { Project, Rule, SourceFile } from '../types.js';
import { inContext, isDeclaredStyle, pathInContext, reporter, toViolations, type Finding } from './helpers.js';

/** The option of each decorator that names what it declares, written once and never derived. */
const WRITTEN_NAMES: Readonly<Record<string, string>> = { IntegrationEventHandler: 'consumer', DomainEventHandler: 'name', Policy: 'name' };
/** `authz/declared` holds the messages: a command or a query says who may send it, or is reported there. */
const MESSAGE_SUFFIXES = ['command', 'query'];
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

export const declarationsRoleDeclared: Rule = {
  id: 'declarations/role-declared',
  description: 'In the declared style, a role file exports a class carrying the decorator of its role, with its names written as string literals, and domain/ declares nothing.',
  scope: 'file',
  run(project) {
    if (!isDeclaredStyle(project)) return [];
    const report = reporter(project, this.id);
    return project.files.flatMap((file) => {
      if (!inContext(file.location) || file.isTest) return [];
      const findings = file.location.layer === 'domain' ? declaredInTheDomain(file) : outsideTheDomain(file, project);
      return toViolations(report, file.path, findings);
    });
  },
};

function declaredInTheDomain(file: SourceFile): Finding[] {
  return decorated(file).map(({ declared, decoration }) => ({
    line: decoration.line,
    message: `${declared.name} carries @${decoration.name} under domain/: the domain declares nothing.`,
    fix: `Remove the decorator and the import of ${DECLARATIONS_ENTRY}: aggregates, entities, value objects, events, services and repository interfaces stay plain, and the class that plays the role (a handler, a policy, an adapter) is declared in application/ or infrastructure/.`,
  }));
}

function decorated(file: SourceFile): { declared: DeclaredClass; decoration: Decoration }[] {
  return classesOf(file.scan).flatMap((declared) => declared.decorations.map((decoration) => ({ declared, decoration })));
}

function outsideTheDomain(file: SourceFile, project: Project): Finding[] {
  const inside = pathInContext(project, file) ?? '';
  const role = declaredRoleOf(inside);
  const place = role === undefined ? misplaced(file) : undeclaredRole(file, role, inside);
  return [...place, ...unwrittenNames(file), ...renamedEvents(file, project)];
}

/** A declared class outside a role file is read by neither the barrel nor discovery; the module file may hold what it wants. */
function misplaced(file: SourceFile): Finding[] {
  if (inContext(file.location) && file.location.layer === 'module') return [];
  return decorated(file).map(({ declared, decoration }) => ({
    line: decoration.line,
    message: `${declared.name} carries @${decoration.name} in a file that is not a role file: neither the barrel nor discovery reads it.`,
    fix: `Move the class to the role file of @${decoration.name} (${roleFilesOf(decoration.name)}), one declared class per file.`,
  }));
}

function roleFilesOf(decorator: string): string {
  const roles = DECLARED_ROLES.filter((role) => role.decorators.includes(decorator));
  return roles.map((role) => `${role.folders[0] ?? ''}/**/*.${role.suffix}.ts`).join(' or ');
}

function undeclaredRole(file: SourceFile, role: DeclaredRole, inside: string): Finding[] {
  if (MESSAGE_SUFFIXES.includes(role.suffix)) return [];
  const exported = classesOf(file.scan).filter((declared) => declared.exported);
  if (exported.some((declared) => declared.decorations.some(({ name }) => role.decorators.includes(name)))) return [];
  const expected = role.decorators.map((name) => `@${name}`).join(' or ');
  const folder = role.folders.find((candidate) => inside.startsWith(`${candidate}/`)) ?? '';
  const other = decorated(file)[0];
  if (other !== undefined) {
    return [
      {
        line: other.decoration.line,
        message: `${other.declared.name} carries @${other.decoration.name}, but a *.${role.suffix}.ts file under ${folder}/ declares ${expected}.`,
        fix: `Declare an exported class with ${expected} here, or move ${other.declared.name} to the role file of @${other.decoration.name} (${roleFilesOf(other.decoration.name)}): a file is read for the role its name says.`,
      },
    ];
  }
  return [
    {
      line: exported[0]?.line ?? 1,
      message: `"${path.posix.basename(file.path)}" exports no class carrying ${expected}.`,
      fix: `Put ${expected}(...) from ${DECLARATIONS_ENTRY} above the exported class: in the declared style a class is registered by its declaration, and a role file without one is wired nowhere.`,
    },
  ];
}

function unwrittenNames(file: SourceFile): Finding[] {
  const context = inContext(file.location) ? file.location.context : '<context>';
  return decorated(file).flatMap(({ declared, decoration }) => {
    const key = WRITTEN_NAMES[decoration.name];
    const value = key === undefined ? undefined : optionOf(file.scan, decoration, key);
    if (key === undefined || (value?.literal !== undefined && value.literal !== '')) return [];
    return [
      {
        line: value?.line ?? decoration.line,
        message: `The ${key} of @${decoration.name} on ${declared.name} is ${value?.literal === '' ? 'empty' : 'not a string literal'}.`,
        fix: `Write it in place as a string literal, { ${key}: '${context}.<name>' }: a name that is written survives the renaming of the class and is read without running the code.`,
      },
    ];
  });
}

/** A domain event handler is attached under the name it writes: it has to be the name the event class carries. */
function renamedEvents(file: SourceFile, project: Project): Finding[] {
  return declaredEventHandlers(file.scan, 'DomainEventHandler').flatMap(({ event, name }) => {
    const carried = IDENTIFIER.test(event) ? nameOfEventClass(sourceDeclaring(file, event, project), event) : undefined;
    if (carried === undefined || name?.literal === undefined || name.literal === '' || name.literal === carried) return [];
    return [
      {
        line: name.line,
        message: `@DomainEventHandler is named "${name.literal}" but ${event} is named "${carried}".`,
        fix: `Write { name: '${carried}' }, the name ${event} carries: a handler attached under another name is never called.`,
      },
    ];
  });
}

/** The source that declares the class `name` used in `file`: the file its import points to, or the file itself. */
function sourceDeclaring(file: SourceFile, name: string, project: Project): SourceFile {
  const imported = file.imports.find(({ names }) => names.includes(name))?.target;
  return (imported?.kind === 'file' ? sourceAt(project, imported.path) : undefined) ?? file;
}
