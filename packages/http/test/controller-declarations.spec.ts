import { describe, expect, it } from 'vitest';
import { declarationOf } from '@ddd-ts-kit/kernel/declarations';
import {
  Authenticated,
  Controller,
  Guard,
  HasRole,
  Public,
  RequestMapper,
  RouteGroup,
  Serializer,
  controllerRoute,
  controllerRoutes,
  executeRoute,
  type GuardRequest,
} from '../src';
import { LeavesOutAHeaderController } from './fixtures/controllers/controller-mistakes';

const answer = { method: 'GET', summary: 'Read', response: { status: 204 } } as const;

class LedgerRoutes {}

RouteGroup({ prefix: '/ledger', guards: [Authenticated] })(LedgerRoutes);

describe('a controller declaration', () => {
  it('is refused when it declares a raw body and also reads one', () => {
    const declare = (): void => {
      class ReceiveAlertController {
        handle(): void {}
      }

      Controller({
        ...answer,
        method: 'POST',
        path: '/alerts',
        guards: [Public],
        rawBody: true,
        consumes: ['text/xml'],
      })(ReceiveAlertController);
    };

    expect(declare).toThrow(/ReceiveAlertController declares rawBody and consumes: the body is left unparsed/);
  });

  it('is refused when nothing says who may call the route', () => {
    class UnguardedRoutes {}

    RouteGroup({ prefix: '/open' })(UnguardedRoutes);

    const withoutGroup = (): void => {
      class ReadEntriesController {
        handle(): void {}
      }

      Controller({ ...answer, path: '/entries' })(ReadEntriesController);
    };

    const inAGroupWithoutGuards = (): void => {
      class ReadOpenEntriesController {
        handle(): void {}
      }

      Controller({ ...answer, group: UnguardedRoutes, path: '/entries' })(ReadOpenEntriesController);
    };

    expect(withoutGroup).toThrow(/ReadEntriesController names no group with guards and no guard of its own/);
    expect(inAGroupWithoutGuards).toThrow(/declare `guards: \[Public\]` when anybody may/);
  });

  it('is refused when it is both public and guarded', () => {
    const declare = (): void => {
      class ReadRatesController {
        handle(): void {}
      }

      Controller({ ...answer, group: LedgerRoutes, path: '/rates', guards: [Public] })(ReadRatesController);
    };

    expect(declare).toThrow(/ReadRatesController is behind Public and another guard/);
  });

  it('is refused on a path, a prefix, a group or a class name that cannot stand', () => {
    class NotAGroup {}

    const declare = (path: string, group: typeof LedgerRoutes = LedgerRoutes): void => {
      class ReadBalanceController {
        handle(): void {}
      }

      Controller({ ...answer, group, path })(ReadBalanceController);
    };

    const misnamed = (): void => {
      class ReadBalance {
        handle(): void {}
      }

      Controller({ ...answer, group: LedgerRoutes, path: '/misnamed' })(ReadBalance);

      void ReadBalance;
    };

    expect(() => declare('balance')).toThrow(/the path "balance" must be made of literal segments/);
    expect(() => declare('/balance/')).toThrow(/literal segments and ":name" parameters/);
    expect(() => declare('/balance', NotAGroup)).toThrow(/its group NotAGroup carries no @RouteGroup/);

    expect(misnamed).toThrow(
      /ReadBalance carries @Controller: name the class after its use case, ending in Controller/,
    );

    expect(() => RouteGroup({ prefix: 'ledger/' })(class BadPrefixRoutes {})).toThrow(/the prefix "ledger\/" must be/);
    expect(() => RouteGroup({ parent: NotAGroup })(class OrphanRoutes {})).toThrow(/its parent NotAGroup carries no/);
    expect(() => RouteGroup()(LedgerRoutes)).toThrow(/LedgerRoutes is declared as a route group twice/);
    expect(() => HasRole()).toThrow(/HasRole\(\) names no role/);
  });

  it('makes the class a declared class of the edge, like its guards, mappers and serializers', () => {
    class ReadLedgerController {
      handle(): void {}
    }

    Controller({ ...answer, group: LedgerRoutes, path: '/' })(ReadLedgerController);

    class OfficeHoursGuard implements Guard {
      check(_request: GuardRequest): void {}
    }

    Guard()(OfficeHoursGuard);

    class EntryMapper implements RequestMapper<string, number> {
      map(request: string): number {
        return request.length;
      }
    }

    RequestMapper()(EntryMapper);

    class EntrySerializer implements Serializer<number, string> {
      serialize(result: number): string {
        return String(result);
      }
    }

    Serializer()(EntrySerializer);

    const parts = [ReadLedgerController, OfficeHoursGuard, EntryMapper, EntrySerializer].map(declarationOf);

    expect(parts).toMatchObject([
      { role: 'edge', part: 'controller', implementation: ReadLedgerController, dependencies: undefined },
      { role: 'edge', part: 'guard' },
      { role: 'edge', part: 'mapper' },
      { role: 'edge', part: 'serializer' },
    ]);
  });
});

