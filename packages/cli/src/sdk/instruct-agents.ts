import type { Workspace } from '../workspace';
import { AGENT_INSTRUCTION } from './agent-instruction';

/** The guide of every agent; a project written before it kept its instructions in CLAUDE.md. */
const GUIDES = ['AGENTS.md', 'CLAUDE.md'];
const PRESENTATION_RULES = ['.claude/rules/presentation.md', '.github/instructions/presentation.instructions.md'];

/**
 * What `init --sdk` writes for the agents of a project, in one that asks for clients later: the
 * instruction of its guide, appended once, and a note for the paths of the presentation rules,
 * which the team may have rewritten.
 */
export function instructAgents(ws: Workspace): void {
  const guide = GUIDES.find((file) => ws.exists(file));
  const instructions = guide === undefined ? undefined : ws.read(guide);
  const instruction = ws.spoken(AGENT_INSTRUCTION);

  if (guide !== undefined && instructions !== undefined && !instructions.includes(instruction)) {
    ws.update(guide, `${instructions}${instructions.endsWith('\n') ? '' : '\n'}\n${instruction}\n`);
  }

  for (const rule of PRESENTATION_RULES) {
    if (!(ws.read(rule) ?? 'clients/**').includes('clients/**')) {
      ws.note(`${rule}: add "clients/**" to its paths, so that an agent editing a client reads it.`);
    }
  }
}
