import { CliError } from '../../../cli-error';
import type { RenderContext } from '../../../templating';
import type { Scope } from '../../scope';

const TEXT_RULES = ['utf-8', 'single-byte'];

/** The document a generated upload receives unless `--text` says it is a text file. */
const DOCUMENT: RenderContext = {
  isText: false,
  singleByte: false,
  fileName: 'scan.pdf',
  mediaType: 'application/pdf',
  sampleName: 'PDF',
  sample: "'%PDF-1.7\\n%%EOF\\n'",
  head: "'%PDF-'",
};

/**
 * What the templates of an upload read about its file. Without `--text` a document (PDF or image);
 * with it a text file such as a CSV, under the names browsers give one, held to the text rule asked:
 * `utf-8`, or `single-byte` for the exports of a bank or a spreadsheet in Windows-1252.
 */
export function uploadFileVars({ flags }: Scope): RenderContext {
  const { text } = flags;

  if (text === undefined) {
    return DOCUMENT;
  }

  if (!TEXT_RULES.includes(text)) {
    throw new CliError(
      `--text takes ${TEXT_RULES.join(' or ')}, not "${text}".`,
      'Use `--text utf-8` for a text file read as UTF-8, `--text single-byte` when it may also be in Windows-1252 or ISO-8859-1; leave the flag out for a document (PDF, image).',
    );
  }

  const singleByte = text === 'single-byte';

  return {
    isText: true,
    singleByte,
    text,
    fileName: 'export.csv',
    mediaType: 'text/csv',
    sampleName: 'CSV',
    sample: "'label;amount\\r\\ncoffee;3,50\\r\\n'",
    head: "'label;amount'",
    taken: singleByte ? 'WINDOWS_1252' : 'UTF_8',
  };
}
