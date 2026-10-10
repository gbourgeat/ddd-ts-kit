// The transcript of the demo: Markdown on the standard output, bodies trimmed, never a token.
import process from 'node:process';

const LIMIT = 700;

export function say(text) {
  process.stdout.write(text + '\n');
}

export function section(title) {
  say('\n## ' + title + '\n');
}

/** One call: who, what, the status, and the start of the body. */
export function show(who, method, path, answer) {
  const body = answer.body === undefined ? '' : JSON.stringify(answer.body);

  say(`- \`${method} ${path}\` as **${who}**: \`${answer.status}\`${body === '' ? '' : ' `' + trimmed(body) + '`'}`);
}

function trimmed(text) {
  return text.length <= LIMIT ? text : text.slice(0, LIMIT) + ' ...';
}
