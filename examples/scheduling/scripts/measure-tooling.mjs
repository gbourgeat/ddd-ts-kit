// Measures what the generators wrote against what was written or edited by hand, from the copy
// `scripts/kit.mjs` keeps of every generator output, and summarises the generator log.
//
//   node scripts/measure-tooling.mjs            a Markdown summary
//   node scripts/measure-tooling.mjs --json     the same as data
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateDir = path.resolve(root, '../../node_modules/.cache/ddd-ts-kit-example');
const snapshotDir = path.join(stateDir, 'generated');
const SKIPPED = new Set(['node_modules', 'dist', 'coverage', '.env', 'reports']);
const DERIVED = [
  /\.declarations\.ts$/,
  /^openapi\//,
  /^docs\/integration\/asyncapi\.json$/,
  /^docs\/integration\/event-catalog\.md$/,
  /^\.dependency-cruiser\.cjs$/,
];
const MARKERS = {
  'TODO(domain)': /TODO\(domain\)/g,
  'TODO(platform)': /TODO\(platform\)/g,
  'it.todo': /\bit\.todo\(/g,
};

const files = walk(root).map(measure);
const report = { areas: byArea(files), totals: totalsOf(files), markers: markers(), generators: generators() };

process.stdout.write(process.argv.includes('--json') ? JSON.stringify(report, null, 2) + '\n' : markdownOf(report));

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (SKIPPED.has(entry.name)) {
      return [];
    }

    const absolute = path.join(directory, entry.name);

    return entry.isDirectory() ? walk(absolute) : [path.relative(root, absolute)];
  });
}

/** One file: the lines a generator wrote and that are still there, the lines written or changed by hand, the generated lines removed. */
function measure(file) {
  const lines = linesOf(path.join(root, file));
  const copy = path.join(snapshotDir, file);

  if (DERIVED.some((pattern) => pattern.test(file))) {
    return { file, origin: 'derived', generated: lines, hand: 0, removed: 0 };
  }
  if (!fs.existsSync(copy)) {
    return { file, origin: 'hand', generated: 0, hand: lines, removed: 0 };
  }

  const diff = spawnSync('diff', ['-U0', copy, path.join(root, file)], { encoding: 'utf8' }).stdout.split('\n');
  const added = diff.filter((line) => line.startsWith('+') && !line.startsWith('+++')).length;
  const removed = diff.filter((line) => line.startsWith('-') && !line.startsWith('---')).length;

  return {
    file,
    origin: added + removed === 0 ? 'generated, untouched' : 'generated, edited',
    generated: lines - added,
    hand: added,
    removed,
  };
}

function linesOf(file) {
  const text = fs.readFileSync(file, 'utf8');

  return text === '' ? 0 : text.replace(/\n$/, '').split('\n').length;
}

function areaOf(file) {
  const context = /^src\/contexts\/([^/]+)\/([^/]+)/.exec(file);

  if (context !== null) {
    return `${context[1]}: ${context[2].includes('.') ? 'context files' : context[2]}`;
  }
  if (file.startsWith('src/platform/') || file.startsWith('src/apps/') || file === 'src/main.ts') {
    return 'platform and composition';
  }
  if (file.startsWith('test/')) {
    return 'end-to-end and architecture tests';
  }
  if (file.startsWith('docs/')) {
    return 'documents';
  }
  if (file.startsWith('scripts/')) {
    return 'scripts';
  }

  return 'project files';
}

function byArea(measured) {
  const areas = new Map();

  for (const entry of measured) {
    const area = areas.get(areaOf(entry.file)) ?? emptyCount();

    add(area, entry);
    areas.set(areaOf(entry.file), area);
  }

  return Object.fromEntries([...areas].sort(([a], [b]) => a.localeCompare(b)));
}

function totalsOf(measured) {
  const total = emptyCount();

  for (const entry of measured) {
    add(total, entry);
  }

  return total;
}

