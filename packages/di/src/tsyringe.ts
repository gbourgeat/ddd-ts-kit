// tsyringe 4.10 throws while loading when the Reflect metadata polyfill is absent, even
// though this package never uses decorators. Importing it here, before tsyringe, spares
// consumers a line they would otherwise have to remember in every entry point and test.
import 'reflect-metadata';

export { createApplication } from './containers/tsyringe/create-application';
export { createTestApplication } from './containers/tsyringe/create-test-application';
