import { describe, expect, it } from 'vitest';
import { Clock } from '@ddd-ts-kit/kernel';
import { createApplication, defineContextModule, describeToken, override, overrideForTests } from '../src';
import { wiringFailure } from './support/failure';
import { EpochClock } from './support/shop/epoch-clock';
import { platform } from './support/shop/platform.module';
import { ReserveStock } from './support/shop/reserve-stock';
import { shop } from './support/shop/shop.module';

describe('wiring errors', () => {
  it('rejects a port bound twice and names both modules', () => {
    const duplicate = defineContextModule({
      name: 'billing',
      register: (builder) => {
        builder.bind(Clock).toValue(new EpochClock());
      },
    });

    const error = wiringFailure(() => createApplication({ modules: [platform, duplicate] }));

    expect(error.code).toBe('DUPLICATE_BINDING');
    expect(error.message).toBe('Token "Clock" is bound twice: by module "platform" and by module "billing".');
  });

  it('rejects a dependency that no module binds, naming the port and the module', () => {
    const error = wiringFailure(() => createApplication({ modules: [shop] }));

    expect(error.code).toBe('UNBOUND_DEPENDENCY');
    expect(error.message).toBe('"ReserveStock" in module "shop" depends on "Clock", which no module binds.');
  });
});

describe('dependency cycles and unbound ports', () => {
  it('rejects a cycle between class bindings before instantiating anything', () => {
    let built = 0;

    class Egg {
      constructor(readonly laidBy: Hen) {
        built += 1;
      }
    }
    class Chick {
      constructor(readonly hatchedFrom: Egg) {
        built += 1;
      }
    }
    class Hen {
      constructor(readonly grownFrom: Chick) {
        built += 1;
      }
    }

    const cyclic = defineContextModule({
      name: 'cyclic',
      register(builder) {
        builder.bind(Egg).toClass(Egg, [Hen]);
        builder.bind(Hen).toClass(Hen, [Chick]);
        builder.bind(Chick).toClass(Chick, [Egg]);
      },
    });

    const error = wiringFailure(() => createApplication({ modules: [cyclic] }));

    expect(error.code).toBe('DEPENDENCY_CYCLE');
    expect(error.message).toContain('"Egg" -> "Hen" -> "Chick" -> "Egg"');
    expect(built).toBe(0);
  });

  it('rejects a cycle going through factories when it is resolved', () => {
    abstract class Question {
      abstract readonly answer: Answer;
    }
    abstract class Answer {
      abstract readonly question: Question;
    }

    const cyclic = defineContextModule({
      name: 'cyclic',
      register(builder) {
        builder.bind(Question).toFactory((resolve) => ({ answer: resolve(Answer) }));
        builder.bind(Answer).toFactory((resolve) => ({ question: resolve(Question) }));
      },
    });

    const app = createApplication({ modules: [cyclic] });

    const error = wiringFailure(() => app.resolve(Question));

    expect(error.code).toBe('DEPENDENCY_CYCLE');
    expect(error.message).toContain('"Question" -> "Answer" -> "Question"');
  });

  it('rejects the resolution of an unbound port, naming who asked', () => {
    abstract class Missing {
      abstract readonly text: string;
    }
    abstract class Needy {
      abstract readonly text: string;
    }

    const needy = defineContextModule({
      name: 'needy',
      register: (builder) => {
        builder.bind(Needy).toFactory((resolve) => resolve(Missing));
      },
    });

    const app = createApplication({ modules: [needy] });

    expect(wiringFailure(() => app.resolve(Missing))).toMatchObject({
      code: 'UNBOUND_TOKEN',
      message: 'No module binds "Missing".',
    });

    expect(wiringFailure(() => app.resolve(Needy)).message).toBe('No module binds "Missing", required by "Needy".');
  });

  it('rejects a bind left without a target', () => {
    const sloppy = defineContextModule({ name: 'sloppy', register: (builder) => void builder.bind(Clock) });

    const error = wiringFailure(() => createApplication({ modules: [sloppy] }));

    expect(error.code).toBe('INCOMPLETE_BINDING');
    expect(error.message).toBe('Module "sloppy" calls bind(Clock) without toClass, toFactory or toValue.');
  });
});

describe('overrides for tests', () => {
  class LaterClock implements Clock {
    now(): Date {
      return new Date(1000);
    }
  }

  it('swaps a binding through the overrides option, without decorating the fake', async () => {
    const decorated: string[] = [];

    const app = createApplication({
      modules: [platform, shop],
      overrides: [override(Clock, new LaterClock())],
      decorate: (instance, info) => {
        decorated.push(describeToken(info.token));

        return instance;
      },
    });

    await expect(app.resolve(ReserveStock).execute('book')).resolves.toBe('book@1000');
    expect(decorated).toEqual(['Stock', 'ReserveStock']);
  });

  it('lets an override stand in for a module that is not loaded', () => {
    const app = createApplication({ modules: [shop], overrides: [override(Clock, new LaterClock())] });

    expect(app.resolve(ReserveStock).clock).toBeInstanceOf(LaterClock);
  });

  it('swaps a binding on an existing application', () => {
    const app = createApplication({ modules: [platform, shop] });
    const later = new LaterClock();

    overrideForTests(app, Clock, later);

    expect(app.resolve(Clock)).toBe(later);
    expect(app.resolve(ReserveStock).clock).toBe(later);
  });

  it('only swaps on an application this package made', () => {
    const foreign = { ...createApplication({ modules: [platform] }) };

    expect(() => {
      overrideForTests(foreign, Clock, new LaterClock());
    }).toThrow('Not an application made by createApplication.');
  });
});
