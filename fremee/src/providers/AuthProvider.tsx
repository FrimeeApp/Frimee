"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { getUserAuthSnapshot, type UserAuthSnapshotDto } from "@/services/api/repositories/users.repository";
import { cacheUserSnapshot, readCachedUserSnapshot } from "@/services/auth/snapshotCache";
import {
  applyThemePreference,
  cacheThemePreference,
  readCachedThemePreference,
} from "@/services/theme/preferences";
import type { UserSettingsDto } from "@/services/api/repositories/settings.repository";

type Profile = {
  id: string;
  nombre: string;
  fecha_nac: string | null;
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
  settings: UserSettingsDto | null;
  refreshProfile: () => Promise<void>;
  setUserSnapshot: (snapshot: UserAuthSnapshotDto | null) => void;
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
  const [settings, setSettings] = useState<UserSettingsDto | null>(null);

  const applySnapshot = useCallback((snapshot: UserAuthSnapshotDto | null, persist = true) => {
    const nextProfile = (snapshot?.profile as Profile | null) ?? null;
    const nextSettings = snapshot?.settings ?? null;

    if (mountedRef.current) {
      setProfile(nextProfile);
      setSettings(nextSettings);
    }

    const theme = nextSettings?.theme ?? readCachedThemePreference() ?? "SYSTEM";
    applyThemePreference(theme);
    if (nextSettings) {
      cacheThemePreference(theme);
      if (persist && nextProfile?.id) {
        cacheUserSnapshot(nextProfile.id, { profile: nextProfile, settings: nextSettings });
      }
    }
  }, []);

  const loadUserSnapshot = useCallback(async (authUser: User | null) => {
    if (!authUser) {
      applySnapshot(null);
      return;
    }

    const cachedSnapshot = readCachedUserSnapshot(authUser.id);
    if (cachedSnapshot) {
      applySnapshot(cachedSnapshot, false);
    }

    try {
      const snapshot = await getUserAuthSnapshot(authUser.id);
      if (!mountedRef.current) return;
      applySnapshot(snapshot, true);
    } catch (error) {
      if (!mountedRef.current) return;
      console.warn("[auth] user snapshot fetch exception:", error);
      if (!cachedSnapshot) {
        setProfile(null);
        setSettings(null);
      }
      const cachedTheme = readCachedThemePreference();
      applyThemePreference(cachedTheme ?? "SYSTEM");
    }
  }, [applySnapshot]);

  const refreshProfile = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.warn("[auth] refreshProfile getUser error:", error.message);
    }
    await loadUserSnapshot(data.user ?? null);
  }, [supabase, loadUserSnapshot]);

  const setUserSnapshot = useCallback((snapshot: UserAuthSnapshotDto | null) => {
    applySnapshot(snapshot, true);
  }, [applySnapshot]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn("[auth] signOut error:", error.message);
    }

    if (!mountedRef.current) return;
    setSession(null);
    setUser(null);
    applySnapshot(null);
    setLoading(false);
  }, [supabase, applySnapshot]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    const cachedTheme = readCachedThemePreference();
    applyThemePreference(cachedTheme ?? "SYSTEM");

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn("[auth] getSession error:", error.message);
        }
        if (cancelled || !mountedRef.current) return;

        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
        await loadUserSnapshot(data.session?.user ?? null);
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
        await loadUserSnapshot(nextSession?.user ?? null);

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
  }, [supabase, loadUserSnapshot]);

  const value: AuthState = {
    loading,
    session,
    user,
    profile,
    settings,
    refreshProfile,
    setUserSnapshot,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
