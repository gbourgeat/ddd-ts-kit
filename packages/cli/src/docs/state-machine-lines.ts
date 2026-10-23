import type { StateMachineFacts } from './state-machine-facts';

/**
 * The diagram of each state machine of a context, as Mermaid `stateDiagram-v2`: the text
 * `mermaidOfStateMachine` of the kernel draws, read here from the source text, the CLI running no
 * project code.
 */
export function stateMachineLines(machines: readonly StateMachineFacts[], context: string): string[] {
  if (machines.length === 0) {
    return ['No state machine.'];
  }

  return machines.flatMap((machine, index) => [
    ...(index === 0 ? [] : ['']),
    `Lifecycle of \`${machine.aggregate}\` (\`${inContext(machine.file, context)}\`):`,
    '',
    '```mermaid',
    ...diagramOf(machine),
    '```',
  ]);
}

function diagramOf({ states, initial, transitions }: StateMachineFacts): string[] {
  const left = new Set(transitions.flatMap(({ from }) => from));

  return [
    'stateDiagram-v2',
    ...states.filter((state) => idOf(state) !== state).map((state) => `  state "${state}" as ${idOf(state)}`),
    ...initial.map((state) => `  [*] --> ${idOf(state)}`),
    ...transitions.flatMap(({ name, from, to, guarded }) =>
      from.map((state) => `  ${idOf(state)} --> ${idOf(to ?? state)}: ${name}${guarded ? ' [guarded]' : ''}`),
    ),
    ...states.filter((state) => !left.has(state)).map((state) => `  ${idOf(state)} --> [*]`),
  ];
}

function idOf(state: string): string {
  return state.replace(/[^A-Za-z0-9_]/g, '_');
}

/** The path of a file relative to its context, its module of the model kept: `calendars/domain/state-machines/...`. */
function inContext(file: string, context: string): string {
  return file.slice(file.indexOf(`/${context}/`) + context.length + 2);
}
