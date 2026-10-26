import type { TSESLint } from '@typescript-eslint/utils';
import tseslint from 'typescript-eslint';

type Parser = TSESLint.Parser.LooseParserModule & { readonly name?: string };

interface Context {
  readonly languageOptions?: { readonly parser?: Parser | undefined };
}

/** The stand-in Oxlint hands to its JS plugins as `languageOptions.parser`: it parses nothing (`parse` throws "not implemented"). */
const OXLINT_PARSER = 'oxlint';

/**
 * The parser the run configured, or the one of typescript-eslint when the linter hands none over or
 * only the stand-in of Oxlint: the rules that parse a text of their own then still parse it.
 */
export function parserOf(context: Context): TSESLint.Parser.LooseParserModule {
  const configured = context.languageOptions?.parser;

  return configured === undefined || configured.name === OXLINT_PARSER ? tseslint.parser : configured;
}
