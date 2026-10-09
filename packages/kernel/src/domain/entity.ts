/** Identity, not attributes, defines an entity. Two entities are equal when type and id match. */
export abstract class Entity<Id extends string | number = string> {
  protected constructor(readonly id: Id) {}

  equals(other: Entity<Id> | undefined | null): boolean {
    return (
      other !== undefined &&
      other !== null &&
      other.constructor === this.constructor &&
      other.id === this.id
    );
  }
}
