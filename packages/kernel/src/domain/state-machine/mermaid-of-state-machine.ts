import type { StateMachineDescription } from './state-machine-description';

/** The diagram of a state machine, as Mermaid `stateDiagram-v2`: what `CONTEXT.md` shows. */
export function mermaidOfStateMachine(machine: StateMachineDescription): string {
  const lines = [
    'stateDiagram-v2',
    ...machine.states.filter((state) => idOf(state) !== state).map((state) => `  state "${state}" as ${idOf(state)}`),
    ...machine.initial.map((state) => `  [*] --> ${idOf(state)}`),
    ...machine.arrows.map(
      ({ transition, from, to, guarded }) =>
        `  ${idOf(from)} --> ${idOf(to)}: ${transition}${guarded ? ' [guarded]' : ''}`,
    ),
    ...machine.final.map((state) => `  ${idOf(state)} --> [*]`),
  ];

  return lines.join('\n');
}

/** Mermaid takes letters, digits and underscores in an identifier. */
function idOf(state: string): string {
  return state.replace(/[^A-Za-z0-9_]/g, '_');
}
