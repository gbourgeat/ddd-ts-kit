/**
 * - `fatal`: the process is going down with it.
 * - `error`: a unit of work failed for a reason nobody planned.
 * - `warning`: nothing crashed, yet someone has to look, such as an event buried after a business refusal.
 */
export type ErrorSeverity = 'fatal' | 'error' | 'warning';
