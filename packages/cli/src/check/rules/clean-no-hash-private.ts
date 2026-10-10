import type { Rule } from '../model/rule.js';
import { perFile } from '../support/per-file.js';

const HASH_MEMBER =
  /^[ \t]*(?:(?:static|readonly|async|get|set|declare|override|accessor)\s+)*\*?\s*#([A-Za-z_$][\w$]*)/gm;

export const cleanNoHashPrivate: Rule = {
  id: 'clean/no-hash-private',
  description:
    'Class members are `private`, never `#name`: one way to hide a member, the one the compiler checks and the fakes of a test can reach.',
  scope: 'file',
  run(project) {
    return perFile(project, this.id, (file) =>
      [...file.scan.code.matchAll(HASH_MEMBER)].map((match) => ({
        line: file.scan.lineAt(match.index + match[0].indexOf('#')),
        message: `The member #${match[1] ?? ''} is an ECMAScript private member.`,
        fix: `Declare it \`private ${match[1] ?? 'name'}\` and write \`this.${match[1] ?? 'name'}\` where it is used.`,
      })),
    );
  },
};
