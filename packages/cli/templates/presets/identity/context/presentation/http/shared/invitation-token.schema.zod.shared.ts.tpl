import { z } from 'zod';

/** What a person names an invitation by, to accept or to decline it: declared once, the contract documents it once. */
export const invitationTokenSchema = z
  .object({
    /** The token the invitation was sent with. */
    token: z.string().min(1),
  })
  .meta({ id: 'InvitationToken' });
