import type { RequestContext } from '../route/request-context';
import type { GuardAdmission } from './guard-admission';

/** What a guard reads to let a request through or refuse it: who calls, which route, and its validated path. */
export interface GuardRequest extends GuardAdmission {
  /** The path parameters, through the schema of the controller when it declares one. */
  readonly params: Readonly<Record<string, unknown>>;
  readonly context: RequestContext;
}
