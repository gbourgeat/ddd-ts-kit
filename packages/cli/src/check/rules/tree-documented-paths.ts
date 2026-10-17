import fs from 'node:fs';
import path from 'node:path';
import type { Config } from '../../config/index.js';
import { firstFlaw } from '../canonical/first-flaw.js';
import { flawInContexts } from '../canonical/flaw-in-contexts.js';
import { isContextRelative } from '../canonical/is-context-relative.js';
import type { Flaw } from '../model/flaw.js';
import type { Rule } from '../model/rule.js';
import type { Violation } from '../model/violation.js';
import { markdownUnder } from '../project/markdown-under.js';
import { reporter } from '../support/reporter.js';

/** Where the plan, the design notes and the reviews of a project live. */
const ARCHITECTURE_DOCS = 'docs/architecture';
/** A path written as code in Markdown, a `:line` after it left out. */
const CITED = /`([^`\s]+?)(?::\d+)?`/g;

export const treeDocumentedPaths: Rule = {
  id: 'tree/documented-paths',
  description:
    'A path of a bounded context cited as code in docs/architecture (a plan, a design note, a review), in full or relative to its context, is a place the canonical tree allows: a document that names a directory the tree refuses describes a design the code no longer has.',
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
      const flaw = flawOf(cited, config);

      return flaw === undefined ? [] : [{ line: index + 1, cited, flaw }];
    }),
  );
}

/**
 * A full path is judged in its context; a path relative to a context (`application/services/`)
 * names no context, so it is refused only when every declared context refuses it.
 */
function flawOf(cited: string, config: Config): Flaw | undefined {
  if (cited.startsWith(`${config.contextsDir}/`)) {
    return firstFlaw(cited, config);
  }

  return isContextRelative(cited) ? flawInContexts(cited, Object.keys(config.contexts), config) : undefined;
}
