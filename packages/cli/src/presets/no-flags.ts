import type { KindFlags } from '../generate/kind.js';

/** The flags of a generator nobody passed: what a preset starts each of its steps from. */
export const NO_FLAGS: KindFlags = {
  upstream: [],
  term: [],
  value: [],
  transition: [],
  command: false,
  query: false,
  allowName: false,
  public: false,
  tenantScoped: false,
  search: false,
  decorators: false,
  mapper: false,
  serializer: false,
  eventSourced: false,
};
