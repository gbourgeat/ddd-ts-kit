import type { Rule, SourceFile } from '../types.js';
import { inLayers, reporter, toViolations, type Finding } from './helpers.js';

const AMBIENT_NAME =
  /(?<![\w$])(?:ActorContext|ACTOR_CONTEXT|AsyncLocalStorageActorContext|AsyncLocalStorage|ExecutionScope|EXECUTION_SCOPE|AsyncLocalStorageExecutionScope|ScopedActorContext)(?![\w$])/;
/** Kernel helpers that read the execution scope for a repository adapter: audit columns and the tenant of a statement. */
const INFRASTRUCTURE_HELPERS = ['tenantScopeOf', 'stampCreation', 'stampUpdate'];
/** `.current()` or `.require()` without argument on an actor context, or on something named `scope`, `scopes` or `...executionScope`. */
const AMBIENT_READ = /(?<![\w$])(?:[\w$]*(?:[aA]ctors|[aA]ctorContext|[eE]xecutionScope)|scopes?)\s*\.\s*(?:current|require)\s*\(\s*\)/;
const FIX =
  'Take the actor from the message: make the command or query extend AuthorizedCommand or AuthorizedQuery and read `command.actor`, and pass anything else the use case needs as data of the message; audit columns, tenant scoping and correlation are read from the ExecutionScope by infrastructure and the platform only (stampCreation, stampUpdate and tenantScopeOf belong in a repository adapter).';

export const authzActorExplicit: Rule = {
  id: 'authz/actor-explicit',
  description: 'Use cases receive the actor in the command or query: domain/ and application/ never read the ambient ExecutionScope or ActorContext.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    return project.files.flatMap((file) => toViolations(report, file.path, ambientActor(file)));
  },
};

function ambientActor(file: SourceFile): Finding[] {
  const here = inLayers(file, ['domain', 'application']);
  if (here === undefined) return [];
  const { code } = file.scan;
  const named = AMBIENT_NAME.exec(code);
  const read = AMBIENT_READ.exec(code);
  const findings: Finding[] = importedHelpers(file).map(({ name, line }) => ({ line, message: `${name}, a helper of infrastructure, is imported in the ${here.layer} layer.`, fix: FIX }));
  if (named !== null) findings.push({ line: file.scan.lineAt(named.index), message: `${named[0]} is used in the ${here.layer} layer.`, fix: FIX });
  if (read !== null) findings.push({ line: file.scan.lineAt(read.index), message: `The ambient context is read (${read[0].replace(/\s+/g, '')}) in the ${here.layer} layer.`, fix: FIX });
  return findings;
}

function importedHelpers(file: SourceFile): { name: string; line: number }[] {
  return file.imports.flatMap(({ names, line }) => names.filter((name) => INFRASTRUCTURE_HELPERS.includes(name)).map((name) => ({ name, line })));
}
