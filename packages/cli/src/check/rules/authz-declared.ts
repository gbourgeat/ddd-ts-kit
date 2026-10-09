import { exportedClass, firstArgument, statementEnd } from '../text-shapes.js';
import type { Project, Rule, SourceFile } from '../types.js';
import { inContext, inLayer, reporter, toViolations, type Finding } from './helpers.js';

const REGISTRATION = /\.\s*(command|query)\s*\(\s*([A-Z][\w$]*)\s*\)/g;
const DECLARATION = /\.\s*(?:requires|public)\s*\(/;
const DEFINE_ROUTE = /(?<![\w$.])defineRoute\s*(?:<[^<>()]*>)?\s*\(/g;
const SECURITY = /(?<![\w$.])security\s*[:,}]/;
const MAP_ENTRY = /(?<![\w$.])(?:requires|publicUseCase)\s*\(\s*([\w$]+)/g;
const USE_CASE_FILE = /\.(command|query)\.ts$/;

export const authzDeclared: Rule = {
  id: 'authz/declared',
  description: 'Every command, query and route declares the permission it requires, or declares itself public.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    return project.files.flatMap((file) => toViolations(report, file.path, [...undeclaredRegistrations(file), ...routesWithoutSecurity(file)]));
  },
  /** Modules wired by hand list their use cases in an authorization map: every command and query has to be in it. */
  acrossProject(project) {
    if (project.config.stack.di === 'tsyringe') return [];
    const report = reporter(project, this.id);
    const declared = declaredUseCases(project);
    return project.files.flatMap((file) => toViolations(report, file.path, missingFromTheMap(file, declared)));
  },
};

function undeclaredRegistrations(file: SourceFile): Finding[] {
  if (!inContext(file.location) || file.location.layer !== 'module') return [];
  const { code } = file.scan;
  const registrations = [...code.matchAll(REGISTRATION)];
  return registrations.flatMap((match, index) => {
    const [, kind = '', name = ''] = match;
    const next = registrations[index + 1]?.index ?? code.length;
    if (DECLARATION.test(code.slice(match.index, Math.min(next, statementEnd(code, match.index))))) return [];
    return [
      {
        line: file.scan.lineAt(match.index),
        message: `The ${kind} ${name} is registered without saying who may send it.`,
        fix: `Chain .requires(<context>Permissions['<permission>']) or .public() between .${kind}(${name}) and .handledBy(...): nothing is reachable by default.`,
      },
    ];
  });
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
  if (useCase === undefined || declared.get(here.context)?.has(useCase.name) === true) return [];
  return [
    {
      line: useCase.line,
      message: `The ${kind} ${useCase.name} declares no permission and is not declared public.`,
      fix: `Add requires(${useCase.name}, <context>Permissions['<permission>']) or publicUseCase(${useCase.name}) to the authorization entries of ${here.context}.module.ts (or of a file in application/authorization/).`,
    },
  ];
}
