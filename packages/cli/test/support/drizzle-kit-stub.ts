/**
 * A stand-in for `drizzle-kit generate` with `prefix: 'timestamp'`, for the specs that need what it
 * writes: it diffs the tables of `schema/` (one `<table>.json` each, its SQL in `<table>.sql` when
 * it is more than a `CREATE TABLE`) against the last snapshot of the journal, then writes the SQL
 * file, a snapshot naming its parent and the journal entry, or nothing when no table changed. A
 * custom migration copies the last snapshot. Its numbers go to the millisecond, so that the specs
 * do not wait between two generations.
 */
export const DRIZZLE_KIT_STUB = String.raw`
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const args = process.argv.slice(2);
const name = args[args.indexOf('--name') + 1];
const custom = args.includes('--custom');
const out = 'migrations';
const journalFile = path.join(out, 'meta', '_journal.json');
const journal = fs.existsSync(journalFile)
  ? JSON.parse(fs.readFileSync(journalFile, 'utf8'))
  : { version: '7', dialect: 'postgresql', entries: [] };
const lastEntry = journal.entries[journal.entries.length - 1];
const last = lastEntry
  ? JSON.parse(fs.readFileSync(path.join(out, 'meta', lastEntry.tag.split('_')[0] + '_snapshot.json'), 'utf8'))
  : { id: '00000000-0000-0000-0000-000000000000', prevId: '', version: '7', dialect: 'postgresql', tables: {} };

const tables = {};
for (const file of fs.existsSync('schema') ? fs.readdirSync('schema').sort() : []) {
  if (file.endsWith('.json')) tables[file.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join('schema', file), 'utf8'));
}

const changed = [...new Set([...Object.keys(tables), ...Object.keys(last.tables)])]
  .sort()
  .filter((table) => JSON.stringify(tables[table]) !== JSON.stringify(last.tables[table]));

if (!custom && changed.length === 0) {
  console.log('No schema changes, nothing to migrate');
  process.exit(0);
}

const sql = custom
  ? '-- Custom SQL migration file, put your code below! --'
  : changed
      .map((table) => {
        const written = path.join('schema', table + '.sql');
        if (fs.existsSync(written)) return fs.readFileSync(written, 'utf8');
        return table in tables ? 'CREATE TABLE "' + table + '" ();' : 'DROP TABLE "' + table + '";';
      })
      .join('\n--> statement-breakpoint\n');

const prefix = new Date().toISOString().replace(/\D/g, '').slice(0, 17);
const tag = prefix + '_' + name;
const snapshot = { ...last, id: crypto.randomUUID(), prevId: last.id, tables: custom ? last.tables : tables };

fs.mkdirSync(path.join(out, 'meta'), { recursive: true });
fs.writeFileSync(path.join(out, tag + '.sql'), sql);
fs.writeFileSync(path.join(out, 'meta', prefix + '_snapshot.json'), JSON.stringify(snapshot, null, 2));
journal.entries.push({ idx: journal.entries.length, version: '7', when: Date.now(), tag, breakpoints: true });
fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2));
console.log('Your SQL migration file is ' + out + '/' + tag + '.sql');
`;
