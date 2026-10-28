import { readConfig } from '../config';
import { readRemaining } from '../progress/read-remaining';
import type { Remaining } from '../progress/remaining';
import { Workspace } from '../workspace';
import { Arguments } from './arguments';
import type { Command } from './command';
import { knownContext } from './known-context';
import { stdoutJson } from '../json/stdout-json';

const MARKS: Readonly<Record<Remaining['kind'], string>> = {
  domain: 'TODO(domain)',
  platform: 'TODO(platform)',
  test: 'it.todo',
  review: 'TODO(review)',
};

/** Lists what the generators left to fill and the remarks of a review left to settle, as `file:line`, in the whole project or in one context. */
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
    io.out(stdoutJson({ count: remaining.length, remaining }));
  } else {
    io.out(
      remaining.length === 0
        ? 'Nothing is left to fill.'
        : remaining.map((left) => `${left.file}:${left.line}  ${MARKS[left.kind]}  ${left.text}`).join('\n'),
    );
  }

  return 0;
};
