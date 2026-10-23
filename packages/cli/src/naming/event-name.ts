import type { Name } from './name';

/** `<context>.<aggregate>.<fact>`, the name of a domain event and of the integration event that announces it. */
export function eventName(context: Name, aggregate: Name, fact: Name): string {
  return `${context.kebab}.${aggregate.kebab}.${fact.kebab}`;
}
