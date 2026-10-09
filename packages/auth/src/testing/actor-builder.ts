import type { Actor, ActorAttribute, ActorType } from '@ddd-ts-kit/kernel';
import { Builder, sequence, type Defaults } from '@ddd-ts-kit/testing';

interface ActorProps {
  id: string;
  type: ActorType;
  tenantId: string | undefined;
  roles: readonly string[];
  attributes: Readonly<Record<string, ActorAttribute>>;
}

/** By default a user without tenant, role or attribute, with an id of its own: `actor-1`, `actor-2`... */
export class ActorBuilder extends Builder<ActorProps, Actor> {
  named(id: string): this {
    return this.with('id', id);
  }

  ofTenant(tenantId: string): this {
    return this.with('tenantId', tenantId);
  }

  withRole(...roles: readonly string[]): this {
    return this.adding('roles', ...roles);
  }

  withAttributes(attributes: Readonly<Record<string, ActorAttribute>>): this {
    return this.with('attributes', attributes);
  }

  asService(): this {
    return this.with('type', 'service');
  }

  protected defaults(): Defaults<ActorProps> {
    return { id: sequence('actor'), type: 'user', tenantId: undefined, roles: [], attributes: {} };
  }

  protected construct({ tenantId, ...actor }: ActorProps): Actor {
    return tenantId === undefined ? actor : { ...actor, tenantId };
  }
}

const builder = new ActorBuilder();

/** `anActor().named('ada').withRole('accountant').ofTenant('acme').build()` */
export function anActor(): ActorBuilder {
  return builder;
}
