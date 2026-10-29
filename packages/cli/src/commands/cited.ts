import { loadProject } from '../check/project/load-project';
import { formatCitations } from '../citations/format-citations';
import { formatRemovals } from '../citations/format-removals';
import { openRows } from '../citations/open-rows';
import { staleNamesAt } from '../citations/stale-names-at';
import { staleNamesSince } from '../citations/stale-names-since';
import { CliError } from '../cli-error';
import { runGit } from '../commit/run-git';
import { readConfig } from '../config';
import { readSlices, SLICES_FILE } from '../progress/read-slices';
import type { Slice } from '../progress/slice';
import { Workspace } from '../workspace';
import { Arguments } from './arguments';
import type { Command } from './command';
import { knownContext } from './known-context';
import { rowsOption } from './rows-option';
import { stdoutJson } from '../json/stdout-json';

/**
 * The names the design of rows not done cites that the code does not have: against a ref before
 * they are built, or, with --removed-since, those a change removes. Reads, never writes, and
 * exits 0: what it reports is for the conductor to correct in the documents.
 */
export const citedCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    rows: { type: 'string' },
    base: { type: 'string' },
    'removed-since': { type: 'string' },
  });

  const root = args.projectRoot;
  const { config } = readConfig(root);
  const [asked] = args.positionals;
  const slices = readSlices(new Workspace(root, false)) ?? [];
  const ids = rowsOption(args.text('rows')).rows;
  const rows = chosenRows(slices, asked === undefined ? undefined : knownContext(config, asked), ids);
  const since = args.text('removed-since');

  if (since !== undefined) {
    const open = openRows(root, slices);

    const selection = {
      rows: new Set(rows.filter((id) => open.has(id))),
      unlinked: asked === undefined && ids === undefined,
    };

    const removed = staleNamesSince(loadProject(root), knownRef(root, since), selection);

    io.out(args.json ? stdoutJson({ since, citations: removed }) : formatRemovals(removed, since));

    return 0;
  }

  const report = staleNamesAt(root, config, { ref: baseRef(root, args.text('base')), rows });

  io.out(args.json ? stdoutJson(report) : formatCitations(report, rows));

  return 0;
};

/** The rows asked for, each of which must exist; by default every row not done, of the context when one is given. */
function chosenRows(
  slices: readonly Slice[],
  context: string | undefined,
  ids: readonly string[] | undefined,
): string[] {
  if (ids === undefined) {
    return slices
      .filter(
        (row) => row.status !== 'done' && (context === undefined || row.context === context || row.owner === context),
      )
      .map((row) => row.id);
  }

  const unknown = ids.find((id) => !slices.some((row) => row.id === id));

  if (unknown !== undefined) {
    throw new CliError(
      `Row #${unknown} is not in ${SLICES_FILE}.`,
      'Pass the ids of the # column as written (`--rows 4.15,4.16`); `npx ddd-ts-kit status` lists them.',
    );
  }

  return [...ids];
}

/** `--base` when given, which must name a commit; the current branch otherwise. */
function baseRef(root: string, base: string | undefined): string {
  return base === undefined ? runGit(root, ['branch', '--show-current'])?.trim() || 'HEAD' : knownRef(root, base);
}

function knownRef(root: string, ref: string): string {
  if (runGit(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]) === undefined) {
    throw new CliError(
      `${ref} is not a commit of this repository.`,
      'Fetch it first (`git fetch origin`), or pass a branch, a tag or a commit: `--base origin/main`.',
    );
  }

  return ref;
}
