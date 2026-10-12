import type { Finding } from '../model/finding.js';
import { FILE_CONTENT_PATTERNS } from './file-content-pattern.js';

const COMMENT = /^\s*(?:\/\/|\/\*|\*|--|#)/;

const FIX =
  'Keep the content in the `FileStorage` port of @ddd-ts-kit/kernel (`ddd-ts-kit generate file-upload` writes the use case) and store in the row the reference `put` answers, a `StoredFile`: key, size, media type, checksum. A small binary value that is not a file (a hash, a key) is a decision: record it as a deviation of this rule.';

/** The lines of a schema or a migration that declare a column of file content; comments are not read. */
export function fileContentFindings(text: string): Finding[] {
  return text.split('\n').flatMap((content, index) => {
    const matched = COMMENT.test(content)
      ? undefined
      : FILE_CONTENT_PATTERNS.map((pattern) => pattern.exec(content)?.[0]).find(Boolean);

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
