import { nesting } from './nesting.js';

/**
 * The links of a call chain written on one line: what the chain starts from, then each call made
 * on the answer of the previous one (`builder`, `.bind(Port)`, `.toClass(Adapter)`). Members read
 * before the first call belong to the start (`platform.commands`, `.register(...)`).
 */
export function chainLinks(statement: string): string[] {
  const depths = nesting(statement);

  const cuts = statement
    .split('')
    .map((char, index) => (char === '.' && depths[index] === 0 && statement[index - 1] === ')' ? index : -1))
    .filter((index) => index > 0);

  const first = statement.slice(0, cuts[0] ?? statement.length);
  const calls = cuts.map((cut, index) => statement.slice(cut, cuts[index + 1] ?? statement.length));
  const called = first.split('').findIndex((char, index) => char === '(' && depths[index] === 0);
  const member = called === -1 ? -1 : first.lastIndexOf('.', called);

  return member === -1 ? [first, ...calls] : [first.slice(0, member), first.slice(member), ...calls];
}
