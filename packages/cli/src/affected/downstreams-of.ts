import type { Config } from '../config';

/** Every context that declares `context` as an upstream, directly or through another: the context map read as a dependency graph. */
export function downstreamsOf(config: Config, context: string): string[] {
  const reached = new Set<string>();
  const pending = [context];

  for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
    for (const [name, { upstreams }] of Object.entries(config.contexts)) {
      if (!reached.has(name) && upstreams.some((upstream) => upstream.context === current)) {
        reached.add(name);
        pending.push(name);
      }
    }
  }

  reached.delete(context);

  return [...reached];
}
