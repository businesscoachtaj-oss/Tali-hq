import { createContext, use, useCallback, useEffect, useState, type PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type Profile = {
  id: string;
  first_name: string | null;
  business_name: string | null;
  business_type: string | null;
  about_me: string | null;
  timezone: string;
  brief_time: string;
  brief_push: boolean;
  onboarded_at: string | null;
};

type AuthValue = {
  isLoading: boolean;
  session: Session | null;
  profile: Profile | null;
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

const PROFILE_COLUMNS = 'id, first_name, business_name, business_type, about_me, timezone, brief_time, brief_push, onboarded_at';

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', s.user.id).maybeSingle();
    setProfile((data as Profile | null) ?? null);
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
      setSession(s);
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
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ isLoading, session, profile, refreshProfile, signOut, recovering, endRecovery: () => setRecovering(false) }}>
      {children}
    </AuthContext.Provider>
  );
}
