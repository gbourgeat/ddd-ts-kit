import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { BOUNDARY_NAMES } from '../standard/boundary-names.js';
import { parallelNames } from '../standard/parallel-names.js';
import { STANDARD_INTERFACES_FIX } from '../standard/standard-interfaces-fix.js';
import { standardNamesIn } from '../standard/standard-names-in.js';
import { perFile } from '../support/per-file.js';
import { identifier } from '../text/identifier.js';

/** A class or an interface with its heritage, or a type alias: `import { type X }` and `import type X from` declare nothing. */
const DECLARATION = /(?<![\w$.])(?:(class|interface)\s+([A-Za-z_$][\w$]*)([^{;]*)\{|(?<!import\s+)type\s+([A-Za-z_$][\w$]*)\s*(?:<[^=;{}]*>)?\s*=)/g;

export const standardNoParallelInterface: Rule = {
  id: 'standard/no-parallel-interface',
  description: 'No home-made copy of a standard interface of the kernel (ILogger, UserContext, PaginatedResult, CronJob, ErrorTracker): use the kernel one and extend it by declaration merging.',
  scope: 'file',
  run(project) {
    const names = parallelNames(project.config.standardInterfaces);

    return perFile(project, this.id, (file) => (file.isTest ? [] : parallelDeclarations(file, names)));
  },
};

function parallelDeclarations(file: SourceFile, names: ReadonlyMap<string, string>): Finding[] {
  return [...file.scan.code.matchAll(DECLARATION)].flatMap((match) => {
    const [, kind, declared, heritage = '', alias] = match;
    const name = declared ?? alias ?? '';
    const instead = names.get(name);

    if (instead === undefined || isAtTheBoundary(file, name)) return [];
    if (kind === 'class' && implementsOneOf(heritage, standardNamesIn(instead))) return [];

    return [{ line: file.scan.lineAt(match.index), message: `${name} is a home-made copy of a standard interface: use ${instead}.`, fix: STANDARD_INTERFACES_FIX }];
  });
}

function isAtTheBoundary({ location }: SourceFile, name: string): boolean {
  if (!BOUNDARY_NAMES.includes(name)) return false;

  return location.area === 'platform' || (location.area === 'context' && location.layer === 'presentation');
}

/** An adapter that implements or extends the standard interface is an implementation of it, not a second interface. */
function implementsOneOf(heritage: string, standardNames: readonly string[]): boolean {
  const clause = /(?<![\w$])(?:implements|extends)(?![\w$])[\s\S]*/.exec(heritage)?.[0] ?? '';

  return standardNames.some((name) => identifier(name).test(clause));
}
