import type { LanguageProbe } from './language-probe';

/**
 * Hears each file a command builds on, where the generator found it: the aggregate of
 * `--aggregate`, the port of an adapter, the use case of a route, a route group, the route, the
 * event handler or the job an end-to-end spec starts its use case with, the context it writes in
 * and the upstreams it declares (their CONTEXT.md), the declaration of an event.
 */
export type PrerequisiteProbe = (file: string) => void;

/**
 * What `plan-waves` hears of a replayed command: the names it would judge, in place of the
 * judgement, the files it builds on, and the files it created. The generator itself says what a
 * command needs and what it gives, so that the plan can tell which row a row has to wait for.
 */
export interface GeneratorProbe {
  readonly language: LanguageProbe;
  readonly builtOn: PrerequisiteProbe;
  readonly created: (files: readonly string[]) => void;
}
