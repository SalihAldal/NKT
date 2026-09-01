import type { Invitation } from '@/domain/models/social';
import type { InvitationType } from '@/domain/constants/enums';

export interface InvitationApi {
  send(senderId: string, receiverId: string, type: InvitationType, referenceId: string): Promise<Invitation>;
  accept(invitationId: string, userId: string): Promise<Invitation>;
  reject(invitationId: string, userId: string): Promise<Invitation>;
  get(invitationId: string): Promise<Invitation>;
  list(userId: string, type?: InvitationType): Promise<Invitation[]>;
}
