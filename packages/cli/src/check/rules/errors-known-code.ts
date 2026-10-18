import { buildsThroughFactories } from '../errors/builds-through-factories.js';
import { codesSetIn } from '../errors/codes-set-in.js';
import { KIT_ERROR_CODES } from '../errors/kit-error-codes.js';
import { namesRefusals } from '../errors/names-refusals.js';
import type { Finding } from '../model/finding.js';
import type { Project } from '../model/project.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import { perFile } from '../support/per-file.js';
import { matchingBracket } from '../text/matching-bracket.js';

const ERRORS_LIST = /(?<![\w$.])errors\s*:\s*\[/g;
const UNKEPT = 'A code declared and never raised is a promise the contract makes for nothing.';

export const errorsKnownCode: Rule = {
  id: 'errors/known-code',
  description:
    'Under "stack.refusals": "factories" or "named", every code a route or a controller declares in `errors` exists: a factory or an error class of its context sets it, or the domain/errors/codes.ts of its context lists it, a class outside the contexts does, or it is a code of the kit.',
  scope: 'project',
  run(project) {
    if (!buildsThroughFactories(project)) {
      return [];
    }

    const known = knownCodes(project);
    const named = namesRefusals(project);

    return perFile(project, this.id, (file) => (isRouteFile(file) ? unknownCodes(file, known, named) : []));
  },
};

/** The codes set outside the contexts (platform, shared kernel) under the key `*`, and those of each context, its code list included, under its name. */
function knownCodes(project: Project): Map<string, Set<string>> {
  const known = new Map<string, Set<string>>([['*', new Set(KIT_ERROR_CODES)]]);

  for (const file of project.files.filter((candidate) => !candidate.isTest)) {
    const owner = file.location.area === 'context' ? file.location.context : '*';
    const codes = known.get(owner) ?? new Set<string>();

    for (const { code } of codesSetIn(file)) {
      codes.add(code);
    }

    known.set(owner, codes);
  }

  return known;
}

function isRouteFile(file: SourceFile): boolean {
  return !file.isTest && /\.(?:route|controller)\.ts$/.test(file.path);
}

function unknownCodes(file: SourceFile, known: Map<string, Set<string>>, named: boolean): Finding[] {
  const { scan, location } = file;
  const context = location.area === 'context' ? location.context : '*';

  const exists = (code: string): boolean =>
    known.get('*')?.has(code) === true || known.get(context)?.has(code) === true;

  return [...scan.code.matchAll(ERRORS_LIST)].flatMap((match) => {
    const open = match.index + match[0].length - 1;
    const close = matchingBracket(scan.code, open);

    return scan.strings
      .filter((literal) => literal.start > open && literal.end <= close && !exists(literal.value))
      .map((literal) => ({
        line: scan.lineAt(literal.start),
        message: `The route declares the error code "${literal.value}", which no refusal ${context === '*' ? 'of the project' : `of the context "${context}"`} sets.`,
        fix: named ? namedFix(context) : factoriesFix(context),
      }));
  });
}

function factoriesFix(context: string): string {
  return `Write the code as its factory sets it, or add the refusal: \`ddd-ts-kit generate error ${context === '*' ? '<context>' : context} <Concept> <refusal>\`. ${UNKEPT}`;
}

function namedFix(context: string): string {
  const owner = context === '*' ? 'its context' : `"${context}"`;

  return `Write the code as the domain/errors/codes.ts of ${owner} lists it, or add the refusal: \`ddd-ts-kit generate error ${context === '*' ? '<context>' : context} <Refusal> <factory>\`, for example \`generate error banking InsufficientFunds forAccountId\`. ${UNKEPT}`;
}
