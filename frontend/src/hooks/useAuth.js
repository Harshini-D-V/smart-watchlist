/**
 * Anonymous auth via Supabase.
 *
 * On first load, signs in anonymously — Supabase creates a stable user_id
 * that persists across sessions on the same device via localStorage.
 * On any other device the user signs in again and gets the same stable ID
 * because we persist the session token.
 *
 * This is the "zero friction for demo" option from plan §5b.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export function useAuth() {
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        setLoading(false);
      } else {
        // No session — sign in anonymously
        supabase.auth.signInAnonymously().then(({ data, error }) => {
          if (error) {
            console.error('Auth error:', error.message);
          } else {
            setUserId(data.user?.id ?? null);
          }
          setLoading(false);
        });
      }
    });

    // Listen for auth state changes (e.g. token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { userId, loading };
}
