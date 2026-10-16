import fs from 'node:fs';
import path from 'node:path';
import type { Config } from '../../config/index.js';
import { strayEntry } from '../canonical/stray-entry.js';
import type { Flaw } from '../model/flaw.js';
import type { Rule } from '../model/rule.js';
import type { Violation } from '../model/violation.js';
import { reporter } from '../support/reporter.js';

/** Where the plan, the design notes and the reviews of a project live. */
const ARCHITECTURE_DOCS = 'docs/architecture';
/** A path written as code in Markdown, a `:line` after it left out. */
const CITED = /`([^`\s]+?)(?::\d+)?`/g;

export const treeDocumentedPaths: Rule = {
  id: 'tree/documented-paths',
  description:
    'A path of a bounded context cited as code in docs/architecture (a plan, a design note, a review) is a place the canonical tree allows: a document that names a directory the tree refuses describes a design the code no longer has.',
  scope: 'project',
  run(project) {
    const report = reporter(project, this.id);

    return markdownUnder(project.root, ARCHITECTURE_DOCS).flatMap((document) =>
      citedFlaws(fs.readFileSync(path.join(project.root, document), 'utf8'), project.config).map(
        ({ line, cited, flaw }): Violation =>
          report(
            { file: document, line },
            `"${cited}" names a place the canonical tree refuses: ${flaw.message}`,
            `Write the place the code has now (\`npx ddd-ts-kit describe <context>\` lists it), or remove the path; ${flaw.fix}`,
          ),
      ),
    );
  },
};

interface CitedFlaw {
  readonly line: number;
  readonly cited: string;
  readonly flaw: Flaw;
}

/** Each path of a context cited in a document, with the first flaw of its directories or of itself. */
function citedFlaws(text: string, config: Config): CitedFlaw[] {
  return text.split('\n').flatMap((content, index) =>
    [...content.matchAll(CITED)].flatMap(([, cited = '']) => {
      const flaw = cited.startsWith(`${config.contextsDir}/`) ? firstFlaw(cited, config) : undefined;

      return flaw === undefined ? [] : [{ line: index + 1, cited, flaw }];
    }),
  );
}

/** The directories of a path from the outermost, then the path itself: the first one the tree refuses. */
function firstFlaw(cited: string, config: Config): Flaw | undefined {
  const segments = cited.replace(/\/$/, '').split('/');
  const directories = segments.slice(0, -1).map((_, index) => `${segments.slice(0, index + 1).join('/')}/`);
  const entries = [...directories, cited];

  for (const entry of entries) {
    const flaw = strayEntry(entry, config);

    if (flaw !== undefined) {
      return flaw;
    }
  }

  return undefined;
}

function markdownUnder(root: string, directory: string): string[] {
  const absolute = path.join(root, directory);

  if (!fs.existsSync(absolute)) {
    return [];
  }

  return fs
    .readdirSync(absolute, { withFileTypes: true })
    .flatMap((entry) => {
      const relative = `${directory}/${entry.name}`;

      if (entry.isDirectory()) {
        return markdownUnder(root, relative);
      }

      return entry.isFile() && entry.name.endsWith('.md') ? [relative] : [];
    })
    .sort();
}
