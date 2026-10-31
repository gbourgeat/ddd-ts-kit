import { CliError } from '../cli-error';
import { readConfig } from '../config';
import { DEPCRUISE_FILE } from '../depcruise/depcruise-file';
import { renderCruiseFile } from '../depcruise/render-cruise-file';
import { exitCodeOf, tellUnwritable, Workspace } from '../workspace';
import { Arguments } from './arguments';
import { type Command } from './command';
import type { Io } from './io';
import { stdoutJson } from '../json/stdout-json';

/** Prints the dependency-cruiser configuration of the project, writes it, or checks that the file on disk is current. */
export const depcruiseConfigCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    check: { type: 'boolean', default: false },
    write: { type: 'boolean', default: false },
  });

  if (args.flag('check') && args.flag('write')) {
    throw new CliError(
      '--check and --write cannot be combined.',
      'Use `depcruise-config --check` to verify the file, or `depcruise-config --write` to write it.',
    );
  }

  const ws = new Workspace(args.projectRoot, false);
  const expected = renderCruiseFile(readConfig(args.projectRoot).config);

  if (args.flag('write')) {
    return writeCruiseFile(ws, expected, { io, json: args.json });
  }

  if (!args.flag('check')) {
    io.out(printed(expected, args.json));

    return 0;
  }

  const current = ws.read(DEPCRUISE_FILE) === expected;

  if (args.json) {
    io.out(stdoutJson({ ok: current, file: DEPCRUISE_FILE }));
  } else {
    io.out(
      current
        ? `${DEPCRUISE_FILE} is up to date.`
        : `stale  ${DEPCRUISE_FILE}\n\nRun \`ddd-ts-kit depcruise-config --write\` and commit the result.`,
    );
  }

  return current ? 0 : 1;
};

/** The configuration as the file would hold it, or, under --json, with the name of the file. */
function printed(expected: string, json: boolean): string {
  return json ? stdoutJson({ file: DEPCRUISE_FILE, config: expected }) : expected.trimEnd();
}

function writeCruiseFile(ws: Workspace, expected: string, { io, json }: { io: Io; json: boolean }): number {
  // A derived file, written again whatever it holds: not a replacement --force decides on.
  ws.update(DEPCRUISE_FILE, expected);

  const report = ws.commit(false);

  if (report.unwritable.length > 0) {
    tellUnwritable(io, report);
  } else {
    io.out(json ? stdoutJson({ file: DEPCRUISE_FILE, written: true }) : `written  ${DEPCRUISE_FILE}`);
  }

  return exitCodeOf(report);
}
