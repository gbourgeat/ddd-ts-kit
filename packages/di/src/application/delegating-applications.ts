import type { Application } from './application.js';

/**
 * The application behind each object that stands in front of one, as the test application
 * does: what is asked of the front and concerns the container goes to the application itself.
 */
export const delegatingApplications = new WeakMap<Application, Application>();
