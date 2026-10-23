import { WiringDraft } from '../wiring/wiring-draft';
import type { Wiring } from '../wiring/wiring';
import type { ContextModule } from './context-module';
import { ModuleRecorder } from './module-recorder';

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
