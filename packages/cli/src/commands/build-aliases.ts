import { aliasRoots } from '../alias/index.js';
import { rewriteAliases } from '../build/index.js';
import { readConfig } from '../config/index.js';
import { Arguments } from './arguments.js';
import { type Command } from './command.js';

const BUILD_PROJECT = 'tsconfig.build.json';

/** After the compiler: turns the alias specifiers of the compiled output into relative ones, which plain `node` resolves. */
export const buildAliasesCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { project: { type: 'string' } });
  const root = args.projectRoot;
  const roots = aliasRoots(readConfig(root).config);
  const report = rewriteAliases({ root, roots, project: args.text('project') ?? BUILD_PROJECT });

  io.out(
    args.json
      ? JSON.stringify(report, null, 2)
      : `rewritten  ${report.specifiers} alias specifier(s) in ${report.changed} of ${report.files} file(s) under ${report.outDir}/`,
  );

  return 0;
};
