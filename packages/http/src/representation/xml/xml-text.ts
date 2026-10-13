const REPLACEMENT = '�';

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/**
 * Text that is safe as the content of an element or the value of an attribute between quotes.
 * A character XML 1.0 cannot carry at all (most control characters, a lone surrogate) becomes
 * U+FFFD: the document stays well formed, and the loss is visible.
 */
export function xmlText(value: string): string {
  let text = '';

  for (const character of value) {
    text += isXmlCharacter(character.codePointAt(0) ?? 0) ? (ESCAPES[character] ?? character) : REPLACEMENT;
  }

  return text;
}

/** The `Char` production of XML 1.0. */
function isXmlCharacter(code: number): boolean {
  return (
    code === 0x9 ||
    code === 0xa ||
    code === 0xd ||
    (code >= 0x20 && code <= 0xd7ff) ||
    (code >= 0xe000 && code <= 0xfffd) ||
    code >= 0x10000
  );
}
