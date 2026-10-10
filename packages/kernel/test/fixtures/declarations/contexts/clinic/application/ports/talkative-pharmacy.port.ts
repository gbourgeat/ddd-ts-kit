/** A port that carries behaviour is no port: nothing but the class could then stand for it. */
export abstract class TalkativePharmacy {
  abstract dispense(prescription: string): Promise<void>;

  greet(): string {
    return 'hello';
  }
}
