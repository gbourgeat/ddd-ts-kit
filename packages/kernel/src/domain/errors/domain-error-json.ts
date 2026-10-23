import type { RefusalFacts } from './refusal-facts';

/** A refusal as plain data: its class, its code, its message and the facts it exposes. */
export interface DomainErrorJson {
  readonly name: string;
  readonly code: string;
  readonly message: string;
  /** Absent when the refusal exposes none. */
  readonly facts?: RefusalFacts;
}