describe('controllerRoutes', () => {
  class ReadLedgerRootController {
    handle(): void {}
  }

  Controller({ ...answer, group: LedgerRoutes, path: '/' })(ReadLedgerRootController);

  class ApiKeyGuard implements Guard {
    readonly documents = { security: ['apiKey'], errors: ['UNAUTHORIZED'] };

    check(_request: GuardRequest): void {}
  }

  Guard()(ApiKeyGuard);

  it('mounts the root of a group at its prefix, and names the schemes of the application or of a guard', () => {
    class ReadKeysController {
      handle(): void {}
    }

    Controller({ ...answer, path: '/keys', guards: [ApiKeyGuard, new ApiKeyGuard()] })(ReadKeysController);

    const routes = controllerRoutes([new ReadLedgerRootController(), new ReadKeysController()], {
      resolve: (target) => Reflect.construct(target, []),
      security: ['oidc'],
    });

    expect(routes.map((route) => [route.path, route.security])).toEqual([
      ['/ledger', ['oidc']],
      ['/keys', ['apiKey']],
    ]);

    expect(routes[0]?.request).toBeUndefined();
  });

  it('refuses a class it cannot build, a class that is no controller and two controllers of one endpoint', () => {
    class Plain {
      handle(): void {}
    }

    class ReadLedgerAgainController {
      handle(): void {}
    }

    Controller({ ...answer, group: LedgerRoutes, path: '/', operationId: 'readAgain' })(ReadLedgerAgainController);

    expect(() => controllerRoutes([ReadLedgerRootController])).toThrow(/is given as a class and nothing builds it/);

    expect(() => controllerRoutes([new Plain()])).toThrow(
      /Plain is mounted as a controller and carries no @Controller/,
    );

    expect(() => controllerRoutes([Object.create(null)])).toThrow(/the instance of no class/);

    expect(() => controllerRoutes([new ReadLedgerRootController(), new ReadLedgerAgainController()])).toThrow(
      /both declare GET \/ledger/,
    );
  });

  it('builds the route of one controller, with or without its guards, and refuses what has no handle', async () => {
    class GuardedController {
      handle(): void {}
    }

    Controller({ ...answer, path: '/guarded', guards: [HasRole('admin')] })(GuardedController);

    const request = { params: {}, query: {}, headers: {}, body: undefined, raw: undefined };
    const guarded = controllerRoute(new GuardedController());

    const alone = controllerRoute(GuardedController, {
      guards: 'skip',
      resolve: (target) => Reflect.construct(target, []),
    });

    expect((await executeRoute(guarded, request)).status).toBe(401);
    expect((await executeRoute(alone, request)).status).toBe(204);
    expect(alone.errors).toEqual(['UNAUTHORIZED', 'FORBIDDEN']);

    expect(() => controllerRoute(GuardedController, { resolve: () => Object.create(null) })).toThrow(
      /has no handle method/,
    );
  });

  it('hands the guards the headers as they arrived and the session of the request', async () => {
    const seen: GuardRequest[] = [];

    class SeenController {
      handle(): void {}
    }

    Controller({
      ...answer,
      path: '/seen',
      guards: [{ check: (request) => void seen.push(request) }],
    })(SeenController);

    const [route] = controllerRoutes([new SeenController()]);
    const session = { id: 's-1', actor: { id: 'ada', type: 'user', roles: [], attributes: {} }, issuedAt: new Date(0) };
    const principal = { ...session, authenticationMethod: 'token', extensions: {} };
    const request = { params: 'none', query: {}, headers: { 'x-api-key': 'k-1' }, body: undefined, raw: undefined };

    if (route === undefined) {
      throw new Error('No route was built.');
    }

    await executeRoute(route, request, { resolvePrincipal: () => principal });
    await executeRoute(route, request);

    expect(seen[0]).toMatchObject({ method: 'GET', path: '/seen', operationId: 'seen', params: {} });
    expect(seen[0]?.headers).toEqual({ 'x-api-key': 'k-1' });
    expect(seen[0]?.session?.id).toBe('s-1');
    expect(seen[1]?.session).toBeUndefined();
    expect(seen[1]?.actor.type).toBe('anonymous');
  });
});

describe('the answer of a controller', () => {
  it('fails the call as a defect when handle leaves out a header the controller declares', async () => {
    const seen: unknown[] = [];
    const request = { params: {}, query: {}, headers: {}, body: { patientId: 'patient-7' }, raw: undefined };

    const response = await executeRoute(controllerRoute(new LeavesOutAHeaderController()), request, {
      onError: (error) => void seen.push(error),
    });

    expect(response.status).toBe(500);

    expect(seen).toEqual([
      new Error('handle declares the header Location and returned none: return { body, headers } with it.'),
    ]);
  });
});
