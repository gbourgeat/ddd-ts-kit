import { CliError } from '../cli-error';
import type { Name } from './name';
import { toName } from './to-name';

/**
 * A name the caller typed, as the kit writes it, once nothing of it is lost on the way: only the
 * case and the separators (`-`, `_`, spaces) may change. `../evil` would be read `evil` and
 * `Évil` `vil`: both are refused, with what the kit would have made of them.
 */
export function readName(input: string, what: string, fix: string): Name {
  const name = toName(input);

  if (kept(input) === kept(name.kebab)) {
    return name;
  }

  const read = name.kebab === '' ? 'nothing' : `\`${name.kebab}\``;

  throw new CliError(
    `\`${input}\` is not a name: a ${what} is named in letters, digits and dashes, and the kit would have read ${read} in it.`,
    fix,
  );
}

/** What may differ between a name as typed and as the kit writes it: the case and the separators. */
function kept(text: string): string {
  return text.toLowerCase().replace(/[-_\s]+/g, '');
}
