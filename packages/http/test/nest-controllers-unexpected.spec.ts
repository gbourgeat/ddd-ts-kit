import 'reflect-metadata';
import { Body, Controller, HttpCode, Post, RequestMethod, UseGuards } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { Public } from '../src';
import { CurrentActor, KitRoute, nestControllerRoutes } from '../src/nest';

/**
 * What the bridge does when the metadata of a controller is not what it reads: written by hand
 * here, in the shape a future release of Nest might give it. The route is refused when it is
 * built, at the start, never served read wrong.
 */
function controllerWith(
  decorators: readonly MethodDecorator[],
  after: (target: { prototype: object; controller: object }) => void = () => undefined,
): new () => object {
  class Acting {
    act(): void {}
  }

  Controller('acting')(Acting);

  Reflect.decorate(
    [KitRoute({ operationId: 'act', summary: 'Act', guards: [Public] }), ...decorators],
    Acting.prototype,
    'act',
    {
      value: Acting.prototype.act,
    },
  );

  after({ prototype: Acting.prototype, controller: Acting });

  return Acting;
}

describe('metadata of Nest the kit does not expect', () => {
  it.each([
    ['no method of Nest on the route', [], () => undefined, /no @Get, @Post/],
    ['several paths', [Post(['a', 'b'])], () => undefined, /has one path, and Nest declares several/],
    [
      'a status that is no number',
      [Post()],
      ({ prototype }: { prototype: object }) => {
        Reflect.defineMetadata(HTTP_CODE_METADATA, 'created', Reflect.get(prototype, 'act'));
      },
      /@HttpCode of Nest holds no status/,
    ],
    [
      'parameters that are no record',
      [Post()],
      ({ controller }: { controller: object }) => {
        Reflect.defineMetadata(ROUTE_ARGS_METADATA, 'body', controller, 'act');
      },
      /the parameters Nest declares are not read/,
    ],
    [
      'a parameter without its index',
      [Post()],
      ({ controller }: { controller: object }) => {
        Reflect.defineMetadata(ROUTE_ARGS_METADATA, { '3:0': { data: undefined } }, controller, 'act');
      },
      /the parameter 3:0 Nest declares is not read/,
    ],
    [
      'a parameter read by something else than a name',
      [Post()],
      ({ controller }: { controller: object }) => {
        Reflect.defineMetadata(
          ROUTE_ARGS_METADATA,
          { '5:0': { index: 0, data: { name: 'id' }, pipes: [] } },
          controller,
          'act',
        );
      },
      /is read by something else than a name/,
    ],
    [
      'a parameter with a pipe of Nest',
      [Post()],
      ({ prototype }: { prototype: object }) => {
        Body(
          class Trim {
            transform(value: unknown): unknown {
              return value;
            }
          },
        )(prototype, 'act', 0);
      },
      /has pipes of Nest, which the kit does not run/,
    ],
    [
      'a body read one field at a time',
      [Post()],
      ({ prototype }: { prototype: object }) => {
        Body('name')(prototype, 'act', 0);
      },
      /the body is read one field at a time/,
    ],
    [
      'a decorator of the kit on a member that is no method',
      [Post()],
      ({ prototype }: { prototype: object }) => {
        Object.defineProperty(prototype, 'count', { get: () => 1, configurable: true });
        KitRoute({ operationId: 'count', summary: 'Count', guards: [Public] })(prototype, 'count');
      },
      /Acting.count carries @KitRoute and is no method/,
    ],
  ])('refuses %s', (_what, decorators, after, message) => {
    expect(() => nestControllerRoutes([controllerWith(decorators, after)])).toThrow(message);
  });
});

describe('metadata of Nest the kit reads as far as it goes', () => {
  it('serves at the path of the controller a method whose decorator names a method and no path', () => {
    const [route] = nestControllerRoutes([
      controllerWith([], ({ prototype }) => {
        Reflect.defineMetadata(METHOD_METADATA, RequestMethod.POST, Reflect.get(prototype, 'act'));
      }),
    ]);

    expect(route).toMatchObject({ method: 'POST', path: '/acting' });
  });

  it('refuses a controller bound to a receiver, which has no prototype to read the decorators from', () => {
    class Acting {
      act(): void {}
    }

    const Bound = Acting.bind(null);

    Controller('bound')(Bound);

    expect(() => nestControllerRoutes([Bound])).toThrow(/bound Acting has no prototype: it is no class/);
  });

  it('serves a route whose list of guards of Nest is empty, and one with a status of its own', () => {
    const [route] = nestControllerRoutes([controllerWith([Post(), HttpCode(202), UseGuards()])]);

    expect(route?.responses).toHaveProperty('202');
  });

  it('refuses a controller none of whose methods is a route of the kit, and a decorator of the kit on a symbol', () => {
    class Bare {}

    Controller('bare')(Bare);

    expect(() => nestControllerRoutes([Bare])).toThrow(/no method carries a route decorator of Nest/);
    expect(() => KitRoute({ operationId: 'x', summary: 'X' })({}, Symbol('x'))).toThrow(/a method named by a string/);
    expect(() => CurrentActor()(class {}, undefined, 0)).toThrow(/goes on a parameter of a method/);
  });

  it('refuses to read a controller when reflect-metadata is not loaded', () => {
    const loaded: unknown = Reflect.get(Reflect, 'getMetadata');

    Reflect.deleteProperty(Reflect, 'getMetadata');

    try {
      expect(() => nestControllerRoutes([class Unread {}])).toThrow(/through reflect-metadata/);
    } finally {
      Reflect.set(Reflect, 'getMetadata', loaded);
    }
  });
});
