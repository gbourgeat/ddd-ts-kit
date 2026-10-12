# ddd-ts-kit/presentation-guard-at-the-edge

Architecture id: `presentation/guard-at-the-edge` (added by this plugin). Default severity: `error` in `recommended`, `error` in `strict`.

Applies to: every `*.guard.ts` file, in a context or in the platform.

## Why

A guard is a control at the edge over a set of routes: is the caller authenticated, does it hold a role, does the tenant of its token match the one of the path, is the key of the request known. A business permission is another thing: it depends on the element (who owns this appointment, is this invoice still a draft) and it is declared on the use case with `@Requires`, so that a job or an event handler sending the same command is held to the same right. A guard that loads an aggregate decides a permission at the one door where not every caller passes.

## Reported

- an import from `domain/` or `infrastructure/`, of any context
- an imported name ending in `Repository` or `UnitOfWork`
- an import of `CommandBus`

Incorrect:

```ts
import { AppointmentRepository } from '@/contexts/scheduling/domain/repositories/appointment.repository';

@Guard()
export class OwnAppointmentGuard implements Guard {
  constructor(private readonly appointments: AppointmentRepository) {}
}
```

Correct:

```ts
@Guard()
export class SameClinicGuard implements Guard {
  readonly documents = { errors: ['FORBIDDEN'] };

  check({ actor, params }: GuardRequest): void {
    if (actor.tenantId !== params['clinicId']) {
      throw new ForbiddenError('The caller belongs to another clinic');
    }
  }
}
```

## Details

A guard may depend on a port of `application/ports/` that answers a question about the caller, such as whether an API key exists: the port is the checkable line, an aggregate behind it is not seen.

## Options

None.

`rules."presentation/guard-at-the-edge"` in `ddd-ts-kit.config.json` set to `off` silences the rule, and `// ddd-ts-kit-disable-next-line presentation/guard-at-the-edge -- <reason>` silences one line, exactly as for `ddd-ts-kit check`.

## With the CLI checker

New with this plugin: the CLI checker has no equivalent.
