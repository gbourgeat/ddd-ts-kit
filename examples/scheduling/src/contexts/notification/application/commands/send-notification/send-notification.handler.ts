import { Clock, IdGenerator, unwrap } from '@ddd-ts-kit/kernel';
import { CommandHandler } from '@ddd-ts-kit/kernel/declarations';
import { Notification } from '@/contexts/notification/domain/aggregates/notification.aggregate.js';
import { ContactUnknownError } from '@/contexts/notification/domain/errors/contact-unknown.error.js';
import { NotificationRepository } from '@/contexts/notification/domain/repositories/notification.repository.js';
import { NotificationKind } from '@/contexts/notification/domain/value-objects/notification-kind.vo.js';
import { Contacts } from '@/contexts/notification/application/ports/contacts.port.js';
import { Mailer } from '@/contexts/notification/application/ports/mailer.port.js';
import { SendNotificationCommand } from '@/contexts/notification/application/commands/send-notification/send-notification.command.js';

@CommandHandler(SendNotificationCommand, [NotificationRepository, Contacts, Mailer, IdGenerator, Clock])
export class SendNotificationHandler implements CommandHandler<SendNotificationCommand> {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly contacts: Contacts,
    private readonly mailer: Mailer,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: SendNotificationCommand): Promise<string> {
    const { recipientId, cause } = command.notice;
    const alreadySent = await this.notificationRepository.findByCause(cause, recipientId);

    if (alreadySent !== undefined) {
      return alreadySent.id;
    }

    const kind = unwrap(NotificationKind.create(command.notice.kind));
    const contact = await this.contacts.get(recipientId);

    if (contact === undefined) {
      throw new ContactUnknownError(recipientId);
    }

    const target = Notification.create(this.ids.next(), { ...command.notice, kind }, this.clock.now());

    await this.mailer.deliver(contact.address, target);
    await this.notificationRepository.save(target);

    return target.id;
  }
}
