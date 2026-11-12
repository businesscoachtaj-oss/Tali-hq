import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type Profile = {
  id: string;
  first_name: string | null;
  business_name: string | null;
  business_type: string | null;
  has_business?: boolean | null;
  about_me: string | null;
  timezone: string;
  brief_time: string;
  brief_push: boolean;
  onboarded_at: string | null;
  tour_done_at: string | null;
};

type AuthValue = {
  isLoading: boolean;
  session: Session | null;
  profile: Profile | null;
  // True once the profile for the current session has loaded (or there is no session). Until then the
  // root layout shows a loader, so signing in never flashes onboarding before the profile arrives.
  profileReady: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  // True after an emailed password-reset link signs the user in, until they set a new password.
  recovering: boolean;
  endRecovery: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth() {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth must be inside <AuthProvider />');
  return value;
}

const PROFILE_COLUMNS = 'id, first_name, business_name, business_type, has_business, about_me, timezone, brief_time, brief_push, onboarded_at, tour_done_at';

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  // Speed pass (13 Nov 2026): whose profile is loaded or loading, so a token refresh or the
  // same user signing in again doesn't fetch it again and re-render the whole app.
  const profileFor = useRef<string | null>(null);

  const loadProfile = useCallback(async (s: Session | null) => {
    profileFor.current = s?.user.id ?? null;
    if (!s) {
      setProfile(null);
      setLoadedFor(null);
      return;
    }
    const { data } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', s.user.id).maybeSingle();
    setProfile((data as Profile | null) ?? null);
    setLoadedFor(s.user.id);
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (alive) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
      // Speed pass (13 Nov 2026): keep the same session object when nothing changed (the web app
      // gets auth events when it comes back into view), so screens that depend on it don't reload.
      setSession((prev) => (prev && s && prev.access_token === s.access_token && prev.user.id === s.user.id ? prev : s));
      // Only fetch the profile when the person changed or their account was updated.
      const uid = s?.user.id ?? null;
      if (uid === profileFor.current && event !== 'USER_UPDATED') return;
      // Supabase warns against awaiting other calls inside this callback.
      setTimeout(() => {
        loadProfile(s);
      }, 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(() => loadProfile(session), [loadProfile, session]);
  const signOut = useCallback(async () => {
    // This device only (11 Nov 2026). The default signs every device out, which left the others
    // half signed in: lists loaded but Tali answered "Please sign in again."
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  const endRecovery = useCallback(() => setRecovering(false), []);
  // Speed pass (13 Nov 2026): one value object per real change, so every screen using useAuth()
  // doesn't re-render whenever this provider does.
  const value = useMemo<AuthValue>(
    () => ({ isLoading, session, profile, profileReady: !session || loadedFor === session.user.id, refreshProfile, signOut, recovering, endRecovery }),
    [isLoading, session, profile, loadedFor, refreshProfile, signOut, recovering, endRecovery],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
