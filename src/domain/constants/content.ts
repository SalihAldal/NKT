/** Content quality pipeline states */
export const CONTENT_QUALITY_STATUS = {
  DRAFT: 'draft',
  REVIEW: 'review',
  APPROVED: 'approved',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  DISABLED: 'disabled',
} as const;

export type ContentQualityStatus = (typeof CONTENT_QUALITY_STATUS)[keyof typeof CONTENT_QUALITY_STATUS];

/** Only ACTIVE + APPROVED moderation can be used in games */
export const isPlayableContent = (
  active: boolean,
  moderationStatus: string,
  qualityStatus: ContentQualityStatus,
): boolean =>
  active &&
  moderationStatus === 'approved' &&
  (qualityStatus === CONTENT_QUALITY_STATUS.ACTIVE || qualityStatus === CONTENT_QUALITY_STATUS.APPROVED);

export const MINIMUM_CONTENT_TARGET = 300;
