import { SessionBuilder } from './session-builder';

const sessionBuilder = new SessionBuilder();

/** `aSession().of(ada).impersonatedBy('support-7').expiringAt(tonight).build()` */
export function aSession(): SessionBuilder {
  return sessionBuilder;
}
