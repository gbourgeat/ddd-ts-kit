import { WiringDraft } from '../wiring/wiring-draft.js';
import type { Wiring } from '../wiring/wiring.js';
import type { ContextModule } from './context-module.js';
import { ModuleRecorder } from './module-recorder.js';

/** Runs the `register` function of every module and returns what they declared. */
export function collectWiring(modules: readonly ContextModule[]): Wiring {
  const draft = new WiringDraft();

  for (const module of modules) {
    const recorder = new ModuleRecorder(module.name, draft);

    module.register(recorder);
    recorder.assertNothingLeftUnfinished();
  }

  return draft.wiring(modules.map((module) => module.name));
}
