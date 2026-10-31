import type { Application, TestApplication, TestApplicationOptions, ApplicationOptions } from '../../src';
import * as awilix from '../../src/awilix';
import * as inversify from '../../src/inversify';
import * as tsyringe from '../../src/tsyringe';

interface Entry {
  createApplication(this: void, options: ApplicationOptions): Application;
  createTestApplication(this: void, options: TestApplicationOptions): TestApplication;
}

const containers: Readonly<Record<string, Entry>> = { awilix, inversify, tsyringe };

/** The container the specs of this package run on: `DI_CONTAINER=inversify` runs all of them on InversifyJS. */
const chosen = containers[process.env.DI_CONTAINER ?? 'tsyringe'];

if (chosen === undefined) {
  throw new Error(`DI_CONTAINER names no container: "${process.env.DI_CONTAINER}".`);
}

export const { createApplication, createTestApplication } = chosen;
