import { CliError } from '../cli-error';

export interface GlossaryRow {
  readonly term: string;
  readonly meaning: string;
  /** The third cell: what the term must not be confused with, often the same word in a neighbouring context. */
  readonly notConfusedWith?: string;
}

const FORMAT = '--term "<Term>=<what it means for the business>[|<what it must not be confused with>]"';

/**
 * The `--term "<Term>=<meaning>[|<not to be confused with>]"` flags of a command, as rows of a
 * glossary. The pipe opens the third cell: a cell of a Markdown table never holds one, so it is
 * never part of a meaning, while an equals sign may be.
 */
export function parseTerms(flags: readonly string[]): GlossaryRow[] {
  return flags.map((flag) => {
    const [definition = '', notConfusedWith = '', ...extra] = flag.split('|');
    const [term = '', ...meaning] = definition.split('=');

    if (extra.length > 0) {
      throw new CliError(
        `--term "${flag}" holds more than one |.`,
        `A cell of the glossary table cannot hold a |: the one pipe separates the meaning from what the term must not be confused with. Write it as ${FORMAT}.`,
      );
    }

    if (term.trim() === '' || meaning.join('=').trim() === '') {
      throw new CliError(
        `--term "${flag}" is not a term with its meaning.`,
        `Write it as ${FORMAT}, for example --term "Invoice=A request for payment sent to a customer|Quote: the price proposed before the order".`,
      );
    }

    const row = { term: term.trim(), meaning: meaning.join('=').trim() };

    return notConfusedWith.trim() === '' ? row : { ...row, notConfusedWith: notConfusedWith.trim() };
  });
}
