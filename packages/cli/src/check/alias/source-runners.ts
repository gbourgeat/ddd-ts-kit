import type { Violation } from '../model/violation';
import { lineOf } from '../support/line-of';
import { ALIAS_FILES } from './alias-files';
import type { Inspected } from './inspected';
import { manifestScripts } from './manifest-scripts';

const { manifest: MANIFEST, typeCheck: TYPE_CHECK } = ALIAS_FILES;
/** The dev runner, which loads the TypeScript sources and reads the `paths` of the tsconfig it is given. */
const RUNS_SOURCES = /(?:^|[\s;&|(/])tsx(?:[\s/]|$)/;
const OTHER_TSCONFIG = /--tsconfig[=\s]+(?:\.\/)?(\S+)/;

/** A script that runs the sources under another tsconfig than the one that declares the alias. */
export function sourceRunners(inspected: Inspected): Violation[] {
  const read = manifestScripts(inspected);

  return (read?.scripts ?? []).flatMap(([name, command]) => {
    const given = RUNS_SOURCES.test(command) ? OTHER_TSCONFIG.exec(command)?.[1] : undefined;

    if (given === undefined || given === TYPE_CHECK) {
      return [];
    }

    return [
      inspected.report(
        { file: MANIFEST, line: lineOf(read?.text ?? '', `"${name}"`) },
        `The script "${name}" runs the sources with tsx under ${given}.`,
        `Remove --tsconfig: tsx then reads ${TYPE_CHECK}, whose "paths" declare the alias this rule holds; another file is a second declaration nothing compares.`,
      ),
    ];
  });
}
