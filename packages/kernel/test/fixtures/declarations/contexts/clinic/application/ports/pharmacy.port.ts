export abstract class Pharmacy {
  abstract dispense(prescription: string): Promise<void>;
}
