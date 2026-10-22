/**
 * The folders a role owns directly under `application/`: any other folder there is a module of
 * the model, `application/<module>/commands/...`. Same list as the application folders of
 * `ROLE_FOLDERS` of the CLI, which this package does not depend on.
 */
const APPLICATION_ROLE_FOLDERS: ReadonlySet<string> = new Set([
  'commands',
  'queries',
  'ports',
  'authorization',
  'event-handlers',
  'scheduling',
  'background',
  'processes',
  'projections',
  'integration',
]);

/**
 * The path of a role file relative to its context, its module of the model left out:
 * `application/calendars/commands/x/x.handler.ts` is where `application/commands/x/x.handler.ts`
 * would be without modules. Discovery runs without the config, so a module is read by structure.
 */
export function withoutModule(relative: string): string {
  const [layer, module, ...below] = relative.split('/');

  if (layer !== 'application' || module === undefined || below.length < 2 || APPLICATION_ROLE_FOLDERS.has(module)) {
    return relative;
  }

  return [layer, ...below].join('/');
}
