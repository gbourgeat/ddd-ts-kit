import type { Finding } from '../model/finding.js';
import { lineOf } from '../support/line-of.js';
import type { DrizzleMigrations, JournalEntry } from './drizzle-migrations.js';

const REGENERATE =
  'Keep the migrations of the main branch, delete the one of your branch (its .sql file, its snapshot under meta/ and its entry of meta/_journal.json), then run `npm run db:generate <name>` again on top of them.';

/**
 * What makes drizzle-kit and its migrator misbehave after a merge: an entry without its file or
 * the reverse, entries out of the order they were generated in (the migrator skips a migration
 * older than the last one a database applied), and two snapshots generated from the same one.
 */
export function drizzleHistoryFindings(migrations: DrizzleMigrations): Finding[] {
  return [...unmatched(migrations), ...outOfOrder(migrations), ...forked(migrations)];
}

function unmatched({ entries, files, folder, journalText }: DrizzleMigrations): Finding[] {
  const tags = entries.map((entry) => entry.tag);

  const missingFiles = entries
    .filter((entry) => !files.includes(entry.tag))
    .map((entry) => ({
      line: lineOf(journalText, `"${entry.tag}"`),
      message: `The journal lists the migration "${entry.tag}" but ${folder}/${entry.tag}.sql does not exist.`,
      fix: `Restore ${folder}/${entry.tag}.sql, or remove its entry from the journal if the migration was never applied anywhere.`,
    }));

  const missingEntries = files
    .filter((file) => !tags.includes(file))
    .map((file) => ({
      line: 1,
      message: `${folder}/${file}.sql is not in the journal: drizzle-kit migrate never applies it.`,
      fix: `Generate a migration with \`npm run db:generate <name>\`, never by hand. After a merge: ${REGENERATE}`,
    }));

  return [...missingFiles, ...missingEntries];
}

function outOfOrder({ entries, journalText }: DrizzleMigrations): Finding[] {
  return entries.flatMap((entry, index) => {
    const previous = entries[index - 1];

    if (entry.idx === index && (previous === undefined || previous.when < entry.when)) {
      return [];
    }

    return [
      {
        line: lineOf(journalText, `"${entry.tag}"`),
        message: `The journal entry "${entry.tag}" is out of order (${disorder(entry, index, previous)}): a database that applied a later migration skips it without a word.`,
        fix: `Two branches each added a migration. ${REGENERATE}`,
      },
    ];
  });
}

function disorder(entry: JournalEntry, index: number, previous: JournalEntry | undefined): string {
  return entry.idx !== index || previous === undefined
    ? `idx ${entry.idx} at position ${index}`
    : `generated before "${previous.tag}", which it follows`;
}

function forked({ entries, snapshots, journalText }: DrizzleMigrations): Finding[] {
  return entries.flatMap((entry, index) => {
    const previous = entries[index - 1];
    const link = snapshots.get(prefixOf(entry));
    const parent = previous === undefined ? undefined : snapshots.get(prefixOf(previous));

    if (previous === undefined || link === undefined || parent === undefined || link.prevId === parent.id) {
      return [];
    }

    return [
      {
        line: lineOf(journalText, `"${entry.tag}"`),
        message: `The snapshot of "${entry.tag}" was not generated from the one of "${previous.tag}": two branches generated a migration from the same schema, and the next \`db:generate\` would miss one of them.`,
        fix: REGENERATE,
      },
    ];
  });
}

function prefixOf(entry: JournalEntry): string {
  const at = entry.tag.indexOf('_');

  return at === -1 ? entry.tag : entry.tag.slice(0, at);
}
