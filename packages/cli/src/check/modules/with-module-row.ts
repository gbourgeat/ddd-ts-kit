import { MODULES_HEADING, modulesSection } from './modules-section.js';

const TABLE = ['| Module | Purpose |', '|---|---|'];

/**
 * The CONTEXT.md with the row of a module in its `## Modules` table, written after the glossary
 * when the section is missing. A row already there keeps its purpose unless one is given.
 */
export function withModuleRow(contextDoc: string, module: string, purpose: string | undefined): string {
  const lines = contextDoc.split('\n');
  const section = modulesSection(contextDoc);
  const row = `| \`${module}\` | ${purpose ?? 'TODO(domain): say in one sentence which concepts this module holds.'} |`;
  const known = section.rows.find((candidate) => candidate.name === module);

  if (known !== undefined) {
    if (purpose !== undefined) {
      lines[known.line - 1] = row;
    }

    return lines.join('\n');
  }

  if (section.lastRowLine !== undefined) {
    lines.splice(section.lastRowLine, 0, row);

    return lines.join('\n');
  }

  if (section.line !== undefined) {
    lines.splice(section.line, 0, '', ...TABLE, row);

    return lines.join('\n');
  }

  lines.splice(sectionPlace(lines), 0, MODULES_HEADING, '', ...TABLE, row, '');

  return lines.join('\n');
}

/** Right after the glossary, which names the modules; at the end of a document without one. */
function sectionPlace(lines: readonly string[]): number {
  const glossary = lines.findIndex((line) => line.trim().toLowerCase() === '## ubiquitous language');
  const next = lines.findIndex((line, index) => index > glossary && line.startsWith('## '));

  return glossary === -1 || next === -1 ? lines.length : next;
}
