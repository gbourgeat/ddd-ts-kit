import type { Workspace } from '../workspace';
import type { OrphanedRegion } from './keep-regions';

/** A region of a rewritten file this version does not hold, and the file. */
export interface OrphanedWiring extends OrphanedRegion {
  readonly file: string;
}

const GATEWAY = 'generate gateway <context> <upstreamContext> <Name>';
const GRANT = 'generate command <context> <UseCaseName> --permission <aggregate>.<action> --grant <role>';

/** The command that writes what a region holds again, by the name of the region. */
const RESTORED_BY: Readonly<Record<string, string>> = {
  bindings: GATEWAY,
  'test-bindings': GATEWAY,
  routes: 'generate route <context> <UseCaseName> --method <METHOD> --path <path>',
  'permission-sets': 'generate command <context> <UseCaseName> --permission <aggregate>.<action>',
  extracted: 'generate service <context>',
  'extracted-routes': 'generate service <context>',
  schemas: 'generate repository <context> <Aggregate>',
  events: 'generate integration-event <context> <Aggregate> <Fact>',
  jobs: 'generate job <context> <Name> --every <duration> --command <UseCaseName>',
  'system-grants': 'generate job <context> <Name> --every <duration> --command <UseCaseName>',
  policies: 'generate policy <context> <Name> --permission <aggregate>.<action>',
  copies: 'generate repository <context> <Aggregate> --personal <column>',
  exports: 'generate repository <context> <Aggregate> --personal <column>',
  roles: GRANT,
};

/**
 * What neither the template nor the tree gave back, file by file: a region this version no longer
 * holds, whose lines are not anywhere in the file. Git holds them, `--force` having refused to
 * replace a file it does not hold, and the command of each writes them again.
 */
export function orphanedWiringNotes(ws: Workspace, orphaned: readonly OrphanedWiring[]): string[] {
  return orphaned.flatMap(({ file, region, lines }) => {
    const text = ws.read(file) ?? '';
    const lost = lines.map((line) => line.trim()).filter((line) => !text.includes(line));

    if (lines.length > 0 && lost.length === 0) {
      return [];
    }

    const held = lost.length === 0 ? 'its grants' : `${lost.length} line(s) of it (${lost.join(' ')})`;

    return [
      `${file}: --force could not keep ${held}, this version has no "${region}" there and the tree does not say them. \`git show HEAD:${file}\` shows them; ${restoring(region)}.`,
    ];
  });
}

function restoring(region: string): string {
  const command = RESTORED_BY[region];

  return command === undefined ? 'put them back by hand' : `\`npx ddd-ts-kit ${command}\` writes them again`;
}
