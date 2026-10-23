import type { Violation } from '../model/violation';
import { lineOf } from '../support/line-of';
import { ALIAS_FILES } from './alias-files';
import type { Inspected } from './inspected';
import { manifestScripts } from './manifest-scripts';

/** The compiler, called by its name, by its path or through a wrapper script named after it. */
const COMPILES = /(?:^|[\s/])tsc(?:\.[cm]?js)?(?=\s|$)/;
const TYPE_CHECK_ONLY = /--noEmit(?:\s|$)/;
const REWRITES = /(?:^|[\s/])(?:ddd-ts-kit|kit\.[cm]?js|bin\.js)\s+build-aliases(?:\s|$)/;
/** The build of the clients `ddd-ts-kit sdk` generates: their sources import one another by relative paths, no alias. */
const BUILDS_CLIENTS = /\s-[bp]\s+(?:\.\/)?clients(?:\/|\s|$)/;

/** A script that compiles and does not rewrite the aliases afterwards: plain `node` could not load what it emits. */
export function buildScripts(inspected: Inspected): Violation[] {
  const read = manifestScripts(inspected);

  return (read?.scripts ?? []).flatMap(([name, command]) => {
    const steps = command.split('&&').map((step) => step.trim());

    const compiled = steps.findLastIndex(
      (step) => COMPILES.test(step) && !TYPE_CHECK_ONLY.test(step) && !BUILDS_CLIENTS.test(step),
    );

    if (compiled === -1 || steps.slice(compiled + 1).some((step) => REWRITES.test(step))) {
      return [];
    }

    return [
      inspected.report(
        { file: ALIAS_FILES.manifest, line: lineOf(read?.text ?? '', `"${name}"`) },
        `The script "${name}" compiles and does not run \`ddd-ts-kit build-aliases\` afterwards.`,
        'Chain it after the compiler, `... && ddd-ts-kit build-aliases`: the compiler emits an alias as it was written, and Node resolves no alias, so the compiled output would stop at its first import.',
      ),
    ];
  });
}
