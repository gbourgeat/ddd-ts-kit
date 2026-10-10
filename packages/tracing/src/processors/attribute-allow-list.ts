import { DEFAULT_ALLOWED_ATTRIBUTES } from './default-allowed-attributes.js';
import type { EndedSpan } from './ended-span.js';

export interface AttributeAllowListOptions {
  /** Replaces the default list. A name ending with a dot allows every attribute below it. */
  readonly allowed?: readonly string[];
  /** Added to the list in use. */
  readonly alsoAllowed?: readonly string[];
}

/**
 * Keeps on every span, and on its events, only the attributes of the allow-list: request and
 * response headers, bodies, query parameter values of a database call, user and client
 * identifiers an instrumentation may record never reach the exporter. Register it BEFORE the
 * exporting processor.
 */
export class AttributeAllowList {
  private readonly names: ReadonlySet<string>;

  private readonly prefixes: readonly string[];

  constructor(options: AttributeAllowListOptions = {}) {
    const allowed = [...(options.allowed ?? DEFAULT_ALLOWED_ATTRIBUTES), ...(options.alsoAllowed ?? [])];

    this.names = new Set(allowed.filter((name) => !name.endsWith('.')));
    this.prefixes = allowed.filter((name) => name.endsWith('.'));
  }

  onStart(): void {}

  onEnd(span: EndedSpan): void {
    this.prune(span.attributes);

    for (const event of span.events) {
      if (event.attributes !== undefined) this.prune(event.attributes, 'exception.type');
    }
  }

  async forceFlush(): Promise<void> {}

  async shutdown(): Promise<void> {}

  private prune(attributes: Record<string, unknown>, ...kept: readonly string[]): void {
    for (const name of Object.keys(attributes)) {
      if (!kept.includes(name) && !this.allows(name)) Reflect.deleteProperty(attributes, name);
    }
  }

  private allows(name: string): boolean {
    return this.names.has(name) || this.prefixes.some((prefix) => name.startsWith(prefix));
  }
}
