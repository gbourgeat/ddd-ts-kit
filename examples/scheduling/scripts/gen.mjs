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
    const result = JSON.parse(text);

    if (result.created === undefined) return undefined;

    const lines = [
      `ok: ${process.argv.slice(2).join(' ')}`,
      `created (${result.created.length}): ${result.created.join(' ')}`,
      `updated (${result.updated.length}): ${result.updated.join(' ')}`,
      ...result.todos.map((todo) => `next ${todo.file}:${todo.line} ${todo.text}`),
      ...result.notes.map((note) => `note: ${note}`),
    ];

    return lines.join('\n') + '\n';
  } catch {
    return undefined;
  }
}
