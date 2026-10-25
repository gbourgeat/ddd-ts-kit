/** A class carrying Nest's `@Controller`, whose methods the kit serves as routes. */
export type NestControllerClass = abstract new (...args: never) => unknown;
