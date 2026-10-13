import { CliError } from '../../../cli-error.js';
import { toName } from '../../../naming/index.js';
import type { RequestedTransition } from './requested-transition.js';

const WRITTEN = /^\s*([A-Za-z][\w-]*)\s*:\s*([^>]+?)\s*(?:>\s*(\S+)\s*)?$/;

/** The transitions of `--transition`, each leaving and reaching states the machine lists. */
export function parseTransitions(written: readonly string[], states: readonly string[]): RequestedTransition[] {
  const transitions = written.map((text) => parsed(text, states));
  const twice = transitions.find(({ name }, index) => transitions.findIndex((other) => other.name === name) !== index);

  if (twice !== undefined) {
    throw new CliError(
      `The transition ${twice.name} is given twice.`,
      'Name each transition once and list every state it leaves: --transition "cancel:draft,issued>cancelled".',
    );
  }

  return transitions;
}

function parsed(text: string, states: readonly string[]): RequestedTransition {
  const [, name = '', from = '', to] = WRITTEN.exec(text) ?? [];
  const left = from.split(',').map((state) => state.trim());
  const unknown = [...left, ...(to === undefined ? [] : [to])].filter((state) => !states.includes(state));

  if (name === '' || unknown.length > 0) {
    throw new CliError(
      name === ''
        ? `"${text}" is not a transition.`
        : `The transition ${name} names ${unknown.map((state) => `"${state}"`).join(', ')}, which the status does not list.`,
      `Write each transition as "<intention>:<from>[,<from>]...[><to>]", its states among ${states.join(', ')}: --transition "issue:draft>issued". Add a state with --value.`,
    );
  }

  return { name: toName(name).camel, from: left, ...(to === undefined ? {} : { to }) };
}
