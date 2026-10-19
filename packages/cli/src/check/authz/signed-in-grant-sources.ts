import type { Project } from '../model/project.js';
import type { SourceFile } from '../model/source-file.js';
import { type Scan, scan } from '../scan/scan.js';
import { escapeRegExp } from '../text/escape-reg-exp.js';
import { callArguments } from '../text/call-arguments.js';
import type { ListPart } from '../text/list-part.js';
import { matchingBracket } from '../text/matching-bracket.js';
import { signedInGrants } from './signed-in-grants.js';

const CONSTRUCTION = /\bnew\s+SignedInGrantsAuthorizer\s*\(/g;
const GRANTS_PROPERTY = /^grants\b\s*(?::\s*)?/;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** A construction of `SignedInGrantsAuthorizer` whose grants the checker cannot read. */
interface UnreadGrants {
  readonly file: SourceFile;
  readonly line: number;
}

/** What every signed-in person holds, wherever the project writes it, and the grants the checker cannot read. */
export interface SignedInGrantSources {
  /** Each list of grants, scanned alone: the grants file of the platform, an array given to the authorizer. */
  readonly lists: readonly Scan[];
  readonly unread: readonly UnreadGrants[];
}

/**
 * The grants file of the platform, and the `grants` of every `new SignedInGrantsAuthorizer(...)`
 * outside the tests: an array literal, or a constant declared as one in a source of the project.
 * Any other form (a call, a spread, a parameter) is unread: the rules say they cannot judge it.
 */
export function signedInGrantSources(project: Project): SignedInGrantSources {
  const file = signedInGrants(project);
  const lists: Scan[] = file === undefined ? [] : [file.scan];
  const unread: UnreadGrants[] = [];

  for (const candidate of project.files.filter(({ isTest }) => !isTest)) {
    for (const call of candidate.scan.code.matchAll(CONSTRUCTION)) {
      const value = grantsValue(candidate.scan.code, call.index + call[0].length - 1);
      const found = value === undefined ? [] : listsOf(project, candidate, value);

      if (found.length === 0) {
        unread.push({ file: candidate, line: candidate.scan.lineAt(call.index) });
      }

      lists.push(...found);
    }
  }

  return { lists, unread };
}

/** The value of `grants` in the options object given to the constructor. */
function grantsValue(code: string, open: number): ListPart | undefined {
  const options = callArguments(code, open)[0];

  if (options === undefined || !options.code.startsWith('{')) {
    return undefined;
  }

  for (const property of callArguments(code, options.start)) {
    const key = GRANTS_PROPERTY.exec(property.code);

    if (key !== null) {
      const shorthand = key[0].trim() === 'grants';

      return shorthand
        ? { code: 'grants', start: property.start }
        : { code: property.code.slice(key[0].length), start: property.start + key[0].length };
    }
  }

  return undefined;
}

function listsOf(project: Project, file: SourceFile, value: ListPart): Scan[] {
  if (value.code.startsWith('[')) {
    return [listAt(file, value.start)];
  }

  if (!IDENTIFIER.test(value.code)) {
    return [];
  }

  const declaration = new RegExp(`\\b(?:const|let|var)\\s+${escapeRegExp(value.code)}\\b[^=;]*=\\s*\\[`, 'g');

  return project.files
    .filter(({ isTest }) => !isTest)
    .flatMap((candidate) =>
      [...candidate.scan.code.matchAll(declaration)].map((found) =>
        listAt(candidate, found.index + found[0].length - 1),
      ),
    );
}

/** The array literal opening at `open`, scanned alone so that only its grants are read. */
function listAt(file: SourceFile, open: number): Scan {
  return scan(file.text.slice(open, matchingBracket(file.scan.code, open) + 1));
}
