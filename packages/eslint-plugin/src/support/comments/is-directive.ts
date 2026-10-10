const DIRECTIVE = /^(?:\/?ddd-ts-kit[-:]|eslint-|@ts-|prettier-|biome-|istanbul |c8 |v8 |#region|#endregion|@vitest-|@jest-|\/ <reference|global |globals |jshint |jscs:)/;

/** Comments that are instructions to a tool, not prose: never judged as code or noise. */
export function isDirective(text: string): boolean {
  return DIRECTIVE.test(text);
}
