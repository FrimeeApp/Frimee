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

async function refreshViaEdgeFunction(supabase: SupabaseClient): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return null;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) return null;

    const res = await fetch(`${supabaseUrl}/functions/v1/refresh-google-token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

export async function resolveGoogleProviderToken(
  params: ResolveGoogleProviderTokenParams,
): Promise<string | null> {
  const sessionToken = extractProviderToken(params.session);
  if (sessionToken) {
    if (params.userId) cacheGoogleProviderToken(params.userId, sessionToken);
    return sessionToken;
  }

  try {
    const { data: refreshedData } = await params.supabase.auth.refreshSession();
    const refreshedToken = extractProviderToken(refreshedData.session ?? null);
    if (refreshedToken) {
      if (params.userId) cacheGoogleProviderToken(params.userId, refreshedToken);
      return refreshedToken;
    }
  } catch {
    // continue
  }

  try {
    const { data } = await params.supabase.auth.getSession();
    const currentToken = extractProviderToken(data.session ?? null);
    if (currentToken) {
      if (params.userId) cacheGoogleProviderToken(params.userId, currentToken);
      return currentToken;
    }
  } catch {
    // continue
  }

  const edgeToken = await refreshViaEdgeFunction(params.supabase);
  if (edgeToken) {
    if (params.userId) cacheGoogleProviderToken(params.userId, edgeToken);
    return edgeToken;
  }

  if (params.cachedToken) return params.cachedToken;

  if (params.userId) {
    const localToken = readCachedGoogleProviderToken(params.userId);
    if (localToken) return localToken;
  }

  return null;
}
