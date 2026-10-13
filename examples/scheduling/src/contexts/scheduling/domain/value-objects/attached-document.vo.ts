import { ValueObject, type StoredFile } from '@ddd-ts-kit/kernel';
import { AppointmentError } from '@/contexts/scheduling/domain/errors/appointment.error';

/** The longest name a document keeps: it is shown back to people, never used to find the file. */
const LONGEST_NAME = 200;

export type AttachedDocumentProps = {
  readonly file: StoredFile;
  readonly name: string;
  readonly attachedAt: Date;
};

/**
 * A document the practice attached to an appointment: the reference of its content in the file
 * storage (key, size, media type, checksum), never the content, and the name it was sent under.
 */
export class AttachedDocument extends ValueObject<AttachedDocumentProps> {
  private constructor(props: AttachedDocumentProps) {
    super(props);
  }

  /** The name is trimmed; a document sent without one is called `document`. */
  static create(file: StoredFile, name: string, attachedAt: Date): AttachedDocument {
    const trimmed = name.trim();

    if (trimmed.length > LONGEST_NAME) {
      throw AppointmentError.documentNameTooLong(LONGEST_NAME);
    }

    return new AttachedDocument({ file, name: trimmed === '' ? 'document' : trimmed, attachedAt });
  }

  get file(): StoredFile {
    return this.props.file;
  }

  get name(): string {
    return this.props.name;
  }

  get attachedAt(): Date {
    return this.props.attachedAt;
  }
}
