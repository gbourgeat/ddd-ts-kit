/**
 * The path of a role file relative to its context, its module of the model left out:
 * `calendars/application/commands/x/x.handler.ts` is where `application/commands/x/x.handler.ts`
 * would be without modules, and so is `application/calendars/commands/x/x.handler.ts`, as 0.86 and
 * 0.87 laid modules out. `modules` are the modules of the model the context declares, read from its
 * generated `<context>.dependencies` file: a folder it does not name is no module.
 */
export function withoutModule(relative: string, modules: readonly string[]): string {
  const [first = '', second, ...below] = relative.split('/');

  if (modules.includes(first) && second !== undefined) {
    return [second, ...below].join('/');
  }

  if (first !== 'application' || second === undefined || below.length < 2 || !modules.includes(second)) {
    return relative;
  }

  return [first, ...below].join('/');
}
