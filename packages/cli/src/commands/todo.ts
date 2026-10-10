import { readConfig } from '../config/index.js';
import { readRemaining } from '../progress/read-remaining.js';
import type { Remaining } from '../progress/remaining.js';
import { Workspace } from '../workspace/index.js';
import { Arguments } from './arguments.js';
import type { Command } from './command.js';
import { knownContext } from './known-context.js';

const MARKS: Readonly<Record<Remaining['kind'], string>> = {
  domain: 'TODO(domain)',
  platform: 'TODO(platform)',
  test: 'it.todo',
};

/** Lists what the generators left to fill, as `file:line`, in the whole project or in one context. */
export const todoCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {});
  const root = args.projectRoot;
  const { config } = readConfig(root);
  const [asked] = args.positionals;

  const remaining = readRemaining(
    new Workspace(root, false),
    config,
    asked === undefined ? undefined : knownContext(config, asked),
  );

  if (args.json) {
    io.out(JSON.stringify({ count: remaining.length, remaining }, null, 2));
  } else {
    io.out(
      remaining.length === 0
        ? 'Nothing is left to fill.'
        : remaining.map((left) => `${left.file}:${left.line}  ${MARKS[left.kind]}  ${left.text}`).join('\n'),
    );
  }

  return 0;
};
