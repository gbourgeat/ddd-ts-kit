/** A right somebody may hold, declared once by the context that owns it. */
export interface Permission<Id extends string = string> {
  /** Stable and unique: `<context>:<name>`. What roles, policies and audit trails refer to. */
  readonly id: Id;
  readonly context: string;
  readonly name: string;
  readonly description: string;
}
