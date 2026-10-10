import type { Rule } from '../model/rule.js';
import { perFile } from '../support/per-file.js';

const MAX_FILE_LINES = 350;

export const cleanFileSize: Rule = {
  id: 'clean/file-size',
  description: `A file is at most ${MAX_FILE_LINES} lines, sources and tests alike: past that it holds more than one responsibility.`,
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) => {
      const lines = file.text.split('\n').length - (file.text.endsWith('\n') ? 1 : 0);

      if (lines <= MAX_FILE_LINES || file.path.split('/').includes('generated')) return [];

      return [
        {
          line: MAX_FILE_LINES + 1,
          message: `The file is ${lines} lines long (limit ${MAX_FILE_LINES}).`,
          fix: 'Split it by responsibility: move each concept (a class, a function with its helpers, a family of cases) to its own file named after it.',
        },
      ];
    });
  },
};
