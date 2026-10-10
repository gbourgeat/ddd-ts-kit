export abstract class Rooms {
  abstract isFree(at: Date): Promise<boolean>;
}