function emptyCount() {
  return {
    files: 0,
    untouched: 0,
    edited: 0,
    byHand: 0,
    derived: 0,
    generatedLines: 0,
    handLines: 0,
    removedGeneratedLines: 0,
  };
}

function add(count, entry) {
  count.files += 1;
  count.untouched += entry.origin === 'generated, untouched' ? 1 : 0;
  count.edited += entry.origin === 'generated, edited' ? 1 : 0;
  count.byHand += entry.origin === 'hand' ? 1 : 0;
  count.derived += entry.origin === 'derived' ? 1 : 0;
  count.generatedLines += entry.generated;
  count.handLines += entry.hand;
  count.removedGeneratedLines += entry.removed;
}

/** The markers the generators wrote in all, and those still in the tree. */
function markers() {
  return Object.fromEntries(
    Object.entries(MARKERS).map(([name, pattern]) => [
      name,
      { generated: occurrences(snapshotDir, pattern), left: occurrences(root, pattern, true) },
    ]),
  );
}

function occurrences(directory, pattern, sourcesOnly = false) {
  if (!fs.existsSync(directory)) {
    return 0;
  }

  return walkFrom(directory)
    .filter((file) => !sourcesOnly || /^(src|test)\//.test(path.relative(directory, file)))
    .reduce((sum, file) => sum + (fs.readFileSync(file, 'utf8').match(pattern)?.length ?? 0), 0);
}

function walkFrom(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (SKIPPED.has(entry.name)) {
      return [];
    }

    return entry.isDirectory() ? walkFrom(path.join(directory, entry.name)) : [path.join(directory, entry.name)];
  });
}

function generators() {
  const log = path.join(stateDir, 'generator-log.jsonl');

  if (!fs.existsSync(log)) {
    return { runs: 0, byKind: {}, byWorker: {}, failed: 0, totalMs: 0 };
  }

  const runs = fs
    .readFileSync(log, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
    .filter((run) => run.command === 'generate' || run.command === 'init');
  const succeeded = runs.filter((run) => run.exit === 0);

  return {
    runs: succeeded.length,
    failed: runs.length - succeeded.length,
    totalMs: succeeded.reduce((sum, run) => sum + run.ms, 0),
    byKind: tally(succeeded, (run) => run.kind),
    byWorker: tally(succeeded, (run) => run.worker),
  };
}

function tally(runs, keyOf) {
  const counts = {};

  for (const run of runs) {
    counts[keyOf(run)] = (counts[keyOf(run)] ?? 0) + 1;
  }

  return counts;
}

function markdownOf({ areas, totals, markers: left, generators: runs }) {
  const row = (name, count) =>
    `| ${name} | ${count.files} | ${count.untouched} | ${count.edited} | ${count.byHand} | ${count.derived} | ${count.generatedLines} | ${count.handLines} | ${count.removedGeneratedLines} |`;
  const lines = [
    '| Area | Files | Generated, untouched | Generated, edited | Written by hand | Derived (regenerated) | Generated lines kept | Lines by hand | Generated lines removed |',
    '|---|---|---|---|---|---|---|---|---|',
    ...Object.entries(areas).map(([name, count]) => row(name, count)),
    row('**Total**', totals),
    '',
    '| Marker | Written by generators | Left in `src/` and `test/` |',
    '|---|---|---|',
    ...Object.entries(left).map(([name, count]) => `| \`${name}\` | ${count.generated} | ${count.left} |`),
    '',
    `Generator runs: ${runs.runs} succeeded, ${runs.failed} refused, ${Math.round(runs.totalMs / 1000)} s in all.`,
    '',
    '| Kind | Runs |',
    '|---|---|',
    ...Object.entries(runs.byKind)
      .sort(([, a], [, b]) => b - a)
      .map(([kind, count]) => `| ${kind} | ${count} |`),
    '',
    '| Worker | Runs |',
    '|---|---|',
    ...Object.entries(runs.byWorker).map(([worker, count]) => `| ${worker} | ${count} |`),
  ];

  return lines.join('\n') + '\n';
}
