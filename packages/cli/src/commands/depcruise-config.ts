import { readConfig } from '../config/index.js';
import { DEPCRUISE_FILE } from '../depcruise/depcruise-file.js';
import { renderCruiseFile } from '../depcruise/render-cruise-file.js';
import { Workspace } from '../workspace/index.js';
import { Arguments } from './arguments.js';
import { type Command } from './command.js';

/** Prints the dependency-cruiser configuration of the project, writes it, or checks that the file on disk is current. */
export const depcruiseConfigCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    check: { type: 'boolean', default: false },
    write: { type: 'boolean', default: false },
  });

  const root = args.projectRoot;
  const expected = renderCruiseFile(readConfig(root).config);
  const ws = new Workspace(root, true);

  if (args.flag('write')) {
    ws.create(DEPCRUISE_FILE, expected);
    ws.commit(false);
    io.out(`written  ${DEPCRUISE_FILE}`);

    return 0;
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
