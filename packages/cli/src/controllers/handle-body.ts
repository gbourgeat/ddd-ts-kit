import type { FunctionRoute } from './function-route.js';

const ANSWER = /return \{\s*status: \d{3},\s*body: ([\s\S]*?),?\s*\};(?=\s*(?:\}|$))/g;
const EMPTY_ANSWER = /\n?[ \t]*return \{\s*status: \d{3},?\s*\};/g;

/**
 * The statements of the handler as the body of `handle`: the input is the request, the actor is
 * on it, the bus is a member, and an answer is what is returned, without its status. Answers
 * `undefined` when an answer is left that is not of that form (headers, a status chosen at run time).
 */
export function handleBody(route: FunctionRoute): string | undefined {
  const { input, bus } = route;

  const body = route.body
    .replaceAll(new RegExp(String.raw`actorOf\(${input}\.context\.principal\)`, 'g'), 'request.actor')
    .replaceAll(new RegExp(String.raw`actorOf\(${input}\.context\)`, 'g'), 'request.actor')
    .replaceAll(new RegExp(String.raw`(?<![.\w])${input}\b`, 'g'), 'request')
    .replaceAll(new RegExp(String.raw`(?<![.\w])${bus}\.`, 'g'), `this.${bus}.`)
    .replaceAll(ANSWER, 'return $1;')
    .replaceAll(EMPTY_ANSWER, '');

  if (/\bstatus:\s*\d{3}/.test(body) || /\bactorOf\(/.test(body)) {
    return undefined;
  }

  return dedent(body.replace(/^\n+|\s+$/g, ''));
}

/** A handler is written two levels deeper than a method of a class. */
function dedent(body: string): string {
  return body
    .split('\n')
    .map((line) => (line.startsWith('    ') ? line.slice(2) : line))
    .join('\n');
}
