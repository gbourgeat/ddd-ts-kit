// Runs one generator through scripts/kit.mjs and prints what an agent needs: the exit code, the
// counts, the `next` places and the notes, never the whole JSON.
//
//   node scripts/gen.mjs command scheduling BookAppointment --aggregate Appointment --permission appointment.book
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const kit = path.join(path.dirname(fileURLToPath(import.meta.url)), 'kit.mjs');
const run = spawnSync(process.execPath, [kit, 'generate', ...process.argv.slice(2), '--json'], { encoding: 'utf8' });

process.stdout.write(summaryOf(run.stdout) ?? run.stdout + run.stderr);
process.exit(run.status ?? 1);

function summaryOf(text) {
  try {
    // A list that holds nothing is left out, and the paths are written from the directory they share, `root`.
    const { root = '', created = [], updated = [], todos = [], notes = [], error } = JSON.parse(text);

    if (error !== undefined) {
      return undefined;
    }

    const lines = [
      `ok: ${process.argv.slice(2).join(' ')}`,
      `created (${created.length}): ${created.map((file) => `${root}${file}`).join(' ')}`,
      `updated (${updated.length}): ${updated.map((file) => `${root}${file}`).join(' ')}`,
      ...todos.map((todo) => `next ${root}${todo.file}:${todo.line} ${todo.gist ?? todo.text}`),
      ...notes.map((note) => `note: ${note}`),
    ];

    return lines.join('\n') + '\n';
  } catch {
    return undefined;
  }
}
