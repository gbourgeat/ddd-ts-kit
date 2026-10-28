import { readConfig } from '../config';
import { readRemaining } from '../progress/read-remaining';
import type { Remaining } from '../progress/remaining';
import { Workspace } from '../workspace';
import { gistOf } from '../workspace/gist-of';
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

/**
 * Lists what the generators left to fill and the remarks of a review left to settle, as `file:line`,
 * in the whole project or in one context; `--brief` gives each its first words, the file holding the rest.
 */
export const todoCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { brief: { type: 'boolean', default: false } });
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
    const line = args.flag('brief')
      ? (left: Remaining): string => `${left.file}:${left.line}  ${gistOf(left.text)}`
      : (left: Remaining): string => `${left.file}:${left.line}  ${MARKS[left.kind]}  ${left.text}`;

    io.out(remaining.length === 0 ? 'Nothing is left to fill.' : remaining.map(line).join('\n'));
  }

  return 0;
};
