/** What the compiler shows when a list names an adapter or a fake where its port is expected. */
export interface ConcreteDependency<Classes> {
  readonly 'the dependency list must name the port, not a class that implements it': Classes;
}
