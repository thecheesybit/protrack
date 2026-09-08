/**
 * Build-time feature flags.
 *
 * GCAL_ENABLED — Google Calendar two-way sync. The plumbing works but the OAuth
 * / consent flow is fiddly on the free tier, so it ships DISABLED: every
 * connect/login affordance is hidden and `useCalendarSync` is inert. The Month
 * calendar view still works from local data. Flip to `true` to re-expose it.
 */
export const GCAL_ENABLED = false
