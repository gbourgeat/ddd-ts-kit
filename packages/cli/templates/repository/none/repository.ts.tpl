import { ConcurrencyError } from '@ddd-ts-kit/kernel';
{{#if style.declared}}
import { Repository } from '@ddd-ts-kit/kernel/declarations';
{{/if}}
import { {{aggregate.pascal}}, type {{aggregate.pascal}}State } from '../../domain/aggregates/{{aggregate.kebab}}.aggregate.js';
{{#if style.declared}}
import { {{aggregate.pascal}}Repository } from '../../domain/repositories/{{aggregate.kebab}}.repository.js';
{{/if}}
{{#unless style.declared}}
import type { {{aggregate.pascal}}Repository } from '../../domain/repositories/{{aggregate.kebab}}.repository.js';
{{/unless}}

interface Stored{{aggregate.pascal}} {
  readonly state: {{aggregate.pascal}}State;
  readonly version: number;
}

{{#if style.declared}}
@Repository({{aggregate.pascal}}Repository)
{{/if}}
export class InMemory{{aggregate.pascal}}Repository implements {{aggregate.pascal}}Repository {
  private readonly rows = new Map<string, Stored{{aggregate.pascal}}>();

  async findById(id: string): Promise<{{aggregate.pascal}} | undefined> {
    const row = this.rows.get(id);

    if (row === undefined) {
      return undefined;
    }

    const found = {{aggregate.pascal}}.rehydrate(id, structuredClone(row.state));

    found.version = row.version;

    return found;
  }

  async save(saved: {{aggregate.pascal}}): Promise<void> {
    const stored = this.rows.get(saved.id)?.version ?? 0;

    if (stored !== saved.version) {
      throw new ConcurrencyError(saved.id);
    }

    saved.version = stored + 1;
    this.rows.set(saved.id, { state: structuredClone(saved.toState()), version: saved.version });
  }
}
