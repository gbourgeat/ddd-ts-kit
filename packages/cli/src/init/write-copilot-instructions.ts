import type { Workspace } from '../workspace/index.js';
import { copilotInstruction } from './copilot-instruction.js';
import { LAYER_RULES } from './files/layer-rules.js';

/**
 * The rules by layer for GitHub Copilot, from those of Claude Code as this run left them: its
 * cloud agent, its code review and VS Code read `.github/instructions/`, never `.claude/rules/`.
 */
export function writeCopilotInstructions(ws: Workspace): void {
  for (const layer of LAYER_RULES) {
    const rule = ws.read(`.claude/rules/${layer}.md`);
    const instruction = rule === undefined ? undefined : copilotInstruction(rule);

    if (instruction !== undefined) {
      ws.create(`.github/instructions/${layer}.instructions.md`, instruction);
    }
  }
}
