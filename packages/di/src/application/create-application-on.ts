import { collectWiring } from '../module/collect-wiring';
import type { ApplicationOptions } from './application-options';
import type { Application } from './application';
import { assemble } from './assemble';
import type { Container } from './container';

/**
 * Wires the modules into a container of their own (so two applications, or two tests, never
 * share instances) and checks the graph before anything is instantiated. The command and query
 * buses are then resolved to receive the declared handlers; a handler itself is instantiated on
 * the first message it handles.
 */
export function createApplicationOn<Native>(
  container: Container<Native>,
  options: ApplicationOptions,
): Application<Native> {
  return assemble(container, collectWiring(options.modules), options);
}
