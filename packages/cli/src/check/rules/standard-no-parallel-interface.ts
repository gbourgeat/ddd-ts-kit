import { BOUNDARY_NAMES, parallelNames, STANDARD_INTERFACES_FIX, standardNamesIn } from '../standard-interfaces.js';
import { identifier } from '../text-shapes.js';
import type { Rule, SourceFile } from '../types.js';
import { reporter, toViolations, type Finding } from './helpers.js';

/** A class or an interface with its heritage, or a type alias: `import { type X }` and `import type X from` declare nothing. */
const DECLARATION = /(?<![\w$.])(?:(class|interface)\s+([A-Za-z_$][\w$]*)([^{;]*)\{|(?<!import\s+)type\s+([A-Za-z_$][\w$]*)\s*(?:<[^=;{}]*>)?\s*=)/g;

export const standardNoParallelInterface: Rule = {
  id: 'standard/no-parallel-interface',
  description: 'No home-made copy of a standard interface of the kernel (ILogger, UserContext, PaginatedResult): use the kernel one and extend it by declaration merging.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    const names = parallelNames(project.config.standardInterfaces);
    return project.files.filter((file) => !file.isTest).flatMap((file) => toViolations(report, file.path, parallelDeclarations(file, names)));
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
