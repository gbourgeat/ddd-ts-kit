import type { Name } from '../../../naming';
import type { RenderContext } from '../../../templating';
import type { VocabularyEntry } from '../../vocabulary/vocabulary-entry';
import type { RequestedTransition } from './requested-transition';

export interface MachineParts {
  readonly aggregate: Name;
  readonly states: readonly VocabularyEntry[];
  readonly transitions: readonly RequestedTransition[];
}

/** The declaration of a lifecycle and the cases of its spec, written from the states and the transitions asked. */
export function stateMachineVars({ aggregate, states, transitions }: MachineParts): RenderContext {
  const status = `${aggregate.pascal}Status`;
  const machine = `${aggregate.camel}Lifecycle`;
  const member = (value: string): string => `${status}.${states.find((entry) => entry.value === value)?.key ?? value}`;
  const [initial] = states;

  return {
    status,
    statusKebab: `${aggregate.kebab}-status`,
    constant: machine,
    initial: member(initial?.value ?? ''),
    initialValue: initial?.value ?? '',
    hasTransitions: transitions.length > 0,
    transitions: transitions.map((transition) => `    ${declared(transition, member)},`).join('\n'),
    cases: transitions.flatMap((transition) => cases({ machine, transition, states, member })).join('\n\n'),
  };
}

function declared({ name, from, to }: RequestedTransition, member: (value: string) => string): string {
  const leaves = `from: [${from.map(member).join(', ')}]`;

  return `${name}: { ${to === undefined ? leaves : `${leaves}, to: ${member(to)}`} }`;
}

interface Case {
  readonly machine: string;
  readonly transition: RequestedTransition;
  readonly states: readonly VocabularyEntry[];
  readonly member: (value: string) => string;
}

/** The transition leads where it says from the first state it leaves, and is refused from the first state it does not. */
function cases({ machine, transition, states, member }: Case): string[] {
  const { name, from, to } = transition;
  const [first = ''] = from;
  const outside = states.find(({ value }) => !from.includes(value))?.value;

  const allowed = [
    `  it('${name} leads from ${first} to ${to ?? first}', () => {`,
    `    expect(${machine}.next(${member(first)}, '${name}')).toBe(${member(to ?? first)});`,
    '  });',
  ].join('\n');

  if (outside === undefined) {
    return [allowed];
  }

  return [
    allowed,
    [
      `  it('refuses ${name} from ${outside}', () => {`,
      `    expect(() => ${machine}.next(${member(outside)}, '${name}')).toThrow('is not allowed from the state');`,
      '  });',
    ].join('\n'),
  ];
}
