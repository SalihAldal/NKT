import type {
  ConnectionState,
  CustomCategoryStatus,
  CustomCategoryVisibility,
  ModerationStatus,
} from '../constants/enums';

export interface CustomCategory {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  coverUrl?: string;
  contentIds: string[];
  visibility: CustomCategoryVisibility;
  status: CustomCategoryStatus;
  moderationStatus: ModerationStatus;
  metadata: CustomCategoryMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface CustomCategoryMetadata {
  reportedCount: number;
  lastModeratedAt?: string;
  moderatedBy?: string;
  rejectionReason?: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  order: number;
  isFree: boolean;
  isActive: boolean;
  minimumContentTarget: number;
  supportedContentTypes: string[];
  ageRating: string;
  createdAt: string;
  updatedAt: string;
}
