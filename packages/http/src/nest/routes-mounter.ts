/**
 * The Nest provider every routes module registers: it mounts the routes of its module when Nest
 * initialises it. The class is the provider token.
 */
export abstract class RoutesMounter {
  static readonly tokenKey = 'http.RoutesMounter';

  abstract onModuleInit(): void;
}
