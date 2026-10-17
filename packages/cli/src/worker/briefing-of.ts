import { inDialect } from '../package-manager/in-dialect.js';
import type { BriefedSlice } from './briefed-slice.js';
import { designLine } from './design-line.js';
import { REPORT_FILE } from './report-file.js';
import { staleNamesBlock } from './stale-names-block.js';
import type { WorkerPlace } from './worker-place.js';

/**
 * A need marked blocking stops the row until the conductor does it; a note waits for the merge
 * while the run goes on. Without the mark, every need stopped the run.
 */
const REPORT_LINES = [
  'Report, always, even when you stop early, in under 200 words: slices done (commit hashes),',
  'slices not done and why, with the files left modified by an unfinished one, needs on shared',
  "files or on another context's contract, each marked blocking (a slice cannot be finished",
  'without it: a migration, a contract field, a shared file, a dependency) or note (done at the',
  'merge: a permission to grant, a registration), glossary terms added, open business questions.',
  'No code, no file contents.',
];

/**
 * The briefing of a context worker, as the parallel-work skill of the plugin writes it, with
 * what the project says filled in. What only the conductor knows stays between angle brackets.
 */
export function briefingOf(place: WorkerPlace): string {
  const { context, root, trunk } = place;
  const directory = `${place.config.contextsDir}/${context}`;

  return [
    `You build the bounded context ${context} of ${place.project}.`,
    '',
    `Worktree: ${root}   Branch: ${place.branch}   Trunk: ${trunk}`,
    `Run every command from the worktree (\`cd ${root} && ...\` or \`--cwd ${root}\`).`,
    `Without node_modules: \`${inDialect('npm ci', place.config.stack.packageManager)}\`, never an install that names a package.`,
    '',
    ...scopeLines(place, directory),
    '',
    'Slices, in this order (rows of docs/architecture/slices.md)',
    ...sliceLines(place.slices),
    ...staleNamesBlock(place.citations),
    '',
    `Contracts you consume (read-only): ${contractsOf(place)}`,
    '',
    `Read first, and only: ${directory}/CONTEXT.md, then`,
    `\`npx ddd-ts-kit describe ${context} --json\`. Then the \`next\` places each generator prints.`,
    '',
    ...stepLines(place),
    '',
    ...REPORT_LINES,
  ].join('\n');
}

function stepLines({ context, trunk }: WorkerPlace): string[] {
  return [
    'For each slice: generate with --local-only --json, fill the TODO(domain) markers, replace every it.todo',
    `by a test, then \`npx ddd-ts-kit verify-slice ${context} --since ${trunk}\` (regenerate, the rules on your changed`,
    'files, the tests of the context, the files near the size limit) until it passes, then one commit of the paths it',
    `lists to stage, one by one, never one it leaves out: \`feat(${context}): <slice in business words>\`.`,
    'Format with `npm run format`, then `npm run lint:fix` (a blank line asked after a wrapped line is expected);',
    'never Prettier nor a bare `npx biome`.',
    `After each step, rewrite ${REPORT_FILE} in the worktree in the form of the report below: if you stop,`,
    'the conductor reads it there.',
    `To bring the trunk in: \`git merge ${trunk}\`, each hunk resolved keeping both sides, never \`-X theirs/ours\` or`,
    '`checkout --theirs/--ours` on a source file, then `npx ddd-ts-kit verify-merge`. A spec of a delivered row',
    'that a change of this branch broke is adapted in this branch, in a commit of its own.',
    'Restore each loss verify-merge lists before going on: verify-slice and the push only warn in this version.',
    '',
    'Done when: every slice is committed, `npm run verify` is green in the worktree (the whole tree:',
    `\`check --changed-since\` sees your files only), and \`npx ddd-ts-kit todo ${context}\` lists nothing but`,
    '`TODO(review)` lines: those remarks of a review are followed by the conductor, leave them.',
  ];
}

function scopeLines({ config, generators }: WorkerPlace, directory: string): string[] {
  return [
    'Scope',
    `- You may write: ${directory}/** and test/e2e/<use-case>.e2e.spec.ts of your slices.`,
    `- You may not write anything else. Shared files (config, ${config.platformDir}, ${config.sourceRoot}/main.ts,`,
    '  package.json, lockfile, migrations, docs/) and other contexts are refused by the guard:',
    '  report the need, do not work around it. The shell writes inside your scope only, as the editor tools do:',
    '  a write outside it is refused, and inline code (`node -e`, a heredoc) that changed one stops you. A slice that changes the stored state generates a',
    '  working migration only: `npm run db:generate working-<what-it-does>`. A decision taken in a slice is',
    '  recorded by `generate adr` (without --deviation), and committed with it. The derived files (generated',
    '  documents, barrels, context map, dependency rules) are written by `npm run regenerate`, never by hand.',
    `- Generators you may run: ${generators.join(', ')}.`,
    '  The others are run by the conductor.',
  ];
}

function sliceLines(slices: readonly BriefedSlice[]): string[] {
  if (slices.length === 0) {
    return ['- #<n> <slice>: <generator commands of the row> ; rules: <invariants and failures by name>'];
  }

  return slices.flatMap((row) => [
    `- #${row.id} ${row.slice}: ${row.startWith}${row.rules === undefined ? '' : ` ; rules: ${row.rules}`}`,
    ...designLine(row),
  ]);
}

function contractsOf({ config, context }: WorkerPlace): string {
  const upstreams = config.contexts[context]?.upstreams ?? [];

  return upstreams.length > 0
    ? upstreams.map((upstream) => `${config.contextsDir}/${upstream.context}/published-language/`).join(', ')
    : 'none';
}
