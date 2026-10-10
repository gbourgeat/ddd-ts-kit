import fs from 'node:fs';
import path from 'node:path';
import { CLASSIFICATIONS } from '../../config/index.js';
import { CONTEXT_DOC_HEADINGS } from '../canonical/context-doc-headings.js';
import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import { reporter } from '../support/reporter.js';
import { toViolations } from '../support/to-violations.js';

export const treeContextDoc: Rule = {
  id: 'tree/context-doc',
  description: 'Every context has a CONTEXT.md with the required sections and the classification declared in the config.',
  scope: 'project',
  run(project) {
    const report = reporter(project, this.id);

    return project.contextsOnDisk.flatMap((context) => {
      const file = `${project.config.contextsDir}/${context}/CONTEXT.md`;
      const text = readIfPresent(path.join(project.root, file));

      if (text === undefined) {
        return [report({ file, line: 1 }, `The context "${context}" has no CONTEXT.md.`, `Create ${file} with the sections ${CONTEXT_DOC_HEADINGS.join(', ')}.`)];
      }

      const lines = text.split('\n').map((line) => line.trim());
      const expected = project.config.contexts[context]?.classification;

      return toViolations(report, file, [...missingSections(lines), ...(expected === undefined ? [] : otherClassification(lines, context, expected))]);
    });
  },
};

function readIfPresent(file: string): string | undefined {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
}

function missingSections(lines: readonly string[]): Finding[] {
  return CONTEXT_DOC_HEADINGS.filter((heading) => !lines.some((line) => line.toLowerCase() === heading.toLowerCase())).map((heading) => ({
    line: 1,
    message: `CONTEXT.md lacks the section "${heading}".`,
    fix: `Add a "${heading}" section and fill it in with the domain expert's words.`,
  }));
}

function otherClassification(lines: readonly string[], context: string, expected: string): Finding[] {
  const at = lines.findIndex((line) => line.toLowerCase() === '## classification');

  if (at === -1) return [];

  const end = lines.findIndex((line, index) => index > at && line.startsWith('## '));

  const section = lines
    .slice(at + 1, end === -1 ? undefined : end)
    .join(' ')
    .toLowerCase();

  const stated = CLASSIFICATIONS.filter((candidate) => new RegExp(`\\b${candidate}\\b`).test(section));

  if (stated.length === 1 && stated[0] === expected) return [];

  return [
    {
      line: at + 1,
      message: `CONTEXT.md states the classification "${stated.join(', ') || 'none'}" but the config says "${expected}".`,
      fix: `Write "${expected}" under "## Classification", or change contexts.${context}.classification in ddd-ts-kit.config.json if the strategic decision changed.`,
    },
  ];
}
