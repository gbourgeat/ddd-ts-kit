import { declaredRoleOf } from '../../declared/roles.js';
import { classesOf } from '../declarations.js';
import { sourceAt } from '../project.js';
import { exportedClass, firstArgument, statementEnd } from '../text-shapes.js';
import type { Project, Rule, SourceFile } from '../types.js';
import { inContext, inLayer, isDeclaredStyle, pathInContext, reporter, toViolations, type Finding } from './helpers.js';

const REGISTRATION = /\.\s*(command|query)\s*\(\s*([A-Z][\w$]*)\s*\)/g;
const DECLARATION = /\.\s*(?:requires|public)\s*\(/;
const DEFINE_ROUTE = /(?<![\w$.])defineRoute\s*(?:<[^<>()]*>)?\s*\(/g;
const SECURITY = /(?<![\w$.])security\s*[:,}]/;
const MAP_ENTRY = /(?<![\w$.])(?:requires|publicUseCase)\s*\(\s*([\w$]+)/g;
const USE_CASE_FILE = /\.(command|query)\.ts$/;
const ACCESS_DECORATORS = ['Requires', 'Public'];

export const authzDeclared: Rule = {
  id: 'authz/declared',
  description: 'Every command, query and route declares the permission it requires, or declares itself public.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    return project.files.flatMap((file) => toViolations(report, file.path, [...undeclaredRegistrations(file, project), ...undeclaredMessages(file, project), ...routesWithoutSecurity(file)]));
  },
  /** Modules wired by hand list their use cases in an authorization map: every command and query has to be in it. */
  acrossProject(project) {
    if (project.config.stack.di === 'tsyringe' || isDeclaredStyle(project)) return [];
    const report = reporter(project, this.id);
    const declared = declaredUseCases(project);
    return project.files.flatMap((file) => toViolations(report, file.path, missingFromTheMap(file, declared)));
  },
};

function undeclaredRegistrations(file: SourceFile, project: Project): Finding[] {
  if (!inContext(file.location) || file.location.layer !== 'module') return [];
  const { code } = file.scan;
  const registrations = [...code.matchAll(REGISTRATION)];
  return registrations.flatMap((match, index) => {
    const [, kind = '', name = ''] = match;
    const next = registrations[index + 1]?.index ?? code.length;
    if (DECLARATION.test(code.slice(match.index, Math.min(next, statementEnd(code, match.index))))) return [];
    if (declaresItsAccess(messageSource(file, name, project), name)) return [];
    return [
      {
        line: file.scan.lineAt(match.index),
        message: `The ${kind} ${name} is registered without saying who may send it.`,
        fix: `Chain .requires(<context>Permissions['<permission>']) or .public() between .${kind}(${name}) and .handledBy(...): nothing is reachable by default.`,
      },
    ];
  });
}

/** The source that declares the class `name` used in `file`: the file its import points to, or the file itself. */
function messageSource(file: SourceFile, name: string, project: Project): SourceFile {
  const imported = file.imports.find(({ names }) => names.includes(name))?.target;
  return (imported?.kind === 'file' ? sourceAt(project, imported.path) : undefined) ?? file;
}

/** `@Requires(...)` or `@Public()` on the message class is the declaration, whoever registers the message. */
function declaresItsAccess(file: SourceFile, name: string): boolean {
  const message = classesOf(file.scan).find((candidate) => candidate.name === name);
  return message?.decorations.some((decoration) => ACCESS_DECORATORS.includes(decoration.name)) === true;
}

/** In the declared style there is no registration to read: the exported class of a command or query file says who may send it. */
function undeclaredMessages(file: SourceFile, project: Project): Finding[] {
  const role = isDeclaredStyle(project) && !file.isTest ? declaredRoleOf(pathInContext(project, file) ?? '') : undefined;
  const message = classesOf(file.scan).find((candidate) => candidate.exported);
  if (role === undefined || message === undefined || !['command', 'query'].includes(role.suffix)) return [];
  if (message.decorations.some((decoration) => ACCESS_DECORATORS.includes(decoration.name))) return [];
  return [
    {
      line: message.line,
      message: `The ${role.suffix} ${message.name} declares no permission and is not declared public.`,
      fix: `Put @Requires(<context>Permissions['<permission>']) above the class, or @Public() when anybody may send it, both imported from @ddd-ts-kit/kernel/declarations: nothing is reachable by default.`,
    },
  ];
}

function routesWithoutSecurity(file: SourceFile): Finding[] {
  const here = inLayer(file, 'presentation');
  if (here?.inside[0] !== 'http' || !/\.(?:route|controller)\.ts$/.test(file.path)) return [];
  const { code } = file.scan;
  return [...code.matchAll(DEFINE_ROUTE)].flatMap((match) => {
    const definition = firstArgument(code, match.index + match[0].length).trim();
    // A definition built elsewhere or by spreading cannot be read here.
    if (!definition.startsWith('{') || definition.includes('...') || SECURITY.test(definition)) return [];
    return [
      {
        line: file.scan.lineAt(match.index),
        message: 'The route does not declare its security.',
        fix: "Add `security: ['bearer']` (the schemes the route accepts) to the definition given to defineRoute, or `security: false` when the route is public on purpose.",
      },
    ];
  });
}

/** Per context, the classes named by `requires(X, ...)` or `publicUseCase(X)` in its module file or its authorization folder. */
function declaredUseCases(project: Project): ReadonlyMap<string, ReadonlySet<string>> {
  const declared = new Map<string, Set<string>>();
  for (const file of project.files) {
    const { location } = file;
    if (!inContext(location) || file.isTest) continue;
    if (location.layer !== 'module' && !(location.layer === 'application' && location.inside[0] === 'authorization')) continue;
    const names = declared.get(location.context) ?? new Set<string>();
    for (const match of file.scan.code.matchAll(MAP_ENTRY)) names.add(match[1] ?? '');
    declared.set(location.context, names);
  }
  return declared;
}

function missingFromTheMap(file: SourceFile, declared: ReadonlyMap<string, ReadonlySet<string>>): Finding[] {
  const here = inLayer(file, 'application');
  const kind = USE_CASE_FILE.exec(file.path)?.[1];
  if (here === undefined || kind === undefined || here.inside.length !== 3 || here.inside[0] !== (kind === 'command' ? 'commands' : 'queries')) return [];
  const useCase = exportedClass(file);
  if (useCase === undefined || isDeclared(file, useCase.name, declared.get(here.context))) return [];
  return [
    {
      line: useCase.line,
      message: `The ${kind} ${useCase.name} declares no permission and is not declared public.`,
      fix: `Add requires(${useCase.name}, <context>Permissions['<permission>']) or publicUseCase(${useCase.name}) to the authorization entries of ${here.context}.module.ts (or of a file in application/authorization/).`,
    },
  ];
}

function isDeclared(file: SourceFile, name: string, inTheMap: ReadonlySet<string> | undefined): boolean {
  return inTheMap?.has(name) === true || declaresItsAccess(file, name);
}
