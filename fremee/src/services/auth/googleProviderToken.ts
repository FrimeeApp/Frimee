import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { cacheGoogleProviderToken, readCachedGoogleProviderToken } from "@/services/auth/googleTokenCache";

type ResolveGoogleProviderTokenParams = {
  supabase: SupabaseClient;
  session: Session | null;
  userId: string | null;
  cachedToken?: string | null;
};

function extractProviderToken(session: Session | null) {
  return (session as { provider_token?: string | null } | null)?.provider_token ?? null;
}

export async function resolveGoogleProviderToken(params: ResolveGoogleProviderTokenParams): Promise<string | null> {
  const sessionToken = extractProviderToken(params.session);
  if (sessionToken) {
    if (params.userId) {
      cacheGoogleProviderToken(params.userId, sessionToken);
    }
    return sessionToken;
  }

  try {
    const { data: refreshedData } = await params.supabase.auth.refreshSession();
    const refreshedToken = extractProviderToken(refreshedData.session ?? null);
    if (refreshedToken) {
      if (params.userId) {
        cacheGoogleProviderToken(params.userId, refreshedToken);
      }
      return refreshedToken;
    }
  } catch {
    // ignore and continue with getSession fallback
  }

  try {
    const { data } = await params.supabase.auth.getSession();
    const currentToken = extractProviderToken(data.session ?? null);
    if (currentToken) {
      if (params.userId) {
        cacheGoogleProviderToken(params.userId, currentToken);
      }
      return currentToken;
    }
  } catch {
    // ignore and continue with cache fallback
  }

  if (params.cachedToken) {
    return params.cachedToken;
  }

  if (params.userId) {
    const localToken = readCachedGoogleProviderToken(params.userId);
    if (localToken) return localToken;
  }

  return null;
}
