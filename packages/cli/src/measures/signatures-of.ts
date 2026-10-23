const RULE_ID = /\b[a-z][a-z-]*\/[a-z][a-z-]*\b/g;

/**
 * What a remark or a finding is recognised by across stories: each rule id it names, and its text
 * without punctuation, case or row ids when it is long enough to mean something. A signature seen
 * in two stories is a repeat: the mistake the guide of the team should have caught.
 */
export function signaturesOf(texts: readonly string[]): string[] {
  return [...new Set(texts.flatMap((text) => signatureOf(text)))];
}

function signatureOf(text: string): string[] {
  const ids = [...text.matchAll(RULE_ID)].map((match) => match[0]);

  const words = text
    .replace(RULE_ID, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9àâçéèêëîïôûùüÿœ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return [...ids, ...(words.length >= 12 ? [words] : [])];
}
