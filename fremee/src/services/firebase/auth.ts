import { getAuth, signInWithCustomToken, signOut } from "firebase/auth";
import { buildInternalApiUrl } from "@/config/external";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { getFirebaseApp } from "./client";

/**
 * Signs Firebase in as the Supabase user (custom token from /api/firebase/token), so the
 * Storage and Firestore rules know who is asking. Call it before touching Firebase; it does
 * nothing when Firebase is already signed in as that user, and shares one request when
 * several uploads start at once.
 */
let pending: Promise<void> | null = null;

export function ensureFirebaseAuth(): Promise<void> {
  if (pending) return pending;
  pending = (async () => {
    const { data: { session } } = await createBrowserSupabaseClient().auth.getSession();
    if (!session) throw new Error("Hace falta una sesión para subir archivos");
    const auth = getAuth(getFirebaseApp());
    if (auth.currentUser?.uid === session.user.id) return;

    const res = await fetch(buildInternalApiUrl("/api/firebase/token"), {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
    if (!res.ok || !data.token) throw new Error(data.error ?? `No se pudo identificar en Firebase (${res.status})`);
    await signInWithCustomToken(auth, data.token);
  })().finally(() => {
    pending = null;
  });
  return pending;
}

/** On logout: Firebase must not keep acting as the previous user. */
export async function signOutFirebase(): Promise<void> {
  const auth = getAuth(getFirebaseApp());
  if (auth.currentUser) await signOut(auth);
}
