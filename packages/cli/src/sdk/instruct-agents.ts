import type { Workspace } from '../workspace/index.js';
import { AGENT_INSTRUCTION } from './agent-instruction.js';

const INSTRUCTIONS = 'CLAUDE.md';
const PRESENTATION_RULE = '.claude/rules/presentation.md';

/**
 * What `init --sdk` writes for the agents of a project, in one that asks for clients later: the
 * instruction of CLAUDE.md, appended once, and a note for the paths of the presentation rule,
 * which the team may have rewritten.
 */
export function instructAgents(ws: Workspace): void {
  const instructions = ws.read(INSTRUCTIONS);
  const instruction = ws.spoken(AGENT_INSTRUCTION);

  if (instructions !== undefined && !instructions.includes(instruction)) {
    ws.update(INSTRUCTIONS, `${instructions}${instructions.endsWith('\n') ? '' : '\n'}\n${instruction}\n`);
  }

  if (!(ws.read(PRESENTATION_RULE) ?? '"clients/**"').includes('"clients/**"')) {
    ws.note(`${PRESENTATION_RULE}: add "clients/**" to its paths, so that an agent editing a client reads it.`);
  }
}
