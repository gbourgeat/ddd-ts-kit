import type { StoryGate } from './story-gate';
import type { StoryPhase } from './story-phase';

/** The phases of a story as text: one line each, then the next step and, when asked, the gate. */
export function formatStoryPhases(story: string, phases: readonly StoryPhase[], gate: StoryGate | undefined): string {
  const next = phases.find((phase) => !phase.met);
  const asked = gate === undefined ? [] : phases.filter((phase) => gate === 'close' || phase.gate === 'build');
  const width = Math.max(...phases.map((phase) => phase.title.length));

  return [
    story,
    ...phases.map((phase) => `  [${phase.met ? 'x' : ' '}] ${phase.title.padEnd(width)}  ${phase.detail}`),
    '',
    next === undefined ? 'Next: nothing, the story is ready for its pull request.' : `Next: ${next.next}`,
    ...(gate === undefined ? [] : [`gate ${gate}: ${asked.every((phase) => phase.met) ? 'met' : 'not met'}`]),
  ].join('\n');
}
