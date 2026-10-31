import { Arguments } from './arguments';
import { ArgumentsError } from './arguments-error';

type Options = Parameters<typeof Arguments.parse>[1];

/**
 * The arguments of a `db:generate` that takes `--name`, which its script ends with. pnpm forwards
 * the `--` of `pnpm run db:generate fill -- --custom`, after which every word is a positional: it
 * is dropped, so that the flag stays a flag. A word left over is refused: ignored, a flag mistyped
 * would generate another migration than the one asked for.
 */
export function parseMigrationArguments(argv: readonly string[], options: Options): Arguments {
  const args = Arguments.parse(
    argv.filter((word) => word !== '--'),
    options,
  );

  const [extra] = args.positionals;

  if (extra !== undefined) {
    throw new ArgumentsError(
      `"${extra}" is not an argument of db:generate, which takes one name.`,
      'Name the migration in one word, in kebab-case: `npm run db:generate add-invoices`.',
    );
  }

  return args;
}
