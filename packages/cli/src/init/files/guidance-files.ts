import type { InitFile } from './init-file';
import { LAYER_RULES } from './layer-rules';

/**
 * The review policy of the project, at its root: the passes every review applies, what Important
 * means, the cap on nits, what is not reported. Written once: the team edits it, and `--force`
 * leaves it alone, as it leaves `.claude/settings.json`.
 */
export const REVIEW_POLICY: InitFile = ['REVIEW.md', 'init/REVIEW.md.tpl'];

/** The guide every agent reads, AGENTS.md, which CLAUDE.md imports, and the rules by layer of Claude Code. */
export function guidanceFiles(): InitFile[] {
  return [
    ['AGENTS.md', 'init/AGENTS.md.tpl'],
    ['CLAUDE.md', 'init/CLAUDE.md.tpl'],
    ...LAYER_RULES.map((rule): InitFile => [`.claude/rules/${rule}.md`, `init/rules/${rule}.md.tpl`]),
  ];
}
