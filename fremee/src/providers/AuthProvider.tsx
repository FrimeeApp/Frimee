"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { getUserProfile } from "@/services/api/repositories/users.repository";

type Profile = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  profile_image: string | null;
  estado: string;
  email_verified_at: string | null;
  deleted_at: string | null;
};

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const mountedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const fetchProfile = useCallback(
    async (authUser: User | null) => {
      if (!authUser) {
        if (mountedRef.current) setProfile(null);
        return;
      }

      try {
        const data = await getUserProfile(authUser.id);
        if (!mountedRef.current) return;
        setProfile((data as Profile) ?? null);
      } catch (error) {
        if (!mountedRef.current) return;
        console.warn("[auth] profile fetch exception:", error);
        setProfile(null);
      }
    },
    [],
  );

  const refreshProfile = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.warn("[auth] refreshProfile getUser error:", error.message);
    }
    await fetchProfile(data.user ?? null);
  }, [supabase, fetchProfile]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn("[auth] signOut error:", error.message);
    }

    if (!mountedRef.current) return;
    setSession(null);
    setUser(null);
    setProfile(null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn("[auth] getSession error:", error.message);
        }
        if (cancelled || !mountedRef.current) return;

        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
        await fetchProfile(data.session?.user ?? null);
      } finally {
        if (!cancelled && mountedRef.current) {
          setLoading(false);
        }
      }
    };

    void init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void (async () => {
        if (cancelled || !mountedRef.current) return;

        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        await fetchProfile(nextSession?.user ?? null);

        if (!cancelled && mountedRef.current) {
          setLoading(false);
        }
      })();
    });

    return () => {
      cancelled = true;
      mountedRef.current = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const value: AuthState = {
    loading,
    session,
    user,
    profile,
    refreshProfile,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
