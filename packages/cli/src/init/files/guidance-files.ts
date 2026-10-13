import type { InitFile } from './init-file.js';
import { LAYER_RULES } from './layer-rules.js';

/** The guide every agent reads, AGENTS.md, which CLAUDE.md imports, and the rules by layer of Claude Code. */
export function guidanceFiles(): InitFile[] {
  return [
    ['AGENTS.md', 'init/AGENTS.md.tpl'],
    ['CLAUDE.md', 'init/CLAUDE.md.tpl'],
    ...LAYER_RULES.map((rule): InitFile => [`.claude/rules/${rule}.md`, `init/rules/${rule}.md.tpl`]),
  ];
}
