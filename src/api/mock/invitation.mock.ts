import type { InvitationApi } from '../contracts/invitation.api';
import type { Invitation } from '@/domain/models/social';
import { socialServer } from './social-server';
import { delay } from './data';

export const createMockInvitationApi = (): InvitationApi => ({
  async send(senderId, receiverId, type, referenceId) {
    await delay(200);
    return socialServer.sendInvitation(senderId, receiverId, type, referenceId);
  },

  async accept(invitationId, userId) {
    await delay(200);
    return socialServer.acceptInvitation(invitationId, userId);
  },

  async reject(invitationId, userId) {
    await delay(200);
    return socialServer.rejectInvitation(invitationId, userId);
  },

  async get(invitationId) {
    await delay(100);
    const inv = socialServer.getInvitation(invitationId);
    if (!inv) throw new Error('Davet bulunamadı.');
    return inv;
  },

  async list(userId, type?) {
    await delay(200);
    return socialServer.listInvitations(userId, type);
  },
});
