import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_FILE, type ModuleConfig } from '../../config/index.js';
import { moduleNameFlaw } from '../../model-modules/index.js';
import { Glossaries } from '../language/glossaries.js';
import { unknownWords } from '../language/unknown-words.js';
import type { Report } from '../model/report.js';
import type { Rule } from '../model/rule.js';
import type { Violation } from '../model/violation.js';
import { MODULES_HEADING, modulesSection } from '../modules/modules-section.js';
import { lineOf } from '../support/line-of.js';
import { reporter } from '../support/reporter.js';

export const moduleDeclared: Rule = {
  id: 'module/declared',
  description:
    'Every module of the model a context declares in contexts.<name>.modules is named with terms of the ubiquitous language of the context, never with a technical word (shared, common, core, utils...), and has its row, with its purpose, in the "## Modules" table of the CONTEXT.md of the context.',
  scope: 'project',
  run(project) {
    const report = reporter(project, this.id);
    const glossaries = new Glossaries(project.root, project.config.contextsDir);

    return Object.entries(project.config.contexts).flatMap(([context, { modules }]) => {
      if (modules.length === 0) {
        return [];
      }

      const doc = glossaries.docOf(context);
      const section = modulesSection(readIfPresent(path.join(project.root, doc)));

      return modules.flatMap((module): Violation[] => {
        const where = { file: CONFIG_FILE, line: lineOf(project.configText, `"${module.name}"`) };
        const named = namingFlaw(module, unknownWords(module.name, glossaries.of(context)));
        const row = section.rows.some((candidate) => candidate.name === module.name);

        return [
          ...(named === undefined ? [] : [report(where, named.message(context), named.fix(context))]),
          ...(row ? [] : [missingRow(report, { doc, context, module, line: section.line ?? 1 })]),
        ];
      });
    });
  },
};

interface NamingFlaw {
  message(context: string): string;
  fix(context: string): string;
}

function namingFlaw(module: ModuleConfig, unknown: readonly string[]): NamingFlaw | undefined {
  const flaw = moduleNameFlaw(module.name);
  const technical = flaw?.reason === 'technical' ? flaw.word : undefined;

  if (technical !== undefined) {
    return {
      message: (context) =>
        `The module "${module.name}" of "${context}" is named "${technical}", a word that says how code is grouped, not what part of the model it holds.`,
      fix: () =>
        'Name the module after the cluster of concepts it holds, with terms of the glossary (the waitlist, the calendars); what several modules share belongs to one of them, or to a module named after that shared concept (Evans, Abstract Core).',
    };
  }

  if (unknown.length === 0) {
    return undefined;
  }

  return {
    message: (context) =>
      `The module "${module.name}" of "${context}" is named with ${unknown.map((word) => `"${word}"`).join(', ')}, which the glossary of "${context}" does not define.`,
    fix: (context) =>
      `A module is part of the model and its name part of the ubiquitous language (Evans, Modules): define the term with \`ddd-ts-kit generate module ${context} ${module.name} --term "<Term>=<meaning>"\`, or rename the module after a term the glossary has.`,
  };
}

interface Missing {
  readonly doc: string;
  readonly context: string;
  readonly module: ModuleConfig;
  readonly line: number;
}

function missingRow(report: Report, { doc, context, module, line }: Missing): Violation {
  return report(
    { file: doc, line },
    `The module "${module.name}" of "${context}" has no row in the "${MODULES_HEADING}" table of its CONTEXT.md.`,
    `Say what it holds, one sentence in the words of the domain: \`ddd-ts-kit generate module ${context} ${module.name} --purpose "<what it holds>"\` writes the row.`,
  );
}

function readIfPresent(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    // A missing CONTEXT.md is reported by tree/context-doc.
    return '';
  }
}
