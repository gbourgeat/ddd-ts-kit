import path from 'node:path';

export function toPosix(file: string): string {
  return file.split(path.sep).join('/');
}
