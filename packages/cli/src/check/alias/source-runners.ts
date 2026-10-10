import { SOURCE_CONDITION } from '../../alias/index.js';
import type { Violation } from '../model/violation.js';
import { isRecord } from '../support/is-record.js';
import { lineOf } from '../support/line-of.js';
import { ALIAS_FILES } from './alias-files.js';
import type { Inspected } from './inspected.js';
import { parseJsonc } from './parse-jsonc.js';
import { readProjectFile } from './read-project-file.js';

const { manifest: MANIFEST } = ALIAS_FILES;
/** Tools that load TypeScript sources of the project themselves: the dev runner, and drizzle-kit for the schema. */
const RUNS_SOURCES = /(?:^|[\s;&|(/])(tsx|drizzle-kit)(?:[\s/]|$)/;
const WITH_CONDITION = new RegExp(String.raw`(?:--conditions|-C)[=\s]+${SOURCE_CONDITION}(?:[\s'"]|$)`);

/** A script that runs the TypeScript sources without the source condition: it would be answered the compiled files. */
export function sourceRunners({ project, report }: Inspected): Violation[] {
  const text = readProjectFile(project, MANIFEST);
  const manifest = text === undefined ? undefined : parseJsonc(text);
  const scripts = manifest !== undefined && isRecord(manifest['scripts']) ? manifest['scripts'] : {};

  return Object.entries(scripts).flatMap(([name, command]) => {
    const runner =
      typeof command === 'string' && !WITH_CONDITION.test(command) ? RUNS_SOURCES.exec(command)?.[1] : undefined;

    return runner === undefined ? [] : [unconditioned({ report, text: text ?? '' }, name, runner)];
  });
}

interface Reported {
  readonly report: Inspected['report'];
  readonly text: string;
}

function unconditioned({ report, text }: Reported, name: string, runner: string): Violation {
  const how =
    runner === 'tsx'
      ? `Add --conditions=${SOURCE_CONDITION} after tsx`
      : `Run it as \`node --conditions=${SOURCE_CONDITION} node_modules/${runner}/bin.cjs\``;

  return report(
    { file: MANIFEST, line: lineOf(text, `"${name}"`) },
    `The script "${name}" runs the sources with ${runner} without the condition "${SOURCE_CONDITION}".`,
    `${how}: without the condition an alias is answered the compiled file under dist/, stale or absent, instead of the source being edited.`,
  );
}
