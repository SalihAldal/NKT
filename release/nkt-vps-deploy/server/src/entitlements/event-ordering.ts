/** Pure webhook event ordering — no DB dependency */
export function shouldApplyWebhookEvent(
  currentSubscriptionUpdatedAt: Date | null,
  eventTimestamp: Date,
): boolean {
  if (!currentSubscriptionUpdatedAt) return true;
  return eventTimestamp >= currentSubscriptionUpdatedAt;
}
