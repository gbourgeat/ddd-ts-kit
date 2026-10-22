/**
 * The path of a role file relative to its context, its module of the model left out:
 * `application/calendars/commands/x/x.handler.ts` is where `application/commands/x/x.handler.ts`
 * would be without modules. `modules` are the modules of the model the context declares, read from
 * its generated `<context>.dependencies` file: a folder it does not name is no module.
 */
export function withoutModule(relative: string, modules: readonly string[]): string {
  const [layer, module, ...below] = relative.split('/');

  if (layer !== 'application' || module === undefined || below.length < 2 || !modules.includes(module)) {
    return relative;
  }

  return [layer, ...below].join('/');
}
