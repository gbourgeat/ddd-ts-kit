import type { Finding } from '../model/finding';
import { FILE_CONTENT_PATTERNS } from './file-content-pattern';

const COMMENT = /^\s*(?:\/\/|\/\*|\*|--|#)/;
/** A comment that ends a line of code: `//` not part of a URL, or `--` of SQL. */
const TRAILING_COMMENT = /(?:(?<!:)\/\/|\s--\s).*$/;
/** A URL written as a string, such as a link to a repository (`.../blob/main/...`). */
const URL_STRING = /(['"`])[a-z][\w+.-]*:\/\/[^'"`]*\1/gi;

const FIX =
  'Keep the content in the `FileStorage` port of @ddd-ts-kit/kernel (`ddd-ts-kit generate file-upload` writes the use case) and store in the row the reference `put` answers, a `StoredFile`: key, size, media type, checksum. A small binary value that is not a file (a hash, a key) is a decision: record it as a deviation of this rule.';

/** The lines of a schema or a migration that declare a column of file content; comments are not read. */
export function fileContentFindings(text: string): Finding[] {
  return text.split('\n').flatMap((content, index) => {
    const matched = COMMENT.test(content)
      ? undefined
      : FILE_CONTENT_PATTERNS.map((pattern) => pattern.exec(codeOf(content))?.[0]).find(Boolean);

    return matched === undefined
      ? []
      : [
          {
            line: index + 1,
            message: `A column of file content ("${matched.trim()}"): files are kept in a storage, never in the database, whose backups, replicas and memory are sized for rows.`,
            fix: FIX,
          },
        ];
  });
}

/** The line without its trailing comment and its URLs, which mention words without declaring anything. */
function codeOf(line: string): string {
  return line.replace(URL_STRING, '""').replace(TRAILING_COMMENT, '');
}
