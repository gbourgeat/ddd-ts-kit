import fs from 'node:fs';

/** The text for a file that has CRLF line ends on disk, so that it keeps them; any other file is written as it is, with LF. */
export function inLineEndOfDisk(absolute: string, content: string): string {
  return hasCrlf(absolute) ? content.replace(/\r?\n/g, '\r\n') : content;
}

function hasCrlf(absolute: string): boolean {
  try {
    return fs.readFileSync(absolute, 'utf8').includes('\r\n');
  } catch {
    return false;
  }
}
