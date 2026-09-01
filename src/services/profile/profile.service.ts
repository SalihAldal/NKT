import { validateProfileInput, type EditProfileInput } from './profile-validation';
import { imageUploadService } from '@/services/imageUpload';
import { api } from '@/api/client';
import type { User } from '@/types';

class ProfileServiceImpl {
  validate(input: EditProfileInput) {
    return validateProfileInput(input);
  }

  async updateProfile(userId: string, input: EditProfileInput & { avatarUri?: string }): Promise<User> {
    const validation = validateProfileInput(input);
    if (!validation.valid) {
      throw new Error(Object.values(validation.errors)[0] ?? 'Geçersiz profil bilgisi');
    }

    let avatarUrl: string | undefined;
    if (input.avatarUri) {
      avatarUrl = await imageUploadService.upload(input.avatarUri, 'avatar');
    }

    return api.updateProfile({
      name: input.name,
      avatar: avatarUrl,
    });
  }
}

export const profileService = new ProfileServiceImpl();
