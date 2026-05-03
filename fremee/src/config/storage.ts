export const STORAGE_KEYS = {
  themePreference: "fremee.theme",
  authSnapshot: "fremee.auth_snapshot.v1",
  googleTokenCache: "fremee_google_token_cache_v1",
  mobileCalendarOpen: "frimee:calendar-mobile-open",
  pinnedPlans: "frimee:pinnedPlans",
  feedSearchRecents: "fremee:search-recents",
  feedCache: "fremee:feed:v2",
  friendsCache: "fremee:friends:v1",
  profileUpdatedAt: "fremee.profile.updated_at",
} as const;

export const STORAGE_TTLS = {
  googleTokenCacheMs: 50 * 60 * 1000,
  commentAuthorCacheMs: 60_000,
  feedCacheMs: 5 * 60 * 1000,
  friendsCacheMs: 2 * 60 * 1000,
} as const;
