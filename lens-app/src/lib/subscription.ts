interface SubLike {
  plan?: string
  subscription_status?: 'inactive' | 'active' | 'cancelled'
}

/**
 * A user has Lens Pro access when their subscription is active. The dev test
 * user is seeded plan='free' but subscription_status='active', so gating on
 * subscription_status (not plan) is what keeps the app usable in dev. The plan
 * string is only used for the displayed Pro/Free badge.
 */
export function isSubscribed(user: SubLike | null | undefined): boolean {
  if (!user) return false
  return user.subscription_status === 'active' || user.plan === 'pro'
}
