import { aliasRoots, specifierSuffix } from '../alias';
import { rewriteAliases } from '../build';
import { readConfig } from '../config';
import { Arguments } from './arguments';
import { type Command } from './command';

const BUILD_PROJECT = 'tsconfig.build.json';

/** After the compiler: turns the alias specifiers of the compiled output into relative ones, which plain `node` resolves. */
export const buildAliasesCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, { project: { type: 'string' } });
  const root = args.projectRoot;
  const { config } = readConfig(root);
  const suffix = specifierSuffix(config.importExtension);
  const project = args.text('project') ?? BUILD_PROJECT;
  const report = rewriteAliases({ root, roots: aliasRoots(config), suffix, project });

  io.out(
    args.json
      ? JSON.stringify(report, null, 2)
      : `rewritten  ${report.specifiers} alias specifier(s) in ${report.changed} of ${report.files} file(s) under ${report.outDir}/`,
  );

  return 0;
};
