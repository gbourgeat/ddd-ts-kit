import fs from 'node:fs';
import path from 'node:path';
import { ADR_DIRECTORY } from '../check/governance/adr-directory.js';
import { runGit } from '../commit/run-git.js';
import type { Settled } from './merge-report.js';

/** What renumbering did: the records renamed, and the lines it rewrote (their titles, the links between translations), as `file:line` of the branch's files. */
export interface Renumbered {
  readonly settled: readonly Settled[];
  readonly rewritten: readonly string[];
}

/** The commits a renumbering compares: the base of the merge, the branch, the trunk. */
export interface AdrSides {
  readonly base: string;
  readonly ours: string;
  readonly trunk: string;
}

const NUMBERED = /^(\d{4})-(.+?)(\.[a-z]{2})?\.md$/;

/**
 * Gives the next free number to each decision record the branch added since the base whose
 * number the trunk took meanwhile, translations included: the file names, the `# ADR-NNNN`
 * title and the links between the translations.
 */
export function renumberAdrs(root: string, sides: AdrSides): Renumbered {
  const at = (commit: string): Set<string> => new Set(filesAt(root, commit));
  const [base, ours, trunk] = [at(sides.base), at(sides.ours), at(sides.trunk)];
  const taken = new Set([...trunk].filter((file) => !base.has(file) && !ours.has(file)).map(numberOf));
  const records = new Map<string, string>();

  for (const file of [...ours].filter((name) => !base.has(name) && !trunk.has(name)).sort()) {
    const [, number = '', slug = ''] = NUMBERED.exec(file) ?? [];

    if (taken.has(number)) {
      records.set(`${number}-${slug}`, number);
    }
  }

  if (records.size === 0) {
    return { settled: [], rewritten: [] };
  }

  let highest = Math.max(
    0,
    ...fs.readdirSync(path.join(root, ADR_DIRECTORY)).map((file) => Number(numberOf(file) || '0')),
  );

  const done = [...records].map(([record, number]) => {
    highest += 1;

    return renumbered(root, { record, number, next: String(highest).padStart(4, '0') });
  });

  return { settled: done.flatMap((one) => one.settled), rewritten: done.flatMap((one) => one.rewritten) };
}

function renumbered(
  root: string,
  { record, number, next }: { record: string; number: string; next: string },
): Renumbered {
  const directory = path.join(root, ADR_DIRECTORY);
  const files = fs.readdirSync(directory).filter((file) => file.startsWith(`${record}.`));
  const slug = record.slice(number.length + 1);
  const rewritten: string[] = [];

  for (const file of files) {
    const text = fs.readFileSync(path.join(directory, file), 'utf8');

    const written = text
      .replace(new RegExp(`^# ADR-${number}\\b`, 'm'), `# ADR-${next}`)
      .replaceAll(`${record}.`, `${next}-${slug}.`);

    const after = written.split('\n');

    rewritten.push(
      ...text
        .split('\n')
        .flatMap((line, index) => (line === after[index] ? [] : [`${ADR_DIRECTORY}/${file}:${index + 1}`])),
    );

    fs.writeFileSync(path.join(directory, file), written);
    fs.renameSync(path.join(directory, file), path.join(directory, file.replace(`${number}-`, `${next}-`)));
  }

  const settled = files.map(
    (file): Settled => ({
      file: `${ADR_DIRECTORY}/${file.replace(`${number}-`, `${next}-`)}`,
      kind: 'adr',
      how: `decision record renumbered ADR-${number} to ADR-${next}: the trunk took ${number} since the base`,
    }),
  );

  return { settled, rewritten };
}

function filesAt(root: string, commit: string): string[] {
  return (runGit(root, ['ls-tree', '--name-only', commit, '--', `${ADR_DIRECTORY}/`]) ?? '')
    .split('\n')
    .map((entry) => path.posix.basename(entry))
    .filter((file) => NUMBERED.test(file));
}

function numberOf(file: string): string {
  return NUMBERED.exec(file)?.[1] ?? '';
}
