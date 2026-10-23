import { CliError } from '../cli-error';

export interface GlossaryRow {
  readonly term: string;
  readonly meaning: string;
}

/** The `--term "<Term>=<meaning>"` flags of a command, as rows of a glossary. */
export function parseTerms(flags: readonly string[]): GlossaryRow[] {
  return flags.map((flag) => {
    const [term = '', ...meaning] = flag.split('=');

    if (term.trim() === '' || meaning.join('=').trim() === '') {
      throw new CliError(
        `--term "${flag}" is not a term with its meaning.`,
        'Write it as --term "<Term>=<what it means for the business>", for example --term "Invoice=A request for payment sent to a customer".',
      );
    }

    return { term: term.trim(), meaning: meaning.join('=').trim() };
  });
}
