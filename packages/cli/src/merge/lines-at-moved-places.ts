import { resolveImport } from '../check/project/resolve-import';
import { scan } from '../check/scan/scan';
import type { Config } from '../config';
import type { Workspace } from '../workspace';

/** A statement of the index that names a module: an import, an `export *` or an export by name. */
const NAMING = /^[ \t]*(?:import|export)\b[^;'"]*?\bfrom\s*'([^']+)';/gm;

/**
 * The lines of the merged index that name the place a side held a context's tables file at, which
 * the merged tree no longer holds: the other side moved the file (`context-layout`). The kit writes
 * nothing for them, the index left as the merge wrote it; each is said once, with the place of the
 * file in the merged tree, and the settle writes nothing in that merge. Answers the sentences.
 */
export function linesAtMovedPlaces(ws: Workspace, config: Config, moved: ReadonlyMap<string, string>): string[] {
  const index = `${config.platformDir}/database/schema.ts`;
  const held = ws.read(index) ?? '';
  const { code } = scan(held);

  const said = [...held.matchAll(NAMING)].flatMap((found) => {
    const [line, source = ''] = found;
    const target = resolveImport(config, index, source);
    const to = target.kind === 'file' ? moved.get(target.path) : undefined;

    // A line a comment holds names nothing.
    if (
      target.kind !== 'file' ||
      to === undefined ||
      !/^(?:import|export)\b/.test(code.slice(found.index + (/^[ \t]*/.exec(line)?.[0].length ?? 0)))
    ) {
      return [];
    }

    const context =
      Object.keys(config.contexts).find((name) => to.startsWith(`${config.contextsDir}/${name}/`)) ?? 'its context';

    const written = line.trim().replace(/\s+/g, ' ');

    return [
      `${index}: \`${written}\` names '${target.path}', which the merged tree no longer holds: ${context}'s tables file is now '${to}'; write that path in the line.`,
    ];
  });

  return said.length === 0
    ? []
    : [
        ...said,
        `${index}: the kit wrote no name in it, nor any other line of this merge, while a line names a place the merged tree no longer holds.`,
      ];
}
