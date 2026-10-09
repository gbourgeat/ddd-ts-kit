import type { Rule, SourceFile } from '../types.js';
import { inLayers, reporter, toViolations, type Finding } from './helpers.js';

const AMBIENT_TYPE = /(?<![\w$])(?:ActorContext|ACTOR_CONTEXT|AsyncLocalStorageActorContext|AsyncLocalStorage)(?![\w$])/;
const AMBIENT_READ = /(?<![\w$])[\w$]*(?:[aA]ctors|[aA]ctorContext)\s*\.\s*(?:current|require)\s*\(\s*\)/;
const FIX =
  'Take the actor from the message: make the command or query extend AuthorizedCommand or AuthorizedQuery and read `command.actor`; only infrastructure reads ActorContext, for audit columns and tenant scoping.';

export const authzActorExplicit: Rule = {
  id: 'authz/actor-explicit',
  description: 'Use cases receive the actor in the command or query: domain/ and application/ never read an ambient actor.',
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
  const named = AMBIENT_TYPE.exec(code);
  const read = AMBIENT_READ.exec(code);
  const findings: Finding[] = [];
  if (named !== null) findings.push({ line: file.scan.lineAt(named.index), message: `${named[0]} is used in the ${here.layer} layer.`, fix: FIX });
  if (read !== null) findings.push({ line: file.scan.lineAt(read.index), message: `The ambient actor is read (${read[0].replace(/\s+/g, '')}) in the ${here.layer} layer.`, fix: FIX });
  return findings;
}
