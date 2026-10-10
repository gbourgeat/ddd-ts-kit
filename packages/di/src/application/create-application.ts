import { collectWiring } from '../module/collect-wiring.js';
import type { ApplicationOptions } from './application-options.js';
import type { Application } from './application.js';
import { assemble } from './assemble.js';

/**
 * Wires the modules into a tsyringe child container (so two applications, or two tests,
 * never share instances) and checks the graph before anything is instantiated. The command
 * and query buses are then resolved to receive the declared handlers; a handler itself is
 * instantiated on the first message it handles.
 */
export function createApplication(options: ApplicationOptions): Application {
  return assemble(collectWiring(options.modules), options);
}
