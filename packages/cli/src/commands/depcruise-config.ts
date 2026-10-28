import { readConfig } from '../config';
import { DEPCRUISE_FILE } from '../depcruise/depcruise-file';
import { renderCruiseFile } from '../depcruise/render-cruise-file';
import { exitCodeOf, tellUnwritable, Workspace } from '../workspace';
import { Arguments } from './arguments';
import { type Command } from './command';
import type { Io } from './io';

/** Prints the dependency-cruiser configuration of the project, writes it, or checks that the file on disk is current. */
export const depcruiseConfigCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    check: { type: 'boolean', default: false },
    write: { type: 'boolean', default: false },
  });

  const root = args.projectRoot;
  const expected = renderCruiseFile(readConfig(root).config);
  const ws = new Workspace(root, false);

  if (args.flag('write')) {
    return writeCruiseFile(ws, expected, io);
  }

  if (!args.flag('check')) {
    io.out(expected.trimEnd());

    return 0;
  }

  const current = ws.read(DEPCRUISE_FILE) === expected;

  if (args.json) {
    io.out(JSON.stringify({ ok: current, file: DEPCRUISE_FILE }, null, 2));
  } else {
    io.out(
      current
        ? `${DEPCRUISE_FILE} is up to date.`
        : `stale  ${DEPCRUISE_FILE}\n\nRun \`ddd-ts-kit depcruise-config --write\` and commit the result.`,
    );
  }

  return current ? 0 : 1;
};

function writeCruiseFile(ws: Workspace, expected: string, io: Io): number {
  // A derived file, written again whatever it holds: not a replacement --force decides on.
  ws.update(DEPCRUISE_FILE, expected);

  const report = ws.commit(false);

  if (report.unwritable.length > 0) {
    tellUnwritable(io, report);
  } else {
    io.out(`written  ${DEPCRUISE_FILE}`);
  }

  return exitCodeOf(report);
}
