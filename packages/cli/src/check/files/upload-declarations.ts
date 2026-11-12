import type { Scan } from '../scan/scan';
import type { StringRecord } from '../scan/string-record';
import { matchingBracket } from '../text/matching-bracket';
import type { UploadDeclaration } from './upload-declaration';

const UPLOAD = /(?<![\w$.])upload\s*:\s*\{/g;
const MEDIA_TYPES = /(?<![\w$.])mediaTypes\s*:\s*(\[)?/;
const CONTENT_RULES = /(?<![\w$.])contentRules\s*:\s*(\{)?/;
/** What stands between the strings of a list or of an object written whole: quotes and separators, the lexer having blanked the rest. */
const ONLY_LITERALS = /^[\s,:'"]*$/;
const UNREAD = 'unread';

interface Span {
  readonly from: number;
  readonly to: number;
}

/**
 * The uploads a route file declares with its media types, and its content rules if any, written as
 * literals: all a reading of the text can judge. One that builds them elsewhere (a constant, a
 * spread) is left out: `@ddd-ts-kit/http` judges it when the route is declared.
 */
export function uploadDeclarations(scan: Scan): UploadDeclaration[] {
  return [...scan.code.matchAll(UPLOAD)].flatMap((match) => {
    const from = match.index + match[0].length - 1;
    const upload = { from, to: matchingBracket(scan.code, from) };
    const mediaTypes = literalsOf(scan, MEDIA_TYPES, upload);
    const stated = literalsOf(scan, CONTENT_RULES, upload) ?? [];

    if (mediaTypes === undefined || mediaTypes === UNREAD || stated === UNREAD) {
      return [];
    }

    return [{ mediaTypes, stated: stated.filter((literal) => literal.value.includes('/')) }];
  });
}

/** The strings of a property of the upload: `undefined` when it is absent, `unread` when it is not written whole. */
function literalsOf(scan: Scan, property: RegExp, upload: Span): StringRecord[] | typeof UNREAD | undefined {
  const body = scan.code.slice(upload.from, upload.to);
  const match = property.exec(body);

  if (match === null) {
    return undefined;
  }

  if (match[1] === undefined || body.includes('...')) {
    return UNREAD;
  }

  const open = upload.from + match.index + match[0].length - 1;
  const close = matchingBracket(scan.code, open);

  return ONLY_LITERALS.test(scan.code.slice(open + 1, close))
    ? scan.strings.filter((literal) => literal.start > open && literal.end <= close)
    : UNREAD;
}
