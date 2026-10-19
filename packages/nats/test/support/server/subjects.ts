/** Whether `subject` falls under `pattern`: `*` stands for one token, `>` for one or more at the end. */
export function subjectMatches(pattern: string, subject: string): boolean {
  const wanted = pattern.split('.');
  const tokens = subject.split('.');

  for (const [index, token] of wanted.entries()) {
    if (token === '>') {
      return tokens.length > index;
    }

    if (index >= tokens.length || (token !== '*' && token !== tokens[index])) {
      return false;
    }
  }

  return wanted.length === tokens.length;
}
