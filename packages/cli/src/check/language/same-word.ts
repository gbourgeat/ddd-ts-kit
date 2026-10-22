import { baseForms } from './base-forms';

/** True when two words share a base form: `Issued`, `Issuing` and `Issues` say `Issue`. */
export function sameWord(left: string, right: string): boolean {
  const forms = baseForms(left);

  return [...baseForms(right)].some((form) => forms.has(form));
}
