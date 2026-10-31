import { describe, expect, it } from 'vitest';
import type { Container, Token } from '../src';
import { awilixContainer } from '../src/containers/awilix/awilix-container';
import { inversifyContainer } from '../src/containers/inversify/inversify-container';
import { tsyringeContainer } from '../src/containers/tsyringe/tsyringe-container';

abstract class Port {}
abstract class Other {}

const PORT: Token<unknown> = Port;
const OTHER: Token<unknown> = Other;

describe.each<[string, () => Container]>([
  ['tsyringe', tsyringeContainer],
  ['InversifyJS', inversifyContainer],
  ['Awilix', awilixContainer],
])('the container %s', (_, newContainer) => {
  it('knows what is bound and what is not', () => {
    const container = newContainer();

    container.bindValue(PORT, 'a value');

    expect(container.isBound(PORT)).toBe(true);
    expect(container.isBound(OTHER)).toBe(false);
  });

  it('gives a value back as it was bound', () => {
    const container = newContainer();
    const value = { id: 1 };

    container.bindValue(PORT, value);

    expect(container.resolve(PORT)).toBe(value);
  });

  it.each([[0], [''], [false], [null], [undefined]])('gives back the empty value %s', (value) => {
    const container = newContainer();

    container.bindValue(PORT, value);

    expect(container.resolve(PORT)).toBe(value);
  });

  it('never builds a class bound as a value', () => {
    class Concrete {}
    const container = newContainer();

    container.bindValue(PORT, Concrete);

    expect(container.resolve(PORT)).toBe(Concrete);
  });

  it('builds a singleton once, at its first resolution', () => {
    const container = newContainer();
    let built = 0;

    container.bindFactory(
      PORT,
      () => {
        built += 1;

        return { built };
      },
      'singleton',
    );

    expect(built).toBe(0);
    expect(container.resolve(PORT)).toBe(container.resolve(PORT));
    expect(built).toBe(1);
  });

  it('builds a transient at each resolution', () => {
    const container = newContainer();

    container.bindFactory(PORT, () => ({}), 'transient');

    expect(container.resolve(PORT)).not.toBe(container.resolve(PORT));
  });

  it('lets a factory resolve what it needs, a transient under a singleton included', () => {
    const container = newContainer();

    container.bindFactory(OTHER, () => ({ name: 'dependency' }), 'transient');
    container.bindFactory(PORT, () => ({ other: container.resolve(OTHER) }), 'singleton');

    expect(container.resolve(PORT)).toEqual({ other: { name: 'dependency' } });
  });

  it('resolves the most recent binding, whatever the kinds', () => {
    const container = newContainer();

    container.bindFactory(PORT, () => 'factory', 'singleton');
    container.bindValue(PORT, 'value');
    expect(container.resolve(PORT)).toBe('value');

    container.bindFactory(PORT, () => 'second factory', 'transient');
    expect(container.resolve(PORT)).toBe('second factory');

    container.bindValue(PORT, 'second value');
    expect(container.resolve(PORT)).toBe('second value');
  });

  it('replaces a singleton already built', () => {
    const container = newContainer();

    container.bindFactory(PORT, () => ({ name: 'first' }), 'singleton');
    container.resolve(PORT);
    container.bindValue(PORT, { name: 'second' });

    expect(container.resolve(PORT)).toEqual({ name: 'second' });
  });

  it('lets the error of a factory through as it was thrown', () => {
    const container = newContainer();
    const failure = new Error('cannot connect');

    container.bindFactory(
      PORT,
      () => {
        throw failure;
      },
      'singleton',
    );

    expect(() => container.resolve(PORT)).toThrow(failure);
  });

  it('shares nothing between two containers', () => {
    const first = newContainer();
    const second = newContainer();

    first.bindFactory(PORT, () => ({}), 'singleton');

    expect(second.isBound(PORT)).toBe(false);
    expect(first.native).not.toBe(second.native);
  });
});

describe.each<[string, () => Container]>([
  ['tsyringe', tsyringeContainer],
  ['Awilix', awilixContainer],
])('the container %s, on a promise', (_, newContainer) => {
  it('gives back a promise bound as a value, unsettled', async () => {
    const container = newContainer();
    const promise = Promise.resolve('later');

    container.bindValue(PORT, promise);

    expect(container.resolve(PORT)).toBe(promise);
    await expect(promise).resolves.toBe('later');
  });
});

describe('the container InversifyJS, on a promise', () => {
  it('refuses it at its first resolution, naming the service', () => {
    const container = inversifyContainer();

    container.bindValue(PORT, Promise.resolve('later'));

    expect(() => container.resolve(PORT)).toThrow(/asynchronous service/);
  });
});
