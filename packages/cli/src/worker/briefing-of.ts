import type { BriefedSlice } from './briefed-slice.js';
import type { WorkerPlace } from './worker-place.js';

/** The report a worker keeps current in its worktree, ignored by git with the rest of `.ddd-ts-kit/`. */
const REPORT_FILE = '.ddd-ts-kit/report.md';

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
    '',
    ...scopeLines(place, directory),
    '',
    'Slices, in this order (rows of docs/architecture/slices.md)',
    ...sliceLines(place.slices),
    '',
    `Contracts you consume (read-only): ${contractsOf(place)}`,
    '',
    `Read first, and only: ${directory}/CONTEXT.md, then`,
    `\`npx ddd-ts-kit describe ${context} --json\`. Then the \`next\` places each generator prints.`,
    '',
    'For each slice: generate with --local-only --json, fill the TODO(domain) markers, replace every it.todo',
    `by a test, \`npm run regenerate\`, \`npx ddd-ts-kit check --changed-since ${trunk}\`, \`npm test -- ${context}\`,`,
    `then one commit, with the files regenerate rewrote: \`feat(${context}): <slice in business words>\`.`,
    `After each step, rewrite ${REPORT_FILE} in the worktree in the form of the report below: if you stop,`,
    'the conductor reads it there.',
    '',
    'Done when: every slice is committed, `npm run verify` is green in the worktree, and',
    `\`npx ddd-ts-kit todo ${context}\` lists nothing.`,
    '',
    'Report, always, even when you stop early, in under 200 words: slices done (commit hashes),',
    'slices not done and why, with the files left modified by an unfinished one, needs on shared',
    "files or on another context's contract, glossary terms added, open business questions. No",
    'code, no file contents.',
  ].join('\n');
}

function scopeLines({ config, generators }: WorkerPlace, directory: string): string[] {
  return [
    'Scope',
    `- You may write: ${directory}/** and test/e2e/<use-case>.e2e.spec.ts of your slices.`,
    `- You may not write anything else. Shared files (config, ${config.platformDir}, ${config.sourceRoot}/main.ts,`,
    '  package.json, lockfile, migrations, docs/) and other contexts are refused by the guard:',
    '  report the need, do not work around it. A slice that changes the stored state generates a',
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

  return slices.map(
    (row) => `- #${row.id} ${row.slice}: ${row.startWith}${row.rules === undefined ? '' : ` ; rules: ${row.rules}`}`,
  );
}

function contractsOf({ config, context }: WorkerPlace): string {
  const upstreams = config.contexts[context]?.upstreams ?? [];

  return upstreams.length > 0
    ? upstreams.map((upstream) => `${config.contextsDir}/${upstream.context}/published-language/`).join(', ')
    : 'none';
}
