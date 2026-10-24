{{#if tenant.scoped}}
import type { AuditStamp, TenantScoped } from '@ddd-ts-kit/kernel';
{{/if}}
{{#unless tenant.scoped}}
import type { AuditStamp } from '@ddd-ts-kit/kernel';
{{/unless}}
import { {{aggregate.pascal}} } from '{{alias.context}}/domain/aggregates/{{aggregate.kebab}}.aggregate{{alias.ext}}';
import type { {{context.pascal}}{{aggregate.pascal}} as {{aggregate.pascal}}Row } from '{{alias.generated}}/prisma/client{{alias.ext}}';

export type {{aggregate.pascal}}Columns = Omit<{{aggregate.pascal}}Row, 'version' | keyof AuditStamp{{#if tenant.scoped}} | keyof TenantScoped{{/if}}>;

export const {{aggregate.pascal}}Mapper = {
  toDomain(row: {{aggregate.pascal}}Row): {{aggregate.pascal}} {
    // TODO(domain): rebuild each value object of {{aggregate.pascal}}State from its fields.
    const loaded = {{aggregate.pascal}}.rehydrate(row.id, { registeredAt: row.registeredAt });

    loaded.version = row.version;

    return loaded;
  },

  toRow(saved: {{aggregate.pascal}}): {{aggregate.pascal}}Columns {
    // TODO(domain): flatten each value object of {{aggregate.pascal}}State into its fields; nothing of the row type leaves this file.
    return { id: saved.id, ...saved.toState() };
  },
};
