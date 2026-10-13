/**
 * The class of a process manager, as the runner takes it: a static `processName`,
 * `<context>.<process-name>`; the static `timeoutJob`, the name of the background job of the
 * context that delivers its timeouts, when it arms any; and a static `isState`, which recognises
 * a state this process saved, so that a state written by another version is refused, not misread.
 */
export interface ProcessType<State> {
  readonly processName: string;
  readonly timeoutJob?: string | undefined;
  isState(value: unknown): value is State;
}
