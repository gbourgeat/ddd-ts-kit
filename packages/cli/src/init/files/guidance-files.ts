import type { InitFile } from './init-file.js';

/** One rule file per layer, loaded with the files of that layer. */
const RULES = ['domain', 'application', 'published-language', 'infrastructure', 'presentation', 'platform', 'tests'];

export function guidanceFiles(): InitFile[] {
  return [
    ['CLAUDE.md', 'init/CLAUDE.md.tpl'],
    ...RULES.map((rule): InitFile => [`.claude/rules/${rule}.md`, `init/rules/${rule}.md.tpl`]),
  ];
}
