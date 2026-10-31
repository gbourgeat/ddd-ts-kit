import { Container as InversifyContainer } from 'inversify';
import { describe, expect, it } from 'vitest';
import { defineContextModule, fake, kernelModule, tokenIdentity, type Application, type TestApplication } from '../src';
import type { ApplicationOptions, TestApplicationOptions } from '../src';
import * as awilix from '../src/awilix';
import * as inversify from '../src/inversify';
import * as tsyringe from '../src/tsyringe';

abstract class Stock {
  abstract left(): number;
}

class ShelfStock implements Stock {
  left(): number {
    return 3;
  }
}

const shop = defineContextModule({
  name: 'shop',
  register(builder) {
    builder.bind(Stock).toClass(ShelfStock);
  },
});

interface Entry {
  createApplication(this: void, options: ApplicationOptions): Application;
  createTestApplication(this: void, options: TestApplicationOptions): TestApplication;
}

describe.each<[string, Entry]>([
  ['tsyringe', tsyringe],
  ['inversify', inversify],
  ['awilix', awilix],
])('the entry point %s', (_, entry) => {
  it('makes an application that resolves what its modules bind', () => {
    const app = entry.createApplication({ modules: [kernelModule(), shop] });

    expect(app.resolve(Stock).left()).toBe(3);
  });

  it('makes a test application that puts a fake in place of the adapter', () => {
    const app = entry.createTestApplication({ modules: [shop], fakes: [fake(Stock, { left: () => 0 })] });

    expect(app.get(Stock).left()).toBe(0);
  });
});

describe('application.container', () => {
  it('is the container underneath, typed by the entry point', () => {
    const app = inversify.createApplication({ modules: [kernelModule(), shop] });

    expect(app.container).toBeInstanceOf(InversifyContainer);
    expect(app.container.isBound(tokenIdentity(Stock))).toBe(true);
  });

  it('is an Awilix container on Awilix', () => {
    const app = awilix.createApplication({ modules: [kernelModule(), shop] });

    expect(app.container.hasRegistration(tokenIdentity(Stock))).toBe(true);
  });
});
